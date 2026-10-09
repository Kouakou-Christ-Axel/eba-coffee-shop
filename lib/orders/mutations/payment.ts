// Mutations de commandes — payment.

import prisma from '@/lib/prisma';
import { isDeferredPickup } from '@/lib/orders/scheduling';
import type { OrderPaymentLineInput } from '@/lib/schemas/order';
import type { CartItem } from '@/lib/cart-store';
import { notifyOrderCustomer } from '@/lib/push-notify';
import { notifyKitchen } from './notify';
import { OrderMutationError, StockShortageError } from './errors';
import {
  reserveStockOnce,
  notifyPendingOrdersOfShortage,
} from './stock-reservation';
import { resolvePaymentMode } from './payment-mode';

/**
 * Bascule l'état de paiement d'une commande. Si `isPaid=true`, `payments`
 * (1..N lignes `{mode, amount}`) est requis et sa somme doit égaler
 * EXACTEMENT le total de la commande — relu en base, jamais celui fourni par
 * l'appelant (pas de paiement partiel/layaway). Encaisser une commande encore
 * `NEW` la pousse aussi en cuisine (`NEW → PREPARING`). Concurrence optimiste
 * sur `isPaid`.
 *
 * STOCK : l'encaissement en tant que tel ne réserve plus rien. Seul le cas où
 * il pousse une commande encore `NEW` en cuisine réserve le stock, via
 * `reserveStockOnce` et DANS LA MÊME transaction, AVANT le flip `isPaid` — la
 * réservation suit la marchandise, pas l'argent. Encaisser une commande déjà
 * partie en cuisine (ou déjà `READY`/`COMPLETED`) est donc PUREMENT financier :
 * aucun appel stock. L'ancienne exception « ne pas décrémenter si `COMPLETED` »
 * n'a plus lieu d'être ; `stockReservedAt` la subsume et couvre en plus une
 * commande `COMPLETED` qui n'a jamais été encaissée.
 *
 * COMMANDE DIFFÉRÉE : l'encaissement redevient PUREMENT financier, même sur une
 * commande `NEW`. Elle ne part pas en cuisine et ne décompte rien — le client
 * peut donc payer d'avance (cas courant d'une commande de gâteau réservée), la
 * commande reste « Programmée » et n'entrera en cuisine que le jour du retrait,
 * sur le geste `sendOrderToKitchen`.
 *
 * Crée une ligne `OrderPayment` par moyen de paiement fourni ; `paymentMode`
 * (sur `Order`) reste renseigné pour le cas courant (1 seul mode), `null` pour
 * un paiement fractionné (voir `resolvePaymentMode`).
 * Passage à `isPaid=false` (dépaiement) : comportement inchangé, PLUS
 * suppression des lignes `OrderPayment` associées (dans la même transaction),
 * SANS jamais ré-incrémenter le stock déjà réservé (ni remettre
 * `stockReservedAt` à null — verrou à sens unique, cf. `sendOrderToKitchen`).
 *
 * Lève `OrderMutationError` (400 paiement manquant/somme incorrecte, 404
 * introuvable, 409 conflit, ou `StockShortageError` 409 si le stock ne suffit
 * plus — le client perdant est alors notifié `ITEM_UNAVAILABLE` avant que
 * l'erreur ne remonte). Renvoie `startedPreparation` (vrai si la commande est
 * partie en cuisine).
 */
export async function setOrderPayment(
  id: string,
  isPaid: boolean,
  payments?: OrderPaymentLineInput[],
  actorId?: string | null,
  opts?: {
    /**
     * Le staff a confirmé avoir produit la quantité manquante — transmis à la
     * réservation quand cet encaissement pousse la commande en cuisine.
     */
    coverShortage?: boolean;
    /**
     * Encaisse sans pousser la commande en cuisine (ni réserver de stock). Sert
     * à enregistrer un paiement en ligne reçu alors que le stock manque : le
     * staff la lance ensuite, en confirmant la production.
     */
    skipKitchen?: boolean;
    /**
     * Règlement par Jèko : l'identifiant de transaction et les frais sont écrits
     * dans la MÊME écriture que `isPaid`. Une commande payée dont
     * `paymentTransactionId` est nul l'a donc été hors Jèko (caisse, MCP) — c'est
     * ce qui permet de signaler un paiement en ligne arrivé ensuite.
     */
    online?: {
      gatewayFee: number;
      paymentRequestId?: string;
      paymentTransactionId: string;
    };
  }
): Promise<{ startedPreparation: boolean }> {
  if (isPaid && (!payments || payments.length === 0)) {
    throw new OrderMutationError('payments requis quand isPaid=true', 400);
  }

  if (!isPaid) {
    const order = await prisma.order.findUnique({
      where: { id },
      select: { isPaid: true },
    });
    if (!order) {
      throw new OrderMutationError('Commande introuvable', 404);
    }
    if (order.isPaid === isPaid) {
      throw new OrderMutationError('État de paiement déjà à jour', 409);
    }

    const [result] = await prisma.$transaction([
      prisma.order.updateMany({
        where: { id, isPaid: true },
        data: {
          isPaid: false,
          paymentMode: null,
          paidAt: null,
          paymentAutoValidatedByAi: false,
          // L'annulation efface TOUTES les lignes `OrderPayment` ci-dessous, y
          // compris un éventuel acompte déjà versé : on remet aussi son suivi à
          // zéro pour ne pas laisser un montant orphelin, sans ligne pour
          // l'expliquer. Un dépaiement repart donc d'un acompte à reverser.
          depositPaid: 0,
          depositPaidAt: null,
        },
      }),
      prisma.orderPayment.deleteMany({ where: { orderId: id } }),
    ]);
    if (result.count === 0) {
      throw new OrderMutationError('État modifié entre temps, recharger', 409);
    }

    return { startedPreparation: false };
  }

  const now = new Date();
  let txResult: {
    startedPreparation: boolean;
    reserved: boolean;
    items: CartItem[];
    dailyNumber: number;
    reference: string;
  };
  try {
    txResult = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        select: {
          isPaid: true,
          status: true,
          items: true,
          total: true,
          dailyNumber: true,
          reference: true,
          pickupTime: true,
          depositPaid: true,
          depositRequired: true,
        },
      });
      if (!order) {
        throw new OrderMutationError('Commande introuvable', 404);
      }
      if (order.isPaid) {
        throw new OrderMutationError('État de paiement déjà à jour', 409);
      }

      // Un acompte déjà versé (cf. `recordDeposit`) compte comme déjà réglé :
      // ce règlement ne porte que sur le solde restant.
      const alreadyCollected = order.depositPaid ?? 0;
      const expected = order.total - alreadyCollected;
      const lines = payments as OrderPaymentLineInput[];
      const sum = lines.reduce((s, p) => s + p.amount, 0);
      if (sum !== expected) {
        throw new OrderMutationError(
          `Le total des paiements (${sum} F) ne correspond pas au solde de la commande (${expected} F)`,
          400
        );
      }

      // Une commande différée ne part PAS en cuisine à l'encaissement : sa
      // marchandise sera produite le jour du retrait. Un seul point de décision
      // — tout l'aval (réservation, statut, notification) en dépend déjà.
      const startedPreparation =
        !opts?.skipKitchen &&
        order.status === 'NEW' &&
        !isDeferredPickup(order.pickupTime, now);
      const items = order.items as unknown as CartItem[];

      // Le stock suit l'ENTRÉE EN CUISINE, pas l'argent : on ne réserve que
      // lorsque cet encaissement pousse effectivement la commande en cuisine.
      // Sinon (déjà en cuisine, prête, récupérée, ou programmée pour un autre
      // jour), l'encaissement est purement financier — la réservation a déjà eu
      // lieu, ou aura lieu à l'entrée.
      const reserved = startedPreparation
        ? await reserveStockOnce(tx, id, items, {
            coverShortage: opts?.coverShortage,
          })
        : false;

      const result = await tx.order.updateMany({
        // Quand cet encaissement pousse la commande en cuisine, l'écriture est
        // aussi gardée sur le statut NEW : si l'expiration d'un paiement en ligne
        // l'a annulée entre la lecture et ici, on ne la ressuscite pas (stock
        // réservé, en cuisine, fidélité déjà révoquée). Sans cette garde, le
        // paiement est refusé (409) et le webhook Jèko réessaie : la commande
        // annulée est alors encaissée comme un paiement tardif. Une commande déjà
        // annulée reste encaissable (startedPreparation faux : aucune garde).
        where: {
          id,
          isPaid: false,
          ...(startedPreparation ? { status: 'NEW' as const } : {}),
        },
        data: {
          isPaid: true,
          paymentMode: resolvePaymentMode(lines),
          paidAt: new Date(),
          // Plus aucun chemin automatique par IA : la colonne reste pour
          // l'historique des anciennes commandes (badge et retour arrière caisse).
          paymentAutoValidatedByAi: false,
          // Payée : plus rien à expirer. Sans cette remise à nul, un dépaiement
          // ultérieur laisserait `paymentExpiresAt` posé et la commande, redevenue
          // « non payée », disparaîtrait des vues staff (cf. STAFF_VISIBLE) puis
          // serait reprise par le job d'expiration.
          paymentExpiresAt: null,
          ...(opts?.online ?? {}),
          // Un règlement intégral couvre TOUJOURS l'acompte, puisqu'il couvre
          // le total (cf. le commentaire de `sendOrderToKitchen` ci-dessous).
          // Sans cette écriture, une commande à acompte payée en une fois
          // AVANT son entrée en cuisine (ex. retrait différé, où
          // `startedPreparation` est faux malgré `isPaid: true`) restait
          // bloquée en 409 « acompte requis » le jour du retrait, alors même
          // qu'elle était déjà soldée.
          ...(order.depositRequired != null
            ? { depositPaid: order.total, depositPaidAt: new Date() }
            : {}),
          // Encaisser une commande encore NEW la pousse en cuisine : on amorce
          // alors le chrono « en cuisine depuis X » au même instant.
          ...(startedPreparation
            ? { status: 'PREPARING' as const, preparingStartedAt: new Date() }
            : {}),
        },
      });

      if (result.count === 0) {
        throw new OrderMutationError(
          'État modifié entre temps, recharger',
          409
        );
      }

      await tx.orderPayment.createMany({
        data: lines.map((p) => ({
          orderId: id,
          mode: p.mode,
          amount: p.amount,
          createdById: actorId ?? null,
        })),
      });

      return {
        startedPreparation,
        reserved,
        items,
        dailyNumber: order.dailyNumber,
        reference: order.reference,
      };
    });
  } catch (err) {
    // Règlement Jèko (`opts.online`) : le client a DÉJÀ payé et l'appelant rejoue
    // en `skipKitchen` — lui annoncer « article indisponible » serait faux.
    if (err instanceof StockShortageError && !opts?.online) {
      // Client perdant (stock insuffisant) : notifié AVANT que la 409 ne
      // remonte à l'appelant (route/action) — best-effort, jamais bloquant.
      notifyOrderCustomer(id, 'ITEM_UNAVAILABLE');
    }
    throw err;
  }

  // Client abonné : paiement validé (fusionné avec le départ en cuisine quand
  // l'encaissement fait aussi passer NEW → PREPARING).
  notifyOrderCustomer(
    id,
    txResult.startedPreparation ? 'PAYMENT_PREPARING' : 'PAYMENT'
  );

  // La commande vient d'entrer en cuisine : prévenir la cuisine, comme le fait
  // `sendOrderToKitchen` pour l'envoi manuel.
  if (txResult.startedPreparation) {
    notifyKitchen({
      id,
      dailyNumber: txResult.dailyNumber,
      reference: txResult.reference,
      items: txResult.items,
    });
  }

  // Fan-out best-effort : si CET appel a réellement réservé du stock et qu'il
  // vient d'épuiser un produit/option, avertir tout de suite les autres clients
  // dont la commande en attente en dépend (cf. notifyPendingOrdersOfShortage).
  if (txResult.reserved) {
    notifyPendingOrdersOfShortage(id, txResult.items).catch((err) => {
      console.error('[order-mutations] fan-out stock épuisé échoué :', err);
    });
  }

  return { startedPreparation: txResult.startedPreparation };
}
