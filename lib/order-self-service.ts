// lib/order-self-service.ts
//
// Libre-service CLIENT sur une commande en ligne, depuis la page de suivi :
// annuler, remplacer/retirer un article devenu indisponible, changer de
// créneau. Appelé SANS rôle par les routes publiques
// `app/api/commandes/[id]/{annulation,articles,creneau}` — même modèle de
// confiance que la consultation : l'`id` cuid non devinable sert de
// capability URL.
//
// Garde-fous, tous côté serveur :
//   - éligibilité unique `canCustomerSelfServe` (lib/orders/self-service.ts),
//     revérifiée DANS l'écriture (`SELF_SERVICE_GUARD` dans le `where`) : si
//     la caisse a encaissé ou lancé la commande entre-temps, rien n'est écrit ;
//   - le client n'envoie que des références produit — prix, coûts et goûts
//     sont résolus depuis le menu (`buildOrderItemsFromMenu`) ;
//   - une commande modifiée obéit aux règles d'une commande neuve
//     (`assertPublicOrderConstraints`) : délai, planning, stock du jour ;
//   - annuler défait la fidélité (`revokeLoyaltyForOrder`) — sinon
//     « commander puis annuler » fabriquerait des tampons.
// Le staff est prévenu par push à chaque geste (la file caisse se met à jour
// seule via le trigger LISTEN/NOTIFY sur `order`).

import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { CartItem } from '@/lib/cart-store';
import {
  OrderMutationError,
  buildOrderItemsFromMenu,
} from '@/lib/order-mutations';
import { SoldOutTodayError, assertPublicOrderConstraints } from '@/lib/orders';
import {
  computeOrderItemsAvailability,
  fetchStockSnapshot,
} from '@/lib/orders/availability';
import { isDeferredPickup } from '@/lib/orders/scheduling';
import {
  SELF_SERVICE_CLOSED_MESSAGE,
  SELF_SERVICE_GUARD,
  canCustomerSelfServe,
} from '@/lib/orders/self-service';
import { computeItemsTotal } from '@/lib/orders/totals';
import { getPickupCode } from '@/lib/orders/format';
import { revokeLoyaltyForOrder } from '@/lib/loyalty-mutations';
import { getMenu } from '@/lib/menu';
import { canOrderForLaterDay } from '@/lib/supplements';
import {
  getAvailablePickupSlots,
  getPickupSettings,
} from '@/lib/pickup-settings-db';
import { sendPushToRoles } from '@/lib/push-notify';
import { ROLE_GROUPS } from '@/lib/auth-helpers';
import {
  ADVANCE_ORDER_DAYS_MAX,
  PICKUP_MIN_VISIBLE_DAYS,
} from '@/config/constants';
import type { CustomerItemChange } from '@/lib/schemas/order';

const ORDER_SELECT = {
  id: true,
  reference: true,
  dailyNumber: true,
  source: true,
  status: true,
  isPaid: true,
  stockReservedAt: true,
  paymentProofUrl: true,
  depositPaid: true,
  isOnAccount: true,
  items: true,
  pickupTime: true,
  customerId: true,
  loyaltyRewardId: true,
  loyaltyDiscount: true,
  updatedAt: true,
} satisfies Prisma.OrderSelect;

type SelfServiceOrder = Prisma.OrderGetPayload<{
  select: typeof ORDER_SELECT;
}>;

const CONCURRENT_CHANGE_MESSAGE =
  'Ta commande vient d’être modifiée : recharge la page.';

async function loadEligibleOrder(id: string): Promise<SelfServiceOrder> {
  const order = await prisma.order.findUnique({
    where: { id },
    select: ORDER_SELECT,
  });
  if (!order) throw new OrderMutationError('Commande introuvable', 404);
  if (order.status === 'CANCELLED') {
    throw new OrderMutationError('Cette commande est déjà annulée.', 409);
  }
  if (!canCustomerSelfServe(order)) {
    throw new OrderMutationError(SELF_SERVICE_CLOSED_MESSAGE, 409);
  }
  return order;
}

/** Push staff, best-effort : jamais bloquant pour le client. */
function notifyStaff(order: SelfServiceOrder, title: string) {
  sendPushToRoles(ROLE_GROUPS.CASHIER_PLUS, {
    title,
    body: `#${String(order.dailyNumber).padStart(3, '0')} · ${getPickupCode(order.reference)}`,
    url: '/dashboard/caisse',
    tag: `order-${order.id}`,
  }).catch((err) => {
    console.error('[order-self-service] notification push échouée :', err);
  });
}

// ─── Annulation ──────────────────────────────────────────────────────────────

export async function cancelOrderByCustomer(id: string): Promise<void> {
  const order = await loadEligibleOrder(id);

  await prisma.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: { id, ...SELF_SERVICE_GUARD },
      data: {
        status: 'CANCELLED',
        // La récompense est restituée au client ci-dessous : la commande
        // annulée ne doit plus la référencer (elle peut resservir ailleurs).
        loyaltyRewardId: null,
        loyaltyDiscount: null,
        total: computeItemsTotal(order.items as unknown as CartItem[]),
      },
    });
    if (result.count === 0) {
      throw new OrderMutationError(SELF_SERVICE_CLOSED_MESSAGE, 409);
    }
    if (order.customerId) {
      await revokeLoyaltyForOrder(tx, {
        orderId: id,
        customerId: order.customerId,
        usedRewardId: order.loyaltyRewardId,
        note: 'Commande annulée par le client',
      });
    }
  });

  notifyStaff(order, 'Commande annulée par le client');
}

// ─── Remplacement / retrait d'articles indisponibles ─────────────────────────

/**
 * Remplace ou retire des lignes DEVENUES INDISPONIBLES (stock du jour) — et
 * seulement celles-là : le libre-service répare une rupture, il ne réécrit
 * pas une commande. Les remplacements sont résolus depuis le menu public
 * (prix serveur, produit réellement commandable), puis la commande entière
 * repasse les règles d'une commande neuve. Une ligne remplacée garde sa
 * position.
 *
 * Lève `OrderMutationError` (400/404/409) ou les erreurs de
 * `assertPublicOrderConstraints` (ex. `SoldOutTodayError` si le remplaçant
 * vient lui aussi de s'épuiser, ou si une autre ligne reste indisponible).
 */
export async function replaceUnavailableItems(
  id: string,
  changes: CustomerItemChange[]
): Promise<void> {
  const order = await loadEligibleOrder(id);
  const items = order.items as unknown as CartItem[];

  // Même calcul que la page de suivi (`getPublicOrder`) : une commande pour
  // un autre jour n'a jamais d'article « indisponible ».
  if (isDeferredPickup(order.pickupTime)) {
    throw new OrderMutationError(
      'Rien à remplacer : ta commande est prévue pour un autre jour.',
      409
    );
  }
  const stock = await fetchStockSnapshot([items]);
  const unavailable = new Set(
    computeOrderItemsAvailability(items, stock)
      .items.filter((a) => !a.available)
      .map((a) => a.cartId)
  );

  const byCartId = new Map<string, CustomerItemChange>();
  for (const change of changes) {
    if (!items.some((i) => i.cartId === change.cartId)) {
      throw new OrderMutationError('Article introuvable dans la commande', 400);
    }
    if (byCartId.has(change.cartId)) {
      throw new OrderMutationError('Article modifié deux fois', 400);
    }
    if (!unavailable.has(change.cartId)) {
      throw new OrderMutationError(
        'Seuls les articles indisponibles peuvent être remplacés ou retirés.',
        409
      );
    }
    byCartId.set(change.cartId, change);
  }

  // Remplaçants : produit présent sur la carte publique et commandable
  // (ni en pause, ni hors planning), sans acompte (geste réservé au
  // comptoir). Le stock, lui, est vérifié avec toute la commande plus bas.
  const replaceRefs = changes.flatMap((c) =>
    c.action === 'replace' ? [c.with] : []
  );
  if (replaceRefs.length > 0) {
    const publicProducts = new Map(
      (await getMenu()).flatMap((c) => c.products).map((p) => [p.id, p])
    );
    for (const ref of replaceRefs) {
      const product = publicProducts.get(ref.productId);
      if (
        !product ||
        !canOrderForLaterDay(product) ||
        product.requiresDeposit
      ) {
        throw new OrderMutationError(
          `${product?.name ?? 'Ce produit'} n’est pas disponible en remplacement.`,
          409
        );
      }
    }
  }

  let built: CartItem[];
  try {
    built = (await buildOrderItemsFromMenu(replaceRefs)) as CartItem[];
  } catch (err) {
    if (err instanceof Error) throw new OrderMutationError(err.message, 400);
    throw err;
  }
  const replacements = new Map<string, CartItem>();
  let next = 0;
  for (const change of changes) {
    if (change.action !== 'replace') continue;
    replacements.set(change.cartId, {
      ...built[next++],
      cartId: Math.random().toString(36).slice(2, 10),
    });
  }

  const newItems = items.flatMap((item) => {
    const change = byCartId.get(item.cartId);
    if (!change) return [item];
    if (change.action === 'remove') return [];
    return [replacements.get(item.cartId)!];
  });
  if (newItems.length === 0) {
    throw new OrderMutationError(
      'Ta commande serait vide : annule-la plutôt.',
      400
    );
  }

  // Le client résout ligne par ligne : une AUTRE ligne encore indisponible,
  // qu'il n'a pas touchée, ne doit pas bloquer ce remplacement (la commande
  // n'est pas moins servable qu'avant). Seul un remplaçant lui-même épuisé
  // est refusé.
  try {
    await assertPublicOrderConstraints(newItems, order.pickupTime);
  } catch (err) {
    if (!(err instanceof SoldOutTodayError)) throw err;
    const newCartIds = new Set([...replacements.values()].map((r) => r.cartId));
    const blocking = err.lines.filter((l) => newCartIds.has(l.cartId));
    if (blocking.length > 0) throw new SoldOutTodayError(blocking);
  }

  await prisma.$transaction(async (tx) => {
    // Remise fidélité recalculée sur le nouveau brut : un remplaçant moins
    // cher ne doit pas laisser une remise supérieure au montant de la ligne.
    const gross = computeItemsTotal(newItems);
    let discount = 0;
    if (order.loyaltyRewardId && order.loyaltyDiscount) {
      const reward = await tx.loyaltyReward.findUnique({
        where: { id: order.loyaltyRewardId },
        select: { capAmount: true },
      });
      discount = Math.min(reward?.capAmount ?? order.loyaltyDiscount, gross);
    }

    const result = await tx.order.updateMany({
      // `updatedAt` : verrou optimiste contre une édition caisse concurrente
      // (le calcul ci-dessus repose sur les articles lus plus haut).
      where: { id, ...SELF_SERVICE_GUARD, updatedAt: order.updatedAt },
      data: {
        items: newItems as unknown as Prisma.InputJsonValue,
        total: gross - discount,
        ...(order.loyaltyRewardId ? { loyaltyDiscount: discount || null } : {}),
      },
    });
    if (result.count === 0) {
      throw new OrderMutationError(CONCURRENT_CHANGE_MESSAGE, 409);
    }
  });

  notifyStaff(order, 'Commande modifiée par le client');
}

// ─── Changement de créneau ───────────────────────────────────────────────────

/**
 * Nouveau créneau (ou `null` = « dès que possible »). Un créneau précis doit
 * figurer parmi ceux que propose le sélecteur (horaires, délai de
 * préparation, capacité — `getAvailablePickupSlots`), sauf s'il est inchangé.
 * La commande repasse ensuite les règles d'une commande neuve : un retrait
 * avancé à aujourd'hui revérifie le stock.
 */
export async function rescheduleOrderByCustomer(
  id: string,
  pickupTimeIso: string | null
): Promise<void> {
  const order = await loadEligibleOrder(id);
  const items = order.items as unknown as CartItem[];
  const target = pickupTimeIso ? new Date(pickupTimeIso) : null;

  if (target && target.getTime() !== order.pickupTime?.getTime()) {
    const now = new Date();
    const base = await getPickupSettings();
    const daysAhead = Math.ceil(
      (target.getTime() - now.getTime()) / 86_400_000
    );
    const slots = await getAvailablePickupSlots(now, {
      ...base,
      // Même horizon que `/api/pickup-slots?minDays=` : le client a pu
      // choisir au-delà du réglage si sa commande l'exige.
      visibleDays: Math.max(
        base.visibleDays,
        PICKUP_MIN_VISIBLE_DAYS,
        Math.min(daysAhead + 1, ADVANCE_ORDER_DAYS_MAX)
      ),
    });
    if (!slots.some((s) => s.getTime() === target.getTime())) {
      throw new OrderMutationError(
        'Ce créneau n’est plus disponible : choisis-en un autre.',
        409
      );
    }
  }

  await assertPublicOrderConstraints(items, target);

  const result = await prisma.order.updateMany({
    where: { id, ...SELF_SERVICE_GUARD },
    data: { pickupTime: target },
  });
  if (result.count === 0) {
    throw new OrderMutationError(SELF_SERVICE_CLOSED_MESSAGE, 409);
  }

  notifyStaff(order, 'Créneau modifié par le client');
}
