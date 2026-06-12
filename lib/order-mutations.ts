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

import { Prisma } from '@/generated/prisma/client';
import type {
  OrderStatus,
  PaymentMode,
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
import { awardLoyaltyForOrder } from '@/lib/loyalty-mutations';
import { canTransition } from '@/lib/order-permissions';
import { normalizeIvorianPhone } from '@/lib/phone';
import { computeItemsTotal, getMaxItemDiscount } from '@/lib/orders/totals';
import { parseDateOnlyToUTC } from '@/lib/timezone';
import { getMenuAdmin } from '@/lib/menu';
import { cartItemSchema } from '@/lib/schemas/order';
import type { CartItem } from '@/lib/cart-store';
import type { CartItemInput, OrderTypeInput } from '@/lib/schemas/order';

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
};

/**
 * Crée une commande walk-in / administrée, avec antidatage optionnel.
 *
 * Le total est TOUJOURS recalculé côté serveur (net après remises) : on ne fait
 * pas confiance à un total fourni. Retry sur conflit de l'index unique
 * (dailyDate, dailyNumber).
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

  const total = computeItemsTotal(input.items as CartItem[]);

  for (let attempt = 0; attempt < DAILY_NUMBER_MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const dailyNumber = await getNextDailyNumber(tx, dailyDate);
        const reference = generateOrderReference(dailyDate);
        const customerId = await upsertCustomerForOrder(
          tx,
          normalizedPhone,
          input.customerName
        );

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
            // Antidatage : aligner createdAt sur le jour civil ciblé pour que le
            // tri chronologique (createdAt desc) reflète la date réelle.
            ...(isBackdated ? { createdAt: dailyDate } : {}),
          },
        });

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
  /** Suppléments choisis, par nom de groupe + nom d'option (prix résolu ici). */
  supplements?: { groupName: string; optionName: string }[];
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
      const option = group?.options.find((o) => o.name === s.optionName);
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

// ─── Changement de statut ─────────────────────────────────────────────────────

/**
 * Fait transitionner une commande vers `newStatus`. Vérifie l'autorisation
 * (`canTransition` selon le rôle) et applique une concurrence optimiste : la
 * mise à jour n'a lieu que si le statut courant n'a pas changé entre temps.
 *
 * Lève `OrderMutationError` (404 introuvable, 403 transition refusée, 409
 * conflit) — à mapper en réponse HTTP par les routes.
 */
export async function setOrderStatus(
  id: string,
  newStatus: OrderStatus,
  role: UserRole
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id },
    select: { status: true },
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

  const result = await prisma.order.updateMany({
    where: { id, status: order.status },
    data: { status: newStatus },
  });

  if (result.count === 0) {
    throw new OrderMutationError(
      'État déjà modifié par un autre caissier',
      409
    );
  }
}

// ─── Encaissement / paiement ──────────────────────────────────────────────────

/**
 * Bascule l'état de paiement d'une commande. Si `isPaid=true`, `paymentMode` est
 * requis. Encaisser une commande encore `NEW` la pousse aussi en cuisine
 * (`NEW → PREPARING`). Concurrence optimiste sur `isPaid`.
 *
 * Lève `OrderMutationError` (400 mode manquant, 404 introuvable, 409 conflit).
 * Renvoie `startedPreparation` (vrai si la commande est partie en cuisine).
 */
export async function setOrderPayment(
  id: string,
  isPaid: boolean,
  paymentMode?: PaymentMode | null
): Promise<{ startedPreparation: boolean }> {
  if (isPaid && !paymentMode) {
    throw new OrderMutationError('paymentMode requis quand isPaid=true', 400);
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: { isPaid: true, status: true },
  });
  if (!order) {
    throw new OrderMutationError('Commande introuvable', 404);
  }
  if (order.isPaid === isPaid) {
    throw new OrderMutationError('État de paiement déjà à jour', 409);
  }

  const shouldStartPreparation = isPaid && order.status === 'NEW';

  const result = await prisma.order.updateMany({
    where: { id, isPaid: !isPaid },
    data: {
      isPaid,
      paymentMode: isPaid ? (paymentMode ?? null) : null,
      paidAt: isPaid ? new Date() : null,
      ...(shouldStartPreparation ? { status: 'PREPARING' as const } : {}),
    },
  });

  if (result.count === 0) {
    throw new OrderMutationError('État modifié entre temps, recharger', 409);
  }

  return { startedPreparation: shouldStartPreparation };
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
 * Lève `OrderMutationError` (400 liste vide / remise trop élevée, 404
 * introuvable, 409 commande terminée). Renvoie le nouveau total.
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

  const order = await prisma.order.findUnique({
    where: { id },
    select: { status: true },
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

  // Plafond de remise par ligne (sécurité serveur, en plus de la validation UI).
  for (const item of items) {
    if ((item.discount ?? 0) > getMaxItemDiscount(item)) {
      throw new OrderMutationError(
        `Remise trop élevée sur « ${item.productName} »`,
        400
      );
    }
  }

  // Total net recalculé côté serveur (après remises).
  const total = computeItemsTotal(items);

  await prisma.order.update({
    where: { id },
    data: { items: items as unknown as Prisma.InputJsonValue, total },
  });

  return { total };
}
