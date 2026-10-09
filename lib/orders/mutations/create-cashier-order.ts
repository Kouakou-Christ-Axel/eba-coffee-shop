// lib/orders/mutations/create-cashier-order.ts
//
// Mutations de commandes — create-cashier-order (extrait de lib/order-mutations.ts, sans changement de comportement).

import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import {
  getNextDailyNumber,
  todayDailyDate,
  DAILY_NUMBER_MAX_RETRIES,
} from '@/lib/daily-numbering';
import { generateOrderReference } from '@/lib/orders';
import { upsertCustomerForOrder } from '@/lib/customer-mutations';
import {
  awardLoyaltyForOrder,
  consumeLoyaltyReward,
  LoyaltyRewardUnavailableError,
  resolveLoyaltyReward,
} from '@/lib/loyalty-mutations';
import { cartRequiresDeposit, computeRequiredDeposit } from '@/lib/deposits';
import { normalizeIvorianPhone } from '@/lib/phone';
import { computeItemsTotal } from '@/lib/orders/totals';
import { isDeferredPickup } from '@/lib/orders/scheduling';
import { parseDateOnlyToUTC } from '@/lib/timezone';
import type { CartItem } from '@/lib/cart-store';
import { notifyOrderCreated } from './notify';
import { OrderMutationError } from './errors';
import { reserveStockOnce } from './stock-reservation';
import type { CreateCashierOrderInput } from './types';

/**
 * Crée une commande walk-in / administrée, avec antidatage optionnel.
 *
 * Le total est TOUJOURS recalculé côté serveur (net après remises) : on ne fait
 * pas confiance à un total fourni. Retry sur conflit de l'index unique
 * (dailyDate, dailyNumber).
 *
 * Récompense fidélité (`loyaltyRewardId`) : appliquée comme une remise globale
 * plafonnée (`capAmount`, jamais plus que le total), déduite du total AVANT
 * l'attribution du tampon de cette commande (le tampon se calcule donc sur le
 * montant réellement encaissé). La récompense est vérifiée (appartient au
 * client résolu, statut `AVAILABLE`) et marquée `USED` dans la MÊME
 * transaction que la création — jamais réutilisable deux fois.
 *
 * Si CETTE commande débloque elle-même un palier (5e/10e tampon) et
 * qu'aucune récompense pré-existante n'a été choisie via `loyaltyRewardId`,
 * la récompense fraîchement créée est auto-appliquée à cette même commande
 * (une seule récompense par commande) — pas besoin d'attendre la suivante.
 *
 * ARDOISE À LA CRÉATION : si le client résolu est de confiance
 * (`Customer.isTrusted`), si la commande est SUR PLACE ou À EMPORTER (ces
 * deux types n'ont pas à attendre l'encaissement pour partir en cuisine —
 * seule la livraison reste sur le flux normal), ou si le caissier force via
 * `input.onAccount` — la commande est créée DIRECTEMENT en `PREPARING`,
 * marquée `isOnAccount`, et son stock est réservé dans la MÊME transaction.
 * Elle reste `isPaid: false` : ce n'est PAS un paiement, seulement un
 * non-blocage (cf. `Order.isOnAccount`). `input.onAccount: false` permet à
 * l'inverse de refuser ce départ automatique (dérogation explicite du
 * caissier), y compris pour un sur-place/à-emporter.
 * Une pénurie lève alors `StockShortageError` (409) et annule toute la
 * création — la commande n'existe pas, rien n'a été décrémenté — sauf si
 * `input.coverShortage` confirme que le manquant vient d'être produit (même
 * filet que `sendOrderToKitchen`/`setOrderPayment`).
 *
 * L'ANTIDATAGE SUPPRIME CE COMPORTEMENT, exactement comme il supprime le push
 * « nouvelle commande » : une saisie de rattrapage n'est pas un événement en
 * direct, elle ne doit ni réveiller la cuisine ni décrémenter le stock
 * d'aujourd'hui pour un plat servi la semaine dernière.
 *
 * UN RETRAIT DIFFÉRÉ AUSSI, pour la raison symétrique : la marchandise sera
 * produite le jour du retrait. La commande d'un client de confiance pour demain
 * reste donc `NEW`, et `isOnAccount` N'EST PAS posé — ce drapeau signifie
 * précisément « partie en cuisine sans encaissement », et le poser sans départ
 * en cuisine fausserait l'ardoise (lib/ardoise.ts). Il sera posé le jour J, par
 * `sendOrderToKitchen({ onAccount: true })`.
 */
export async function createCashierOrder(input: CreateCashierOrderInput) {
  // Normalisation téléphone : saisie libre acceptée, stockée en E.164 si
  // reconnue, sinon telle quelle.
  const rawPhone = input.customerPhone?.trim() || null;
  const normalizedPhone = rawPhone
    ? (normalizeIvorianPhone(rawPhone) ?? rawPhone)
    : null;

  // Jour civil de rattachement : antidatage si `orderDate` fourni, sinon
  // aujourd'hui. `parseDateOnlyToUTC` aligne sur minuit UTC = Order.dailyDate.
  const today = todayDailyDate();
  const dailyDate = input.orderDate
    ? (parseDateOnlyToUTC(input.orderDate) ?? today)
    : today;
  const isBackdated = dailyDate.getTime() !== today.getTime();

  // Un seul `now` pour toute la création : les retries de numérotation ne
  // doivent pas pouvoir changer le verdict « différée » en cours de route.
  const now = new Date();
  const isDeferred = isDeferredPickup(input.pickupTime ?? null, now);

  const grossTotal = computeItemsTotal(input.items as CartItem[]);
  const requiresDeposit = cartRequiresDeposit(input.items as CartItem[]);

  for (let attempt = 0; attempt < DAILY_NUMBER_MAX_RETRIES; attempt++) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const dailyNumber = await getNextDailyNumber(tx, dailyDate);
        const reference = generateOrderReference(dailyDate);
        const customerId = await upsertCustomerForOrder(
          tx,
          normalizedPhone,
          input.customerName
        );

        // Client de confiance : sa commande n'attend pas l'encaissement pour
        // partir en cuisine. `input.onAccount` (dérogation explicite du
        // caissier) prime sur la fiche — il permet l'ardoise pour un walk-in
        // non fiché, et permet aussi de la refuser (`false`) à un client fiché.
        const trusted = customerId
          ? ((
              await tx.customer.findUnique({
                where: { id: customerId },
                select: { isTrusted: true },
              })
            )?.isTrusted ?? false)
          : false;
        // Sur place / à emporter : départ en cuisine automatique même sans
        // client de confiance, la livraison reste sur le flux normal (le
        // client doit d'abord être identifié pour l'envoi du livreur).
        const autoOnAccount =
          trusted ||
          input.orderType === 'DINE_IN' ||
          input.orderType === 'TAKEAWAY';
        // Une commande spéciale exigeant un acompte (cf. Product.requiresDeposit)
        // ne part jamais en cuisine sans encaissement : l'ardoise dispense de
        // payer, ce qui contredit l'acompte requis avant prise en compte.
        const goToKitchen =
          (input.onAccount ?? autoOnAccount) &&
          !isBackdated &&
          !isDeferred &&
          !requiresDeposit;

        // Récompense fidélité : vérifiée à nouveau à CHAQUE tentative (une
        // transaction annulée par un conflit de numéro n'a rien écrit).
        // Logique partagée avec le flux online (lib/loyalty-mutations.ts).
        let reward: { id: string; capAmount: number } | null = null;
        if (input.loyaltyRewardId) {
          try {
            reward = await resolveLoyaltyReward(
              tx,
              input.loyaltyRewardId,
              customerId
            );
          } catch (err) {
            if (err instanceof LoyaltyRewardUnavailableError) {
              throw new OrderMutationError(err.message, 400);
            }
            throw err;
          }
        }

        const discount = reward ? Math.min(reward.capAmount, grossTotal) : 0;
        const total = grossTotal - discount;

        const created = await tx.order.create({
          data: {
            reference,
            dailyDate,
            dailyNumber,
            customerName: input.customerName ?? null,
            customerPhone: normalizedPhone,
            customerId,
            pickupTime: input.pickupTime ? new Date(input.pickupTime) : null,
            orderType: input.orderType,
            items: input.items,
            total,
            depositRequired: computeRequiredDeposit(
              input.items as CartItem[],
              total
            ),
            note: input.note ?? null,
            createdById: input.createdById ?? null,
            source: input.source ?? 'CASHIER',
            loyaltyRewardId: reward?.id ?? null,
            loyaltyDiscount: discount || null,
            // Ardoise : la commande naît en cuisine, non payée. `isPaid` reste
            // false — le CA n'est jamais gonflé par une commande non réglée
            // (cf. lib/stats.ts, qui filtre sur `isPaid`).
            ...(goToKitchen
              ? {
                  status: 'PREPARING' as const,
                  preparingStartedAt: new Date(),
                  isOnAccount: true,
                }
              : {}),
            // Antidatage : aligner createdAt sur le jour civil ciblé pour que le
            // tri chronologique (createdAt desc) reflète la date réelle.
            ...(isBackdated ? { createdAt: dailyDate } : {}),
          },
        });

        // Réservation du stock DANS la transaction de création : la marchandise
        // part en cuisine, elle doit être décomptée au même instant. Une
        // pénurie lève `StockShortageError` et annule la création entière.
        // Point d'entrée normal (`sendOrderToKitchen`) inapplicable ici : il
        // relit une commande qui n'existe pas encore.
        if (goToKitchen) {
          await reserveStockOnce(tx, created.id, input.items as CartItem[], {
            coverShortage: input.coverShortage,
          });
        }

        if (reward) {
          await consumeLoyaltyReward(tx, {
            rewardId: reward.id,
            customerId: customerId as string,
            orderId: created.id,
            capAmount: reward.capAmount,
            actorId: input.createdById ?? null,
          });
        }

        // Palier fidélité débloqué PAR cette commande (5e/10e tampon) : on
        // l'applique directement à la même commande plutôt que de la laisser
        // seulement disponible pour la suivante — sauf si une récompense
        // pré-existante a déjà été choisie ci-dessus (une seule récompense par
        // commande, `Order.loyaltyRewardId` est un champ unique).
        let finalOrder = created;
        if (customerId) {
          const { rewards } = await awardLoyaltyForOrder(tx, {
            customerId,
            orderId: created.id,
            orderTotal: total,
            actorId: input.createdById ?? null,
          });

          if (!reward && rewards.length > 0) {
            const selfReward = rewards[0];
            const selfDiscount = Math.min(selfReward.capAmount, total);
            await consumeLoyaltyReward(tx, {
              rewardId: selfReward.id,
              customerId,
              orderId: created.id,
              capAmount: selfReward.capAmount,
              actorId: input.createdById ?? null,
            });
            finalOrder = await tx.order.update({
              where: { id: created.id },
              data: {
                total: total - selfDiscount,
                loyaltyRewardId: selfReward.id,
                loyaltyDiscount: selfDiscount,
                depositRequired: computeRequiredDeposit(
                  input.items as CartItem[],
                  total - selfDiscount
                ),
              },
            });
          }
        }

        return finalOrder;
      });

      if (!isBackdated) notifyOrderCreated(created, now);

      return created;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        attempt < DAILY_NUMBER_MAX_RETRIES - 1
      ) {
        continue;
      }
      throw err;
    }
  }

  throw new Error('Impossible de générer un numéro de commande quotidien');
}
