// lib/cashier-queue.ts
//
// Snapshot pour l'écran caisse. Filtre :
//   - toute commande du jour PAS encore COMPLETED ni CANCELLED
//   - OU toute commande encore non payée (même si remise — anomalie à régler)
//
// Tri : pickupTime asc avec null en dernier (les commandes online avec créneau
// remontent), puis createdAt asc pour les walk-in et égalités.
//
// Importable par server actions ET route handlers (pas de 'use server').

import prisma from '@/lib/prisma';
import type { CartItem } from '@/lib/cart-store';
import {
  fetchStockSnapshot,
  computeOrderItemsAvailability,
} from '@/lib/orders/availability';
import { isDeferredPickup } from '@/lib/orders/scheduling';
import { endOfLocalDay, startOfLocalDay } from '@/lib/timezone';
import { getLoyaltySettings } from '@/lib/loyalty-settings-db';
import { coalesceAsyncByKey } from '@/lib/async-coalesce';
import { getOrdersGeneration } from '@/lib/postgres-notify';
import type { LoyaltySettings } from '@/lib/loyalty-settings';
import type {
  OrderSource,
  OrderStatus,
  OrderType,
  PaymentMode,
  PaymentProofVerdict,
} from '@/generated/prisma/client';

export type CashierOrder = {
  id: string;
  reference: string;
  dailyNumber: number;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  pickupTime: Date | null;
  orderType: OrderType;
  items: CartItem[];
  note: string | null;
  total: number;
  /** Montant de la récompense fidélité déjà déduit de `total` (null = aucune). */
  loyaltyDiscount: number | null;
  /** `LoyaltyReward.id` utilisée sur cette commande (null = aucune). */
  loyaltyRewardId: string | null;
  status: OrderStatus;
  isPaid: boolean;
  /** « Ardoise » : partie en cuisine sans encaissement (cf. `Order.isOnAccount`).
   * Toujours accompagnée de `isPaid: false` — l'argent reste dû. */
  isOnAccount: boolean;
  /** Le client lié est-il marqué « de confiance » (`Customer.isTrusted`) ?
   * `false` pour une commande anonyme. Signal caisse : le non-paiement de ces
   * commandes n'escalade pas en urgence (cf. `urgency.ts`). */
  customerTrusted: boolean;
  paymentMode: PaymentMode | null;
  /** Vrai si l'encaissement courant (`isPaid`) a été posé automatiquement par
   * la pré-analyse IA (verdict MATCH) plutôt que par un geste caisse. Pilote
   * le bouton dédié « Annuler l'encaissement automatique ». Toujours `false`
   * si `isPaid` est faux. */
  paymentAutoValidatedByAi: boolean;
  paymentProofUrl: string | null;
  /** Verdict de la pré-analyse IA de `paymentProofUrl` (lib/ai/payment-proof.ts).
   * Null tant que pas analysée (ou fonctionnalité inactive) — signal caisse
   * uniquement, ne remplace jamais la validation manuelle. */
  paymentProofVerdict: PaymentProofVerdict | null;
  /** Détail structuré de l'analyse IA (montant/opérateur/référence détectés). */
  paymentProofAnalysis: unknown;
  /** Origine de création de la commande (cf. enum `OrderSource`). */
  source: OrderSource;
  driverRequested: boolean;
  driverName: string | null;
  driverPhone: string | null;
  createdAt: Date;
  // Amorces des minuteurs caisse : entrée en cuisine et passage prête. Null
  // pour les commandes antérieures à l'ajout des colonnes.
  preparingStartedAt: Date | null;
  readyAt: Date | null;
  /** Instant de réservation (décrément) du stock de cette commande, null tant
   * qu'elle n'est pas entrée en cuisine. Verrou à sens unique, cf.
   * `sendOrderToKitchen` (lib/order-mutations.ts). */
  stockReservedAt: Date | null;
  /** Vrai si au moins un article n'est plus dispo au stock actuel. Calculé
   * UNIQUEMENT pour les commandes dont le stock n'est PAS encore réservé
   * (`stockReservedAt === null`) — une commande déjà entrée en cuisine a son
   * stock décompté, elle n'est donc jamais « en pénurie », même impayée
   * (ardoise). Signal caisse (flag rouge + garde bouton payer). */
  stockShortage: boolean;
  /** Noms des articles en cause quand `stockShortage`, pour l'affichage. */
  unavailableItemNames: string[];
  /** Réglages fidélité (mêmes pour toute la file — dupliqué par commande pour
   * éviter le prop-drilling à travers la chaîne caisse-view → …→ actions). */
  loyaltySettings: LoyaltySettings;
  /** Compteur de tampons du client lié (fidélité), pour le message incitatif
   * du récap. `null` = commande anonyme (`customerId` absent). */
  loyaltyStampCount: number | null;
  /** Cette commande a-t-elle crédité un tampon (et était-ce le tout premier
   * du client) — calculé UNIQUEMENT pour les commandes `READY` (seul statut
   * où le bouton "c'est prêt" s'affiche) ; `null` sinon ou commande anonyme. */
  loyaltyPickupOutcome: {
    stampEarned: boolean;
    isFirstStampEver: boolean;
  } | null;
};

export async function fetchCashierQueue(): Promise<CashierOrder[]> {
  const now = new Date();
  // Bornes ancrées sur Abidjan, PAS sur le fuseau du runtime : `startOfDay` de
  // date-fns est local à la machine, donc sur un serveur non-UTC la « journée »
  // dérivait de plusieurs heures et une commande programmée pouvait entrer ou
  // sortir de la file à tort. Même correctif dans `lib/preparation-queue.ts`.
  const dayStart = startOfLocalDay(now);
  const dayEnd = endOfLocalDay(now);

  const orders = await prisma.order.findMany({
    where: {
      // Une commande annulée (ou remboursée) quitte la file caisse.
      status: { not: 'CANCELLED' },
      AND: [
        // Toujours active (en cuisine/prête) OU encore impayée.
        {
          OR: [
            { status: { in: ['NEW', 'PREPARING', 'READY'] } },
            { isPaid: false },
          ],
        },
        // Du jour (walk-in) OU programmée pour aujourd'hui/à venir : on inclut ainsi
        // une commande passée la veille pour un retrait aujourd'hui ou demain.
        {
          OR: [
            { createdAt: { gte: dayStart, lte: dayEnd } },
            { pickupTime: { gte: dayStart } },
          ],
        },
      ],
    },
    // `include` (et non `select`) : on conserve TOUS les champs scalaires
    // consommés par le mapper ci-dessous, en n'ajoutant que le drapeau
    // « client de confiance » de la fiche liée.
    include: { customer: { select: { isTrusted: true } } },
    // FIFO strict : la commande la plus ancienne en haut.
    orderBy: { createdAt: 'asc' },
  });

  // Disponibilité : un seul instantané de stock, batché sur TOUTES les
  // commandes dont le stock n'est pas encore réservé (pas de N+1 par commande).
  // Une commande entrée en cuisine a déjà décompté son stock : jamais de calcul
  // pour elle. Le critère est `stockReservedAt` et NON `isPaid` — sinon une
  // commande en cuisine mais non encaissée (ardoise) afficherait un faux
  // « stock épuisé ».
  //
  // Les commandes DIFFÉRÉES sont exclues pour la raison inverse : leur
  // marchandise sera produite le jour du retrait, le stock d'aujourd'hui ne les
  // concerne pas. Sans ce filtre, une commande pour samedi s'afficherait en
  // rupture rouge dès aujourd'hui et son bouton « payer » demanderait une
  // confirmation absurde.
  const needsAvailability = (o: {
    stockReservedAt: Date | null;
    pickupTime: Date | null;
  }) => o.stockReservedAt === null && !isDeferredPickup(o.pickupTime, now);

  const unreservedItemsList = orders
    .filter(needsAvailability)
    .map((o) => o.items as CartItem[]);
  const stock = await fetchStockSnapshot(unreservedItemsList);

  // Fidélité : réglages une seule fois pour toute la file, compteur de
  // tampons batché pour tous les clients liés (récap), et issue précise
  // (tampon crédité / premier jamais gagné) batchée UNIQUEMENT pour les
  // commandes READY (seul contexte où le bouton "c'est prêt" en a besoin).
  const customerIds = [
    ...new Set(
      orders.map((o) => o.customerId).filter((id): id is string => id !== null)
    ),
  ];
  const readyOrderIds = orders
    .filter((o) => o.status === 'READY' && o.customerId !== null)
    .map((o) => o.id);

  const [loyaltySettings, customers, stampLedgerForReadyOrders] =
    await Promise.all([
      getLoyaltySettings(),
      customerIds.length > 0
        ? prisma.customer.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, stampCount: true },
          })
        : Promise.resolve([]),
      readyOrderIds.length > 0
        ? prisma.loyaltyLedger.findMany({
            where: { type: 'STAMP_EARNED', orderId: { in: readyOrderIds } },
            select: { orderId: true, customerId: true },
          })
        : Promise.resolve([]),
    ]);

  const stampCountByCustomerId = new Map(
    customers.map((c) => [c.id, c.stampCount])
  );
  const stampEarnedOrderIds = new Set(
    stampLedgerForReadyOrders.map((l) => l.orderId)
  );
  // "Premier tampon jamais gagné" : le client dont CETTE commande a crédité
  // le tampon n'a qu'UNE seule entrée STAMP_EARNED au ledger, tous temps
  // confondus. Un seul groupBy batché pour tous les clients concernés.
  const readyCustomerIds = [
    ...new Set(stampLedgerForReadyOrders.map((l) => l.customerId)),
  ];
  const stampCountsByCustomer =
    readyCustomerIds.length > 0
      ? await prisma.loyaltyLedger.groupBy({
          by: ['customerId'],
          where: { type: 'STAMP_EARNED', customerId: { in: readyCustomerIds } },
          _count: { _all: true },
        })
      : [];
  const totalStampEntriesByCustomerId = new Map(
    stampCountsByCustomer.map((g) => [g.customerId, g._count._all])
  );

  return orders.map((o) => {
    const items = o.items as CartItem[];

    let stockShortage = false;
    let unavailableItemNames: string[] = [];
    if (needsAvailability(o)) {
      const availability = computeOrderItemsAvailability(items, stock);
      stockShortage = !availability.fulfillable;
      if (stockShortage) {
        const detailByCartId = new Map(
          availability.items
            .filter((a) => !a.available)
            .map((a) => [a.cartId, a])
        );
        // Précise le(s) goût(s) en cause quand c'est une option (et non le
        // produit lui-même) qui manque — ex. « Sponge cake (Vanille) » plutôt
        // que seulement « Sponge cake », qui ne dit pas LEQUEL des goûts
        // commandés est épuisé.
        unavailableItemNames = items
          .filter((item) => detailByCartId.has(item.cartId))
          .map((item) => {
            const detail = detailByCartId.get(item.cartId);
            if (!detail?.missingProduct && detail?.missingOptionNames.length) {
              return `${item.productName} (${detail.missingOptionNames.join(', ')})`;
            }
            return item.productName;
          });
      }
    }

    const loyaltyStampCount = o.customerId
      ? (stampCountByCustomerId.get(o.customerId) ?? null)
      : null;
    const loyaltyPickupOutcome =
      o.status === 'READY' && o.customerId
        ? {
            stampEarned: stampEarnedOrderIds.has(o.id),
            isFirstStampEver:
              stampEarnedOrderIds.has(o.id) &&
              totalStampEntriesByCustomerId.get(o.customerId) === 1,
          }
        : null;

    return {
      id: o.id,
      reference: o.reference,
      dailyNumber: o.dailyNumber,
      customerId: o.customerId,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      pickupTime: o.pickupTime,
      orderType: o.orderType,
      items,
      note: o.note,
      total: o.total,
      loyaltyDiscount: o.loyaltyDiscount,
      loyaltyRewardId: o.loyaltyRewardId,
      status: o.status,
      isPaid: o.isPaid,
      isOnAccount: o.isOnAccount,
      customerTrusted: o.customer?.isTrusted ?? false,
      paymentMode: o.paymentMode,
      paymentAutoValidatedByAi: o.paymentAutoValidatedByAi,
      paymentProofUrl: o.paymentProofUrl,
      paymentProofVerdict: o.paymentProofVerdict,
      paymentProofAnalysis: o.paymentProofAnalysis,
      source: o.source,
      driverRequested: o.driverRequested,
      driverName: o.driverName,
      driverPhone: o.driverPhone,
      createdAt: o.createdAt,
      preparingStartedAt: o.preparingStartedAt,
      readyAt: o.readyAt,
      stockReservedAt: o.stockReservedAt,
      stockShortage,
      unavailableItemNames,
      loyaltySettings,
      loyaltyStampCount,
      loyaltyPickupOutcome,
    };
  });
}

/**
 * Variante mutualisée de `fetchCashierQueue()`, à utiliser par le flux SSE
 * (`/api/caisse/stream`). Chaque client caisse connecté possède sa PROPRE
 * boucle debounce/notify, mais reçoit le même instantané global : sans
 * mutualisation, une seule mutation de commande relançait `fetchCashierQueue()`
 * (≈6 requêtes + un instantané de stock) une fois PAR client connecté. Ici,
 * les appels déclenchés par le MÊME NOTIFY Postgres partagent la même
 * exécution.
 *
 * La mutualisation est kéyée sur la génération de notification, et NON sur la
 * simple présence d'un calcul en vol : un client qui réagit à une notification
 * plus récente doit obtenir un calcul frais, sinon la mutation qui l'a réveillé
 * resterait invisible en caisse. Voir la démonstration détaillée en tête de
 * `lib/async-coalesce.ts`. Pas de TTL, rien n'est mémorisé entre deux
 * générations.
 */
export const fetchCashierQueueShared = coalesceAsyncByKey(
  fetchCashierQueue,
  getOrdersGeneration
);
