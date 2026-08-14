// lib/order-mutations.ts
//
// Logique de mutation des commandes « caisse / administration », partagée entre
// les routes API caisse, les server actions du dashboard et les outils MCP.
// Aucune de ces couches ne réimplémente la logique métier : elles branchent
// toutes les fonctions ci-dessous.
//
// Création (`createCashierOrder`) — différences avec `createOrder`
// (lib/orders.ts, flux online public) :
//   - `customerName` / `customerPhone` optionnels (commande anonyme possible)
//   - `orderType` libre (DELIVERY / DINE_IN / TAKEAWAY)
//   - `note` possible
//   - ANTIDATAGE : `orderDate` (YYYY-MM-DD) permet de rattacher la commande à un
//     jour civil passé. Absent = jour en cours. Le `createdAt` est alors aligné
//     sur ce jour pour conserver un tri chronologique cohérent dans l'historique.
//
// Statut (`setOrderStatus`) et paiement (`setOrderPayment`) : transitions
// validées (rôle / `canTransition`), concurrence optimiste, et auto-passage en
// cuisine (NEW → PREPARING) lors de l'encaissement d'une commande encore NEW.
//
// RÉSERVATION DE STOCK : elle a lieu à l'ENTRÉE EN CUISINE (et non plus à
// l'encaissement), car c'est là que la marchandise est réellement consommée —
// et parce qu'une commande peut partir en cuisine sans paiement (« ardoise »).
// Point d'entrée unique : `sendOrderToKitchen`. Le verrou d'idempotence est la
// colonne `Order.stockReservedAt` (cf. `reserveStockOnce`).

import { Prisma } from '@/generated/prisma/client';
import type {
  OrderSource,
  OrderStatus,
  PaymentMode,
  PaymentProofVerdict,
  UserRole,
} from '@/generated/prisma/client';
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
import { getOrderLoyaltyOutcome } from '@/lib/loyalty';
import { getLoyaltySettings } from '@/lib/loyalty-settings-db';
import { computePickupMessage } from '@/lib/loyalty-messaging';
import { canTransition, canTogglePayment } from '@/lib/order-permissions';
import { normalizeIvorianPhone } from '@/lib/phone';
import { computeItemsTotal, getMaxItemDiscount } from '@/lib/orders/totals';
import { fetchStockSnapshot, optionKey } from '@/lib/orders/availability';
import { parseDateOnlyToUTC } from '@/lib/timezone';
import { getMenuAdmin } from '@/lib/menu';
import { cartItemSchema, updateOrderDetailsSchema } from '@/lib/schemas/order';
import type { CartItem } from '@/lib/cart-store';
import type {
  CartItemInput,
  OrderTypeInput,
  OrderPaymentLineInput,
} from '@/lib/schemas/order';
import { ROLE_GROUPS } from '@/lib/auth-helpers';
import { notifyOrderCustomer, sendPushToRoles } from '@/lib/push-notify';
import { getPickupCode } from '@/lib/orders/format';

/**
 * Notifications push (best-effort) : une notification manquée ne doit jamais
 * faire échouer la mutation qui l'a déclenchée.
 */
function notifyPush(
  roles: (typeof ROLE_GROUPS)[keyof typeof ROLE_GROUPS],
  payload: Parameters<typeof sendPushToRoles>[1]
): void {
  sendPushToRoles(roles, payload).catch((err) => {
    console.error('[order-mutations] notification push échouée :', err);
  });
}

/**
 * Push « la cuisine a du travail ». Jusqu'ici SEULE la caisse recevait des
 * notifications : la cuisine n'avait que le carillon de sa page, donc écran
 * verrouillé ou onglet en arrière-plan = commande ratée.
 *
 * Cible `KITCHEN_STAFF` (= KITCHEN_PLUS sans CASHIER, cf. lib/auth-helpers.ts)
 * pour ne pas re-notifier le caissier, qui a déjà reçu « nouvelle commande » et
 * qui est généralement celui qui déclenche l'envoi.
 *
 * `tag` par commande : une ré-entrée en cuisine après un undo REMPLACE la
 * notification précédente sur l'appareil au lieu de s'empiler.
 */
function notifyKitchen(order: {
  id: string;
  dailyNumber: number;
  reference: string;
  items: CartItem[];
}): void {
  // Nombre d'articles réellement à produire (somme des quantités), pas le
  // nombre de lignes du panier : c'est la charge de travail qui parle à la
  // cuisine.
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  notifyPush(ROLE_GROUPS.KITCHEN_STAFF, {
    title: 'Nouvelle commande en cuisine',
    body:
      `#${String(order.dailyNumber).padStart(3, '0')}` +
      ` · ${getPickupCode(order.reference)}` +
      ` · ${itemCount} article${itemCount > 1 ? 's' : ''}`,
    url: '/dashboard/preparation',
    tag: `order-kitchen-${order.id}`,
  });
}

/**
 * Erreur métier portant un code HTTP, pour que les routes API renvoient le bon
 * statut (404/403/409/400) sans réécrire la logique. Côté server action / MCP,
 * le message suffit.
 */
export class OrderMutationError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number
  ) {
    super(message);
    this.name = 'OrderMutationError';
  }
}

/**
 * Erreur spécifique au décrément de stock au paiement (toujours 409) —
 * distincte de `OrderMutationError` générique pour que `setOrderPayment` /
 * `payAndComplete` sachent QUAND notifier le client perdant (`ITEM_UNAVAILABLE`)
 * sans confondre avec les autres 409 (déjà payé, conflit de concurrence).
 */
export class StockShortageError extends OrderMutationError {
  constructor(message: string) {
    super(message, 409);
    this.name = 'StockShortageError';
  }
}

// ─── Décrément du stock (le cœur anti-survente) ───────────────────────────────
//
// N'A QU'UN SEUL APPELANT : `reserveStockOnce` (juste en dessous), qui garantit
// que le décrément a lieu AU PLUS UNE FOIS par commande. Ne jamais l'appeler
// directement — sans le verrou `Order.stockReservedAt`, deux chemins menant en
// cuisine (encaissement d'une commande NEW, envoi manuel, ardoise, undo puis
// renvoi) décrémenteraient deux fois le même panier.
//
// Décrémente le stock produit ET options DANS LA MÊME transaction que
// l'écriture appelante : la garde conditionnelle (`updateMany` avec
// `stockQuantity: { gte: besoin }` OU `null`) sérialise la concurrence sur la
// dernière unité — un seul appelant gagne, l'autre voit `count !== 1` et lève
// `StockShortageError`, qui fait échouer (rollback) toute la transaction :
// opération refusée, RIEN décrémenté, aucun statut/paiement écrit.
//
// `stockQuantity === null` = illimité : le `OR` laisse passer ce cas sans
// jamais bloquer, et l'arithmétique SQL (`NULL - n = NULL`) laisse la colonne
// inchangée après le `decrement` — pas besoin de branche séparée.
//
// Options résolues par (produit, nom de groupe, nom d'option) puisque le
// panier ne connaît pas les id internes des options — MAIS deux options
// peuvent légitimement porter le même nom dans un même groupe (ex. un ancien
// « goût » désactivé conservé après renommage, cf. `updateSupplementGroups`
// qui apparie par nom). Un `updateMany` par nom matcherait alors les deux
// lignes à la fois : `count` vaudrait 2 et non 1, et un paiement pourtant
// honorable serait refusé à tort. On résout donc d'abord l'id de l'option
// *disponible* (déterministe, la plus ancienne) avant de décrémenter cet id
// précis — la garde atomique et la sérialisation de concurrence restent
// intactes, seule l'ambiguïté du nom est levée en amont.
// Logs temporaires de diagnostic (bug « le stock ne bouge pas à l'entrée en
// cuisine ») : à retirer une fois la cause confirmée en conditions réelles —
// `lib/order-mutations.test.ts` mocke Prisma et ne peut pas révéler un
// décalage au niveau SQL/données réelles, d'où le besoin de logs serveur.
function logStock(orderId: string, message: string, extra?: object): void {
  console.info(`[stock] ${orderId} ${message}`, extra ?? '');
}

async function decrementStockForOrderItems(
  tx: Prisma.TransactionClient,
  orderId: string,
  items: CartItem[]
): Promise<void> {
  for (const item of items) {
    const productResult = await tx.product.updateMany({
      where: {
        id: item.productId,
        OR: [
          { stockQuantity: null },
          { stockQuantity: { gte: item.quantity } },
        ],
      },
      data: { stockQuantity: { decrement: item.quantity } },
    });
    logStock(orderId, 'décrément produit', {
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      matchedRows: productResult.count,
    });
    if (productResult.count !== 1) {
      throw new StockShortageError(
        `Stock insuffisant pour « ${item.productName} »`
      );
    }

    for (const supplement of item.supplements) {
      const needed = (supplement.quantity ?? 1) * item.quantity;
      const option = await tx.supplementOption.findFirst({
        where: {
          name: supplement.optionName,
          available: true,
          // Le groupe peut être propre au produit OU global (« Extras »,
          // `isGlobal: true`, sans `productId`) — voir prisma/schema.prisma.
          group: {
            name: supplement.groupName,
            OR: [{ productId: item.productId }, { isGlobal: true }],
          },
        },
        orderBy: { id: 'asc' },
        select: { id: true },
      });
      if (!option) {
        throw new StockShortageError(
          `Option indisponible pour « ${item.productName} — ${supplement.optionName} »`
        );
      }
      const optionResult = await tx.supplementOption.updateMany({
        where: {
          id: option.id,
          OR: [{ stockQuantity: null }, { stockQuantity: { gte: needed } }],
        },
        data: { stockQuantity: { decrement: needed } },
      });
      logStock(orderId, 'décrément option', {
        optionId: option.id,
        optionName: supplement.optionName,
        needed,
        matchedRows: optionResult.count,
      });
      if (optionResult.count !== 1) {
        throw new StockShortageError(
          `Stock insuffisant pour « ${item.productName} — ${supplement.optionName} »`
        );
      }
    }
  }
}

// Agrège une liste d'articles en demande totale par produit et par option
// (toutes lignes confondues) — sert de base au calcul de delta de
// `decrementStockDelta` ci-dessous. Réutilise `optionKey` (même clé que
// `notifyPendingOrdersOfShortage`) pour désigner une option indépendamment du
// produit qui la référence (globale ou non).
type ItemDemand = {
  products: Map<string, { productName: string; quantity: number }>;
  options: Map<
    string,
    { productId: string; groupName: string; optionName: string; needed: number }
  >;
};

function aggregateItemDemand(items: CartItem[]): ItemDemand {
  const products: ItemDemand['products'] = new Map();
  const options: ItemDemand['options'] = new Map();
  for (const item of items) {
    const p = products.get(item.productId);
    products.set(item.productId, {
      productName: item.productName,
      quantity: (p?.quantity ?? 0) + item.quantity,
    });
    for (const s of item.supplements) {
      const key = optionKey(item.productId, s.groupName, s.optionName);
      const needed = (s.quantity ?? 1) * item.quantity;
      const o = options.get(key);
      options.set(key, {
        productId: item.productId,
        groupName: s.groupName,
        optionName: s.optionName,
        needed: (o?.needed ?? 0) + needed,
      });
    }
  }
  return { products, options };
}

/**
 * Décrémente le SURPLUS de demande entre deux snapshots d'articles d'une
 * commande DONT LE STOCK A DÉJÀ ÉTÉ RÉSERVÉ (`Order.stockReservedAt` posé) —
 * sert à `updateOrderItems` (« Modifier les articles ») quand une quantité
 * augmente APRÈS l'entrée en cuisine (ex. le client rajoute 2 cafés) : cette
 * hausse n'a jamais été décomptée par `reserveStockOnce`, qui ne décrémente
 * qu'une fois, à la toute première réservation.
 *
 * Ne restitue JAMAIS de stock côté baisse (delta négatif ignoré) — même
 * invariant « décrémenté au plus une fois, jamais ré-incrémenté » que
 * `sendOrderToKitchen` (un plat retiré après être parti en cuisine est de
 * toute façon potentiellement déjà engagé).
 */
async function decrementStockDelta(
  tx: Prisma.TransactionClient,
  orderId: string,
  previousItems: CartItem[],
  nextItems: CartItem[]
): Promise<void> {
  const before = aggregateItemDemand(previousItems);
  const after = aggregateItemDemand(nextItems);

  for (const [productId, { productName, quantity }] of after.products) {
    const delta = quantity - (before.products.get(productId)?.quantity ?? 0);
    if (delta <= 0) continue;
    const result = await tx.product.updateMany({
      where: {
        id: productId,
        OR: [{ stockQuantity: null }, { stockQuantity: { gte: delta } }],
      },
      data: { stockQuantity: { decrement: delta } },
    });
    logStock(orderId, 'décrément produit (delta édition)', {
      productId,
      productName,
      delta,
      matchedRows: result.count,
    });
    if (result.count !== 1) {
      throw new StockShortageError(
        `Stock insuffisant pour « ${productName} »`
      );
    }
  }

  for (const [
    key,
    { productId, groupName, optionName, needed },
  ] of after.options) {
    const delta = needed - (before.options.get(key)?.needed ?? 0);
    if (delta <= 0) continue;
    const option = await tx.supplementOption.findFirst({
      where: {
        name: optionName,
        available: true,
        group: { name: groupName, OR: [{ productId }, { isGlobal: true }] },
      },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    const productName = after.products.get(productId)?.productName ?? '';
    if (!option) {
      throw new StockShortageError(
        `Option indisponible pour « ${productName} — ${optionName} »`
      );
    }
    const result = await tx.supplementOption.updateMany({
      where: {
        id: option.id,
        OR: [{ stockQuantity: null }, { stockQuantity: { gte: delta } }],
      },
      data: { stockQuantity: { decrement: delta } },
    });
    logStock(orderId, 'décrément option (delta édition)', {
      optionId: option.id,
      optionName,
      delta,
      matchedRows: result.count,
    });
    if (result.count !== 1) {
      throw new StockShortageError(
        `Stock insuffisant pour « ${productName} — ${optionName} »`
      );
    }
  }
}

/**
 * Réserve (décrémente) le stock d'une commande AU PLUS UNE FOIS, quel que soit
 * le nombre de chemins qui y mènent. Renvoie `true` si CET appel a réellement
 * décrémenté, `false` si la réservation avait déjà eu lieu.
 *
 * Le statut ne peut pas servir de témoin : plusieurs chemins mènent en cuisine,
 * plusieurs transitions sont réversibles (undo `PREPARING → NEW`, reprise
 * `CANCELLED → NEW` puis renvoi en cuisine) et `payAndComplete` fait
 * NEW → COMPLETED sans jamais passer par PREPARING. D'où la colonne dédiée
 * `Order.stockReservedAt`.
 *
 * ORDRE IMPÉRATIF — on REVENDIQUE le verrou AVANT de décrémenter, via un
 * `UPDATE ... WHERE stockReservedAt IS NULL` conditionnel, et JAMAIS via un
 * `findUnique` suivi d'un test en mémoire : sous READ COMMITTED, deux
 * transactions concurrentes qui émettent le même `updateMany` conditionnel se
 * sérialisent sur le verrou de ligne, et la seconde ré-évalue le prédicat
 * après le commit de la première — elle obtient donc `count = 0`. Un
 * lire-puis-tester laisserait au contraire passer les deux (les deux lectures
 * voient `null` avant toute écriture). C'est exactement la technique déjà
 * employée par `decrementStockForOrderItems` (garde `stockQuantity >= besoin`)
 * et par la garde optimiste de `setOrderStatus`.
 *
 * Une pénurie lève `StockShortageError` APRÈS la revendication : le rollback
 * de la transaction annule aussi la pose du verrou, donc rien n'est perdu.
 */
async function reserveStockOnce(
  tx: Prisma.TransactionClient,
  orderId: string,
  items: CartItem[]
): Promise<boolean> {
  const claim = await tx.order.updateMany({
    where: { id: orderId, stockReservedAt: null },
    data: { stockReservedAt: new Date() },
  });
  logStock(orderId, 'revendication du verrou', { claimed: claim.count === 1 });
  if (claim.count === 0) return false;

  await decrementStockForOrderItems(tx, orderId, items);
  return true;
}

// ─── Fan-out best-effort : commandes en attente affectées ─────────────────────
//
// APRÈS commit seulement (jamais dans la transaction qui réserve) : si la
// réservation qui vient de réussir a fait tomber un produit/option à 0, les
// autres commandes dont le stock n'est PAS encore réservé et qui en dépendent
// ne pourront plus être honorées telles quelles — on les avertit sans attendre
// le prochain polling/SSE. Fire-and-forget : un échec ici ne doit jamais
// remonter (la réservation, elle, a déjà réussi).
//
// Candidates = `stockReservedAt: null` (et non `isPaid: false`) : une commande
// impayée déjà partie en cuisine a son stock réservé, elle n'est donc pas en
// danger et ne doit surtout pas recevoir un « article indisponible ».
async function notifyPendingOrdersOfShortage(
  reservedOrderId: string,
  reservedItems: CartItem[]
): Promise<void> {
  const snapshot = await fetchStockSnapshot([reservedItems]);

  const zeroedProductIds = new Set(
    [...snapshot.products.entries()]
      .filter(([, qty]) => qty === 0)
      .map(([id]) => id)
  );
  const zeroedOptionKeys = new Set(
    [...snapshot.options.entries()]
      .filter(([, qty]) => qty === 0)
      .map(([key]) => key)
  );
  if (zeroedProductIds.size === 0 && zeroedOptionKeys.size === 0) return;

  const candidates = await prisma.order.findMany({
    where: {
      id: { not: reservedOrderId },
      stockReservedAt: null,
      status: { notIn: ['CANCELLED', 'COMPLETED'] },
    },
    select: { id: true, items: true },
    take: 200,
  });

  for (const candidate of candidates) {
    const items = candidate.items as unknown as CartItem[];
    const affected = items.some((item) => {
      if (zeroedProductIds.has(item.productId)) return true;
      return item.supplements.some((s) =>
        zeroedOptionKeys.has(
          optionKey(item.productId, s.groupName, s.optionName)
        )
      );
    });
    if (affected) {
      notifyOrderCustomer(candidate.id, 'ITEM_UNAVAILABLE');
    }
  }
}

export type CreateCashierOrderInput = {
  items: CartItemInput[];
  customerName?: string | null;
  customerPhone?: string | null;
  orderType: OrderTypeInput;
  note?: string | null;
  pickupTime?: string | null;
  /** Jour civil d'antidatage (YYYY-MM-DD). Absent = jour en cours. */
  orderDate?: string | null;
  /** Utilisateur caisse à l'origine ; null pour un outil MCP. */
  createdById?: string | null;
  /**
   * Origine de création (cf. enum `OrderSource`, prisma/schema.prisma).
   * Défaut `CASHIER` (l'appelant caisse le plus courant) ; l'outil MCP
   * `create_order` (lib/mcp/tools.ts) passe explicitement `MCP`.
   */
  source?: OrderSource;
  /** Récompense fidélité (carte à tampons) à appliquer à cette commande. */
  loyaltyRewardId?: string | null;
  /**
   * Force l'« ardoise » (envoi direct en cuisine sans encaissement) même si le
   * client n'est pas marqué de confiance — dérogation du caissier pour un
   * walk-in qu'il connaît. Absent = on suit `Customer.isTrusted`.
   */
  onAccount?: boolean;
};

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
 * ARDOISE À LA CRÉATION : si le client résolu est de confiance
 * (`Customer.isTrusted`) — ou si le caissier force via `input.onAccount` — la
 * commande est créée DIRECTEMENT en `PREPARING`, marquée `isOnAccount`, et son
 * stock est réservé dans la MÊME transaction. Elle reste `isPaid: false` : ce
 * n'est PAS un paiement, seulement un non-blocage (cf. `Order.isOnAccount`).
 * Une pénurie lève alors `StockShortageError` (409) et annule toute la
 * création — la commande n'existe pas, rien n'a été décrémenté.
 *
 * L'ANTIDATAGE SUPPRIME CE COMPORTEMENT, exactement comme il supprime le push
 * « nouvelle commande » : une saisie de rattrapage n'est pas un événement en
 * direct, elle ne doit ni réveiller la cuisine ni décrémenter le stock
 * d'aujourd'hui pour un plat servi la semaine dernière.
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

  const grossTotal = computeItemsTotal(input.items as CartItem[]);

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
        const goToKitchen = (input.onAccount ?? trusted) && !isBackdated;

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
          await reserveStockOnce(tx, created.id, input.items as CartItem[]);
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

        if (customerId) {
          await awardLoyaltyForOrder(tx, {
            customerId,
            orderId: created.id,
            orderTotal: total,
            actorId: input.createdById ?? null,
          });
        }

        return created;
      });

      // Pas de notification pour une commande antidatée : ce n'est pas un
      // événement en direct, juste une saisie de rattrapage.
      if (!isBackdated) {
        notifyPush(ROLE_GROUPS.DASHBOARD, {
          title: 'Nouvelle commande',
          body: `#${created.dailyNumber} · ${created.total} FCFA${created.customerName ? ` · ${created.customerName}` : ''}`,
          url: '/dashboard/caisse',
          tag: `order-${created.id}`,
        });

        // Ardoise : la commande est née en cuisine, il faut aussi réveiller la
        // cuisine — le push « nouvelle commande » ci-dessus va à la caisse et
        // ne suffit pas (mêmes destinataires que `sendOrderToKitchen`).
        if (created.status === 'PREPARING') {
          notifyKitchen({
            id: created.id,
            dailyNumber: created.dailyNumber,
            reference: created.reference,
            items: created.items as unknown as CartItem[],
          });
        }
      }

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

// ─── Construction d'articles depuis le menu (références produit → lignes) ──────
//
// Pour l'outil MCP : un client comme Claude ne fournit que `productId` + quantité
// (+ suppléments par nom) ; on résout prix de base, coûts et prix des suppléments
// depuis le menu (source de vérité), évitant au client de connaître les montants.

export type OrderItemRef = {
  productId: string;
  quantity: number;
  /**
   * Suppléments choisis, par nom de groupe + nom d'option (prix résolu ici).
   * `quantity` (défaut 1) sert aux groupes type 'quantity' (répartition,
   * ex. 2x un goût).
   */
  supplements?: { groupName: string; optionName: string; quantity?: number }[];
  /** Remise (montant fixe FCFA) appliquée à la ligne. */
  discount?: number;
  discountReason?: string | null;
};

/**
 * Transforme des références produit en lignes de panier complètes en résolvant
 * les montants depuis le menu. Lève une erreur si un produit ou un supplément
 * est introuvable. Le résultat est validé par `cartItemSchema` (plafond de
 * remise, entiers, etc.).
 */
export async function buildOrderItemsFromMenu(
  refs: OrderItemRef[]
): Promise<CartItemInput[]> {
  const menu = await getMenuAdmin();
  const products = new Map(
    menu.flatMap((c) => c.products).map((p) => [p.id, p])
  );

  const items = refs.map((ref, idx) => {
    const product = products.get(ref.productId);
    if (!product) {
      throw new Error(`Produit introuvable : ${ref.productId}`);
    }

    const supplements = (ref.supplements ?? []).map((s) => {
      const group = product.supplements.find((g) => g.name === s.groupName);
      // Deux options peuvent partager un nom dans un même groupe (renommage,
      // ancien « goût » désactivé conservé) : on préfère toujours l'option
      // disponible, cohérent avec le décrément au paiement (§ ci-dessus).
      const option =
        group?.options.find((o) => o.name === s.optionName && o.available) ??
        group?.options.find((o) => o.name === s.optionName);
      if (!group || !option) {
        throw new Error(
          `Supplément introuvable pour « ${product.name} » : ` +
            `${s.groupName} / ${s.optionName}`
        );
      }
      return {
        groupName: group.name,
        optionName: option.name,
        price: option.price,
        quantity: s.quantity ?? 1,
      };
    });

    return cartItemSchema.parse({
      cartId: `mcp-${idx}`,
      productId: product.id,
      productName: product.name,
      basePrice: product.price,
      coutMatiere: product.coutMatiere,
      coutEmballage: product.coutEmballage,
      quantity: ref.quantity,
      supplements,
      discount: ref.discount ?? 0,
      discountReason: ref.discountReason ?? null,
    });
  });

  return items;
}

// ─── Entrée en cuisine (point d'entrée UNIQUE de la réservation de stock) ─────

/**
 * Envoie une commande en cuisine (→ `PREPARING`) et RÉSERVE son stock, une
 * seule fois. C'est le seul endroit du code où une commande entre en cuisine :
 * `setOrderStatus(id, 'PREPARING', role)` y délègue, `setOrderPayment` en
 * reprend la mécanique quand l'encaissement pousse une commande NEW en
 * cuisine, et l'écran cuisine passe par `setOrderStatus`.
 *
 * `opts.onAccount` : envoi « ardoise », c'est-à-dire SANS encaissement (client
 * de confiance ou dérogation caissier). Ce n'est pas un paiement : `isPaid`
 * reste `false`, seul `isOnAccount` est posé.
 *
 * POURQUOI l'annulation NE LIBÈRE PAS la réservation (aucune ré-incrémentation,
 * ici comme dans `setOrderStatus` / le dépaiement) :
 *   1. cela préserve l'invariant « décrémenté au plus une fois, jamais
 *      ré-incrémenté », qui rend TOUS les chemins d'undo sûrs par construction
 *      (undo `PREPARING → NEW` puis renvoi en cuisine, reprise d'une commande
 *      annulée, encaissement après coup…) ;
 *   2. un plat annulé en cours de préparation est de toute façon perdu ;
 *   3. libérer ferait échouer `CANCELLED → PREPARING` avec un 409 sur ce que
 *      l'interface présente comme un simple undo.
 * Le réapprovisionnement explicite existe déjà par ailleurs
 * (`/api/caisse/restock`).
 *
 * Lève `OrderMutationError` (404 introuvable, 403 transition refusée, 409
 * conflit de concurrence) ou `StockShortageError` (409 — le client est alors
 * notifié `ITEM_UNAVAILABLE` avant que l'erreur ne remonte).
 */
export async function sendOrderToKitchen(
  id: string,
  role: UserRole,
  opts?: { onAccount?: boolean }
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      status: true,
      items: true,
      dailyNumber: true,
      reference: true,
    },
  });
  if (!order) {
    throw new OrderMutationError('Commande introuvable', 404);
  }

  if (!canTransition(order.status, 'PREPARING', role)) {
    throw new OrderMutationError(
      `Transition non autorisée : ${order.status} → PREPARING`,
      403
    );
  }

  const items = order.items as unknown as CartItem[];

  let reserved: boolean;
  try {
    reserved = await prisma.$transaction(async (tx) => {
      // Réservation AVANT l'écriture du statut : une pénurie fait échouer la
      // transaction entière, la commande reste donc là où elle était.
      const claimed = await reserveStockOnce(tx, id, items);

      const result = await tx.order.updateMany({
        where: { id, status: order.status },
        data: {
          status: 'PREPARING',
          preparingStartedAt: new Date(),
          ...(opts?.onAccount ? { isOnAccount: true } : {}),
        },
      });
      if (result.count === 0) {
        throw new OrderMutationError(
          'État déjà modifié par un autre caissier',
          409
        );
      }

      return claimed;
    });
  } catch (err) {
    if (err instanceof StockShortageError) {
      // Client perdant (stock insuffisant) : notifié AVANT que la 409 ne
      // remonte à l'appelant — best-effort, jamais bloquant.
      notifyOrderCustomer(id, 'ITEM_UNAVAILABLE');
    }
    throw err;
  }

  notifyOrderCustomer(id, 'PREPARING');
  notifyKitchen({
    id,
    dailyNumber: order.dailyNumber,
    reference: order.reference,
    items,
  });

  // Fan-out uniquement si CET appel a réellement décrémenté : une ré-entrée en
  // cuisine (après undo) ne change rien au stock, donc rien à annoncer.
  if (reserved) {
    notifyPendingOrdersOfShortage(id, items).catch((err) => {
      console.error('[order-mutations] fan-out stock épuisé échoué :', err);
    });
  }
}

// ─── Changement de statut ─────────────────────────────────────────────────────

/**
 * Fait transitionner une commande vers `newStatus`. Vérifie l'autorisation
 * (`canTransition` selon le rôle) et applique une concurrence optimiste : la
 * mise à jour n'a lieu que si le statut courant n'a pas changé entre temps.
 *
 * Cible `PREPARING` : délègue intégralement à `sendOrderToKitchen`, qui réserve
 * le stock. Aucune autre cible ne touche au stock (une annulation ne libère
 * JAMAIS la réservation — voir `sendOrderToKitchen` pour le pourquoi).
 *
 * Lève `OrderMutationError` (404 introuvable, 403 transition refusée, 409
 * conflit) ou `StockShortageError` (409, uniquement vers `PREPARING`) — à
 * mapper en réponse HTTP par les routes.
 */
export async function setOrderStatus(
  id: string,
  newStatus: OrderStatus,
  role: UserRole
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      status: true,
      dailyNumber: true,
      customerId: true,
      isPaid: true,
    },
  });
  if (!order) {
    throw new OrderMutationError('Commande introuvable', 404);
  }

  if (!canTransition(order.status, newStatus, role)) {
    throw new OrderMutationError(
      `Transition non autorisée : ${order.status} → ${newStatus}`,
      403
    );
  }

  // Entrée en cuisine : un seul point d'entrée, qui réserve le stock (voir
  // `sendOrderToKitchen`). La validation de rôle vient d'avoir lieu ci-dessus,
  // `sendOrderToKitchen` la refait — c'est volontairement redondant : elle
  // reste ainsi correcte quand elle est appelée directement (ardoise).
  if (newStatus === 'PREPARING') {
    return sendOrderToKitchen(id, role);
  }

  // Remettre une commande ANNULÉE « à encaisser » n'a de sens que si elle n'a
  // jamais été encaissée : une annulation après paiement vaut remboursement,
  // et la replacer en NEW réclamerait un second encaissement du même montant.
  // Seule la cible NEW est bloquée : CANCELLED → READY/COMPLETED reste
  // disponible pour défaire un remboursement déclenché par erreur.
  if (order.status === 'CANCELLED' && newStatus === 'NEW' && order.isPaid) {
    throw new OrderMutationError(
      'Commande remboursée : impossible de la remettre à encaisser',
      409
    );
  }

  // Reconnaissance fidélité combinée à la confirmation « commande prête » :
  // calculée AVANT le `updateMany` (le tampon a déjà été attribué à la
  // création, cf. `awardLoyaltyForOrder` — on ne fait ici que relire ce qui a
  // été tracé au ledger, jamais de nouvelle attribution).
  let readyBodyOverride: string | undefined;
  if (newStatus === 'READY' && order.customerId) {
    const [settings, outcome] = await Promise.all([
      getLoyaltySettings(),
      getOrderLoyaltyOutcome(order.customerId, id),
    ]);
    if (outcome) {
      readyBodyOverride = computePickupMessage({ settings, ...outcome });
    }
  }

  const result = await prisma.order.updateMany({
    where: { id, status: order.status },
    data: {
      status: newStatus,
      // Horodatage du minuteur « prête depuis X ». L'amorce du chrono « en
      // cuisine depuis X » (`preparingStartedAt`) vit dans
      // `sendOrderToKitchen`, seul chemin vers PREPARING (voir le court-circuit
      // ci-dessus).
      ...(newStatus === 'READY' ? { readyAt: new Date() } : {}),
      // Retour en NEW (undo d'une mise en cuisine, ou reprise d'une commande
      // annulée) : on remet les minuteurs à zéro. Sinon la commande revient
      // avec un « en cuisine depuis 3 h » périmé et, pire, pollue la clé de tri
      // FIFO cuisine (`preparingStartedAt`, cf. lib/orders/queue-order.ts) dès
      // sa prochaine entrée en cuisine.
      ...(newStatus === 'NEW'
        ? { preparingStartedAt: null, readyAt: null }
        : {}),
    },
  });

  if (result.count === 0) {
    throw new OrderMutationError(
      'État déjà modifié par un autre caissier',
      409
    );
  }

  // La caisse remet la commande au client : on l'alerte quand elle est prête.
  if (newStatus === 'READY') {
    notifyPush(ROLE_GROUPS.CASHIER_PLUS, {
      title: 'Commande prête',
      body: `#${order.dailyNumber} prête à récupérer`,
      url: '/dashboard/caisse',
      tag: `order-ready-${id}`,
    });
  }

  // Client abonné depuis la page de suivi : chaque étape le concerne
  // (préparation, prête, récupérée, annulée). NEW n'est jamais une cible ici.
  if (newStatus !== 'NEW') {
    notifyOrderCustomer(id, newStatus, readyBodyOverride);
  }
}

// ─── Encaissement / paiement ──────────────────────────────────────────────────

/**
 * Résout le `paymentMode` « résumé » d'un ensemble de lignes de paiement :
 * le mode lui-même si les lignes partagent toutes le même mode (cas courant,
 * 1 seule ligne ou plusieurs lignes du même mode), `null` sinon (paiement
 * fractionné sur 2+ modes distincts — le détail vit dans `OrderPayment`).
 */
function resolvePaymentMode(
  payments: OrderPaymentLineInput[]
): PaymentMode | null {
  const distinctModes = new Set(payments.map((p) => p.mode));
  return distinctModes.size === 1 ? payments[0].mode : null;
}

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
     * Vrai UNIQUEMENT quand cet encaissement provient de la pré-analyse IA
     * (verdict MATCH, cf. lib/ai/payment-proof.ts) plutôt que d'un geste
     * caisse. Persisté sur `Order.paymentAutoValidatedByAi` pour piloter le
     * bouton de retour en arrière dédié côté caisse. Ignoré si `isPaid` est
     * faux (le dépaiement remet toujours ce drapeau à `false`).
     */
    autoValidatedByAi?: boolean;
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
        },
      }),
      prisma.orderPayment.deleteMany({ where: { orderId: id } }),
    ]);
    if (result.count === 0) {
      throw new OrderMutationError('État modifié entre temps, recharger', 409);
    }

    return { startedPreparation: false };
  }

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
        },
      });
      if (!order) {
        throw new OrderMutationError('Commande introuvable', 404);
      }
      if (order.isPaid) {
        throw new OrderMutationError('État de paiement déjà à jour', 409);
      }

      const lines = payments as OrderPaymentLineInput[];
      const sum = lines.reduce((s, p) => s + p.amount, 0);
      if (sum !== order.total) {
        throw new OrderMutationError(
          `Le total des paiements (${sum} F) ne correspond pas au montant de la commande (${order.total} F)`,
          400
        );
      }

      const startedPreparation = order.status === 'NEW';
      const items = order.items as unknown as CartItem[];

      // Le stock suit l'ENTRÉE EN CUISINE, pas l'argent : on ne réserve que
      // lorsque cet encaissement pousse effectivement la commande en cuisine.
      // Sinon (déjà en cuisine, prête, récupérée), l'encaissement est purement
      // financier — la réservation a déjà eu lieu, ou aura lieu à l'entrée.
      const reserved = startedPreparation
        ? await reserveStockOnce(tx, id, items)
        : false;

      const result = await tx.order.updateMany({
        where: { id, isPaid: false },
        data: {
          isPaid: true,
          paymentMode: resolvePaymentMode(lines),
          paidAt: new Date(),
          paymentAutoValidatedByAi: opts?.autoValidatedByAi ?? false,
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
    if (err instanceof StockShortageError) {
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

// ─── Édition administrative des métadonnées ───────────────────────────────────

/**
 * Met à jour les métadonnées d'une commande (moyen de paiement, type de commande,
 * créneau de retrait, note). Réservé à l'ADMIN au niveau des appelants
 * (server action `requireAdmin`, garde-fou MCP). Mise à jour partielle : seuls
 * les champs fournis sont écrits.
 *
 * `pickupTime` est une chaîne ISO 8601 (UTC) ou null ; comme Abidjan = UTC+0,
 * elle reflète directement l'heure locale affichée.
 *
 * Garde-fou de cohérence : on n'autorise pas à retirer le mode de paiement
 * (`paymentMode: null`) d'une commande déjà payée — sinon l'état deviendrait
 * « payée sans mode ».
 */
export async function updateOrderDetails(id: string, input: unknown) {
  const data = updateOrderDetailsSchema.parse(input);

  const order = await prisma.order.findUnique({
    where: { id },
    select: { isPaid: true },
  });
  if (!order) {
    throw new OrderMutationError('Commande introuvable', 404);
  }
  if (data.paymentMode === null && order.isPaid) {
    throw new OrderMutationError(
      'Impossible de retirer le mode de paiement d’une commande payée',
      400
    );
  }

  return prisma.order.update({
    where: { id },
    data: {
      ...(data.orderType !== undefined ? { orderType: data.orderType } : {}),
      ...(data.pickupTime !== undefined
        ? { pickupTime: data.pickupTime ? new Date(data.pickupTime) : null }
        : {}),
      ...(data.paymentMode !== undefined
        ? { paymentMode: data.paymentMode }
        : {}),
      ...(data.note !== undefined ? { note: data.note ?? null } : {}),
    },
  });
}

/**
 * Finalise une commande en un seul geste : la marque payée (si elle ne l'est pas
 * déjà) ET la passe `COMPLETED` (récupérée). Raccourci caisse pour un walk-in qui
 * paie et repart, sans dérouler NEW → PREPARING → READY → COMPLETED.
 *
 * NEW → COMPLETED n'est pas une transition `canTransition` classique : on contrôle
 * donc directement le rôle (`canTogglePayment`) et on écrit dans une transaction
 * atomique avec garde de concurrence sur `status` ET `isPaid`.
 *
 * STOCK : réservation INCONDITIONNELLE via `reserveStockOnce`, dans la même
 * transaction. NEW → COMPLETED ne passe jamais par `PREPARING`, mais la
 * marchandise est bel et bien servie : elle doit donc être décomptée. Aucune
 * garde sur `alreadyPaid` ni sur `status !== 'COMPLETED'` — le verrou
 * `stockReservedAt` les rend inutiles ET strictement plus correctes : une
 * commande déjà passée en cuisine ne sera pas décomptée deux fois, tandis
 * qu'une commande `COMPLETED` qui n'a jamais rien réservé (cas que les
 * anciennes gardes laissaient filer) l'est enfin.
 *
 * `payments` (1..N lignes `{mode, amount}`, somme = total relu en base) n'est
 * requis QUE si la commande n'est pas déjà payée ; ignoré (la commande garde
 * ses lignes `OrderPayment` existantes) si `alreadyPaid`.
 *
 * Lève `OrderMutationError` (400 paiement manquant/somme incorrecte si pas déjà
 * payée, 403 rôle, 404 introuvable, 409 conflit/déjà finale, ou
 * `StockShortageError` 409 si le stock ne suffit plus — le client perdant est
 * alors notifié `ITEM_UNAVAILABLE` avant que l'erreur ne remonte).
 * Renvoie `alreadyPaid` (vrai si la commande était déjà encaissée avant l'appel).
 */
export async function payAndComplete(
  id: string,
  payments: OrderPaymentLineInput[] | undefined,
  role: UserRole,
  actorId?: string | null
): Promise<{ alreadyPaid: boolean }> {
  if (!canTogglePayment(role)) {
    throw new OrderMutationError('Action réservée à la caisse', 403);
  }

  let txResult: { alreadyPaid: boolean; reserved: boolean; items: CartItem[] };
  try {
    txResult = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        select: { status: true, isPaid: true, items: true, total: true },
      });
      if (!order) {
        throw new OrderMutationError('Commande introuvable', 404);
      }
      if (order.status === 'CANCELLED') {
        throw new OrderMutationError('Commande annulée', 409);
      }
      if (order.status === 'COMPLETED' && order.isPaid) {
        throw new OrderMutationError('Commande déjà finalisée', 409);
      }

      const alreadyPaid = order.isPaid;
      const items = order.items as unknown as CartItem[];

      if (!alreadyPaid) {
        if (!payments || payments.length === 0) {
          throw new OrderMutationError(
            'payments requis pour encaisser cette commande',
            400
          );
        }
        const sum = payments.reduce((s, p) => s + p.amount, 0);
        if (sum !== order.total) {
          throw new OrderMutationError(
            `Le total des paiements (${sum} F) ne correspond pas au montant de la commande (${order.total} F)`,
            400
          );
        }
      }

      // Inconditionnel : NEW → COMPLETED court-circuite PREPARING, mais la
      // marchandise part quand même. Le verrou d'idempotence garantit qu'une
      // commande déjà passée en cuisine n'est pas décomptée une seconde fois.
      const reserved = await reserveStockOnce(tx, id, items);

      const result = await tx.order.updateMany({
        // Garde optimiste sur les deux champs lus : un autre caissier peut avoir
        // encaissé ou avancé la commande entre la lecture et l'écriture.
        where: { id, status: order.status, isPaid: order.isPaid },
        data: {
          status: 'COMPLETED',
          // Ne pas écraser le mode / l'horodatage d'une commande déjà payée.
          ...(alreadyPaid
            ? {}
            : {
                isPaid: true,
                paymentMode: resolvePaymentMode(
                  payments as OrderPaymentLineInput[]
                ),
                paidAt: new Date(),
              }),
        },
      });

      if (result.count === 0) {
        throw new OrderMutationError(
          'État modifié entre temps, recharger',
          409
        );
      }

      if (!alreadyPaid) {
        await tx.orderPayment.createMany({
          data: (payments as OrderPaymentLineInput[]).map((p) => ({
            orderId: id,
            mode: p.mode,
            amount: p.amount,
            createdById: actorId ?? null,
          })),
        });
      }

      return { alreadyPaid, reserved, items };
    });
  } catch (err) {
    if (err instanceof StockShortageError) {
      notifyOrderCustomer(id, 'ITEM_UNAVAILABLE');
    }
    throw err;
  }

  // Après la transaction seulement (jamais dedans) : commande soldée et
  // récupérée en un geste → dernière notification client, puis désabonnement.
  notifyOrderCustomer(id, 'COMPLETED');

  // Fan-out best-effort (uniquement si CET appel a décrémenté du stock) :
  // avertir tout de suite les autres clients dont la commande en attente
  // dépend d'un produit/option qui vient de tomber à 0.
  if (txResult.reserved) {
    notifyPendingOrdersOfShortage(id, txResult.items).catch((err) => {
      console.error('[order-mutations] fan-out stock épuisé échoué :', err);
    });
  }

  return { alreadyPaid: txResult.alreadyPaid };
}

// ─── Association d'un client (CRM) à une commande existante ───────────────────

/**
 * Associe (ou détache) un client à une commande déjà créée. Trois modes :
 *   - `{ customerId }` non nul : lie au client existant et synchronise le nom /
 *     téléphone figés sur la commande depuis la fiche CRM.
 *   - `{ phone, name? }` : upsert d'un client par téléphone (forme canonique),
 *     puis liaison — utile pour une commande walk-in saisie sans téléphone.
 *   - `{ customerId: null }` : détache la commande (redevient anonyme) sans
 *     toucher au nom / téléphone historiques ni à la fidélité déjà acquise.
 *
 * Fidélité : un tampon est attribué (comme à la création) UNIQUEMENT lorsqu'une
 * commande jusque-là anonyme se voit rattacher un client — `awardLoyaltyForOrder`
 * reste idempotent (montant min, 1 tampon/jour). Une ré-affectation d'un client
 * à un autre ne re-tamponne pas (évite le double-comptage).
 *
 * Lève `OrderMutationError` (404 commande / client introuvable, 400 entrée
 * invalide). Renvoie l'`id` client final (ou null si détaché).
 */
export async function setOrderCustomer(
  orderId: string,
  input: {
    customerId?: string | null;
    phone?: string | null;
    name?: string | null;
  },
  actorId?: string | null
): Promise<{ customerId: string | null }> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, customerId: true, customerName: true, total: true },
    });
    if (!order) {
      throw new OrderMutationError('Commande introuvable', 404);
    }

    // Détachement explicite : { customerId: null } sans téléphone fourni.
    if (input.customerId === null && !input.phone) {
      await tx.order.update({
        where: { id: orderId },
        data: { customerId: null },
      });
      return { customerId: null };
    }

    let customerId: string;
    let customerName: string | null;
    let customerPhone: string | null;

    if (input.customerId) {
      // Liaison à un client existant : la fiche CRM fait foi.
      const customer = await tx.customer.findUnique({
        where: { id: input.customerId },
        select: { id: true, name: true, phone: true },
      });
      if (!customer) {
        throw new OrderMutationError('Client introuvable', 404);
      }
      customerId = customer.id;
      // Conserve le nom déjà saisi sur la commande si la fiche n'en a pas.
      customerName = customer.name ?? order.customerName ?? null;
      customerPhone = customer.phone;
    } else if (input.phone) {
      // Upsert par téléphone (mêmes règles de normalisation que la création).
      const rawPhone = input.phone.trim();
      const normalizedPhone = normalizeIvorianPhone(rawPhone) ?? rawPhone;
      const upsertedId = await upsertCustomerForOrder(
        tx,
        normalizedPhone,
        input.name
      );
      if (!upsertedId) {
        throw new OrderMutationError('Téléphone invalide', 400);
      }
      customerId = upsertedId;
      customerPhone = normalizedPhone;
      // Nom : celui fourni, sinon celui de la fiche (peut avoir été créé avant).
      const cleanName = input.name?.trim() || null;
      if (cleanName) {
        customerName = cleanName;
      } else {
        const c = await tx.customer.findUnique({
          where: { id: upsertedId },
          select: { name: true },
        });
        customerName = c?.name ?? order.customerName ?? null;
      }
    } else {
      throw new OrderMutationError('customerId ou téléphone requis', 400);
    }

    const wasAnonymous = order.customerId === null;

    await tx.order.update({
      where: { id: orderId },
      data: { customerId, customerName, customerPhone },
    });

    // Fidélité : on tamponne comme à la création, seulement si la commande
    // était anonyme (pas de double-comptage sur une ré-affectation).
    if (wasAnonymous) {
      await awardLoyaltyForOrder(tx, {
        customerId,
        orderId,
        orderTotal: order.total,
        actorId: actorId ?? null,
      });
    }

    return { customerId };
  });
}

// ─── Mise à jour des articles (et donc des remises) ───────────────────────────

/**
 * Remplace les articles d'une commande et recalcule son total (net après
 * remises). Sert à ajouter/retirer des produits ET à appliquer des remises de
 * ligne. Refuse une commande terminée/annulée et plafonne chaque remise.
 *
 * STOCK : si le stock de la commande est déjà réservé (`stockReservedAt` posé
 * — entrée en cuisine, ardoise ou paiement déjà passés), toute AUGMENTATION
 * de quantité par rapport aux articles actuels est décrémentée maintenant
 * (voir `decrementStockDelta`) : `reserveStockOnce` ne décrémente qu'une
 * seule fois, à la toute première réservation, donc un rajout après coup
 * (ex. « encore 2 cafés » une fois la commande déjà en cuisine) ne serait
 * sinon jamais compté. Une baisse ne restitue rien. Si le stock n'est PAS
 * encore réservé, aucune action ici : la future entrée en cuisine décomptera
 * les articles finaux tels quels.
 *
 * Lève `OrderMutationError` (400 liste vide / remise trop élevée, 404
 * introuvable, 409 commande terminée) ou `StockShortageError` (409, si le
 * surplus dépasse le stock restant). Renvoie le nouveau total.
 */
export async function updateOrderItems(
  id: string,
  items: CartItem[]
): Promise<{ total: number }> {
  if (items.length === 0) {
    throw new OrderMutationError(
      'La commande doit avoir au moins un article',
      400
    );
  }

  // Plafond de remise par ligne (sécurité serveur, en plus de la validation UI).
  for (const item of items) {
    if ((item.discount ?? 0) > getMaxItemDiscount(item)) {
      throw new OrderMutationError(
        `Remise trop élevée sur « ${item.productName} »`,
        400
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      select: {
        status: true,
        loyaltyDiscount: true,
        items: true,
        stockReservedAt: true,
      },
    });
    if (!order) {
      throw new OrderMutationError('Commande introuvable', 404);
    }
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new OrderMutationError(
        'Impossible de modifier une commande terminée ou annulée',
        409
      );
    }

    if (order.stockReservedAt) {
      const previousItems = order.items as unknown as CartItem[];
      await decrementStockDelta(tx, id, previousItems, items);
    }

    // Total net recalculé côté serveur (après remises), en conservant la
    // récompense fidélité déjà appliquée à la commande (sinon un simple ajout /
    // retrait d'article efface silencieusement sa déduction du total, alors que
    // `loyaltyDiscount`/`loyaltyRewardId` restent inchangés sur la ligne — cf.
    // `createCashierOrder` pour le même calcul à la création).
    const total = Math.max(
      0,
      computeItemsTotal(items) - (order.loyaltyDiscount ?? 0)
    );

    await tx.order.update({
      where: { id },
      data: { items: items as unknown as Prisma.InputJsonValue, total },
    });

    return { total };
  });
}

// ─── Récompense fidélité sur une commande déjà créée ───────────────────────────

/**
 * Applique (ou retire) une récompense fidélité sur une commande existante —
 * contrairement à `createCashierOrder`, où la récompense ne peut être choisie
 * qu'à la création. Recalcule le total à partir des articles courants (même
 * formule que `updateOrderItems`) et consomme/restitue la récompense en
 * conséquence.
 *
 * `{ loyaltyRewardId: null }` retire la récompense déjà appliquée (si il y en
 * a une) : elle redevient `AVAILABLE`, la remise est retirée du total.
 * `{ loyaltyRewardId: "<id>" }` retire d'abord la précédente s'il y en a une,
 * puis applique la nouvelle (vérifiée : appartient au client de la commande,
 * statut `AVAILABLE`).
 *
 * `redeemAsGift: true` : la récompense est marquée utilisée (elle ne resservira
 * plus) mais SANS déduire `capAmount` du total — pour les clients à qui on
 * offre un geste/produit au comptoir plutôt qu'une réduction en numéraire.
 *
 * Lève `OrderMutationError` (404 commande, 400 récompense indisponible / pas
 * de client associé, 409 commande terminée/annulée).
 */
export async function setOrderLoyaltyReward(
  orderId: string,
  input: { loyaltyRewardId: string | null; redeemAsGift?: boolean },
  actorId?: string | null
): Promise<{ total: number; loyaltyDiscount: number | null }> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        items: true,
        customerId: true,
        loyaltyRewardId: true,
      },
    });
    if (!order) {
      throw new OrderMutationError('Commande introuvable', 404);
    }
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new OrderMutationError(
        'Impossible de modifier une commande terminée ou annulée',
        409
      );
    }

    // Retire d'abord la récompense déjà appliquée, s'il y en a une : elle
    // redevient disponible pour le client (réappliquer sur cette même
    // commande, ou une autre plus tard).
    if (order.loyaltyRewardId) {
      await tx.loyaltyReward.update({
        where: { id: order.loyaltyRewardId },
        data: {
          status: 'AVAILABLE',
          usedOrderId: null,
          usedAt: null,
          redeemedAsGift: false,
        },
      });
      await tx.loyaltyLedger.create({
        data: {
          customerId: order.customerId as string,
          type: 'ADJUSTMENT',
          orderId,
          actorId: actorId ?? null,
          note: 'Récompense retirée de la commande',
        },
      });
    }

    const grossTotal = computeItemsTotal(order.items as CartItem[]);

    let reward: { id: string; capAmount: number } | null = null;
    if (input.loyaltyRewardId) {
      try {
        reward = await resolveLoyaltyReward(
          tx,
          input.loyaltyRewardId,
          order.customerId
        );
      } catch (err) {
        if (err instanceof LoyaltyRewardUnavailableError) {
          throw new OrderMutationError(err.message, 400);
        }
        throw err;
      }
    }

    const redeemAsGift = Boolean(reward && input.redeemAsGift);
    const discount =
      reward && !redeemAsGift ? Math.min(reward.capAmount, grossTotal) : 0;
    const total = grossTotal - discount;

    await tx.order.update({
      where: { id: orderId },
      data: {
        total,
        loyaltyRewardId: reward?.id ?? null,
        loyaltyDiscount: discount || null,
      },
    });

    if (reward) {
      await consumeLoyaltyReward(tx, {
        rewardId: reward.id,
        customerId: order.customerId as string,
        orderId,
        capAmount: reward.capAmount,
        actorId: actorId ?? null,
        redeemedAsGift: redeemAsGift,
      });
    }

    return { total, loyaltyDiscount: discount || null };
  });
}

// ─── Livreur du client (page publique de suivi) ───────────────────────────────

/**
 * Renseigne, modifie ou efface (les deux champs à null) le livreur envoyé par
 * le client. Appelée SANS rôle : la route publique s'appuie sur l'`id` cuid non
 * devinable (capability URL) — même modèle de confiance que la consultation de
 * la commande. Refusée une fois la commande récupérée ou annulée.
 */
export async function setOrderDriver(
  id: string,
  input: { driverName: string | null; driverPhone: string | null }
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!order) {
    throw new OrderMutationError('Commande introuvable', 404);
  }
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    throw new OrderMutationError(
      'Commande terminée ou annulée : livreur non modifiable',
      409
    );
  }

  const driverPhone = input.driverPhone
    ? (normalizeIvorianPhone(input.driverPhone) ?? input.driverPhone)
    : null;

  await prisma.order.update({
    where: { id },
    data: { driverName: input.driverName, driverPhone },
  });
}

// ─── Prise en charge (édition caisse) ──────────────────────────────────────────

export type UpdateOrderFulfillmentInput = {
  orderType?: OrderTypeInput;
  pickupTime?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  note?: string | null;
};

/**
 * Édition « caisse » de la prise en charge d'une commande existante :
 * orderType / pickupTime / note (écrits directement) + driverName/driverPhone
 * (délégués à `setOrderDriver`, pas de duplication de la normalisation
 * téléphone). Accessible à CASHIER_PLUS (`canEditOrderFulfillment`) —
 * contrairement à `updateOrderDetails` (réservé ADMIN, qui touche aussi
 * `paymentMode`) : cette fonction ne touche JAMAIS le paiement.
 *
 * driverName/driverPhone sont indépendants : fournir l'un sans l'autre
 * (le téléphone du livreur n'est jamais obligatoire) préserve la valeur
 * actuelle du champ non fourni plutôt que de l'effacer.
 *
 * Refusée une fois la commande terminée ou annulée (même garde que
 * `setOrderDriver`).
 */
export async function updateOrderFulfillment(
  id: string,
  input: UpdateOrderFulfillmentInput
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id },
    select: { status: true, driverName: true, driverPhone: true },
  });
  if (!order) {
    throw new OrderMutationError('Commande introuvable', 404);
  }
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    throw new OrderMutationError(
      'Commande terminée ou annulée : prise en charge non modifiable',
      409
    );
  }

  const hasDirectFields =
    input.orderType !== undefined ||
    input.pickupTime !== undefined ||
    input.note !== undefined;

  if (hasDirectFields) {
    await prisma.order.update({
      where: { id },
      data: {
        ...(input.orderType !== undefined
          ? { orderType: input.orderType }
          : {}),
        ...(input.pickupTime !== undefined
          ? { pickupTime: input.pickupTime ? new Date(input.pickupTime) : null }
          : {}),
        ...(input.note !== undefined ? { note: input.note ?? null } : {}),
      },
    });
  }

  if (input.driverName !== undefined || input.driverPhone !== undefined) {
    await setOrderDriver(id, {
      driverName:
        input.driverName !== undefined ? input.driverName : order.driverName,
      driverPhone:
        input.driverPhone !== undefined ? input.driverPhone : order.driverPhone,
    });
  }
}

// ─── Preuve de paiement (capture Wave uploadée par le client) ─────────────────

/**
 * Vérifie qu'une commande peut recevoir une preuve de paiement (existe, non
 * annulée, non encaissée) SANS écrire. Exportée pour que la route puisse
 * valider la commande AVANT d'écrire l'image sur disque (évite des fichiers
 * orphelins pour un id bidon) ; `setOrderPaymentProof` refait sa propre garde
 * juste avant l'écriture (course résiduelle sans conséquence).
 */
export async function assertOrderAcceptsPaymentProof(
  id: string
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id },
    select: { isPaid: true, status: true },
  });
  if (!order) {
    throw new OrderMutationError('Commande introuvable', 404);
  }
  if (order.status === 'CANCELLED') {
    throw new OrderMutationError('Commande annulée', 409);
  }
  if (order.isPaid) {
    throw new OrderMutationError('Commande déjà encaissée', 409);
  }
}

/**
 * Attache la preuve de paiement (URL `/uploads/payment-proofs/…`) à une
 * commande non encore encaissée. La validation reste manuelle en caisse
 * (`setOrderPayment`) : la preuve est un signal, pas un encaissement.
 * Ré-upload autorisé tant que la commande n'est pas payée (remplace l'URL) —
 * réinitialise aussi le verdict/l'analyse de la pré-analyse IA PRÉCÉDENTE
 * (sinon la page de suivi client afficherait encore un rejet pour une
 * capture que le client vient de remplacer) ; la nouvelle analyse IA,
 * déclenchée juste après par l'appelant, réécrira ces champs.
 */
export async function setOrderPaymentProof(
  id: string,
  url: string
): Promise<void> {
  await assertOrderAcceptsPaymentProof(id);

  await prisma.order.update({
    where: { id },
    data: {
      paymentProofUrl: url,
      paymentProofVerdict: null,
      paymentProofAnalysis: Prisma.DbNull,
      paymentProofAnalyzedAt: null,
    },
  });
}

/**
 * Persiste le verdict de la pré-analyse IA d'une preuve de paiement
 * (lib/ai/payment-proof.ts, appelée en arrière-plan après l'upload) : ne
 * touche jamais `isPaid`/`paymentMode` elle-même. Contrairement à
 * `setOrderPaymentProof`, N'EXIGE PAS que la commande soit encore non payée
 * — l'appelant peut avoir entre-temps posé un encaissement AUTOMATIQUE sur
 * la base de CE MÊME verdict (cf. `analyzePaymentProof`), et cette analyse
 * reste une information utile à conserver (raisonnement, indices de
 * retouche...) même une fois la commande payée. Ignore silencieusement une
 * commande introuvable ou annulée (résultat devenu sans objet).
 */
export async function setOrderPaymentProofVerdict(
  id: string,
  input: {
    verdict: PaymentProofVerdict;
    analysis: Prisma.InputJsonValue;
  }
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!order || order.status === 'CANCELLED') return;

  await prisma.order.update({
    where: { id },
    data: {
      paymentProofVerdict: input.verdict,
      paymentProofAnalysis: input.analysis,
      paymentProofAnalyzedAt: new Date(),
    },
  });
}
