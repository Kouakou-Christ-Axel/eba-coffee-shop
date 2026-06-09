// lib/order-mutations.ts
//
// Logique de création de commande « caisse / administration », partagée entre :
//   - la route walk-in `POST /api/caisse/orders` (caissier authentifié)
//   - l'outil MCP `create_order` (client comme Claude)
//
// Différences avec `createOrder` (lib/orders.ts, flux online public) :
//   - `customerName` / `customerPhone` optionnels (commande anonyme possible)
//   - `orderType` libre (DELIVERY / DINE_IN / TAKEAWAY)
//   - `note` possible
//   - ANTIDATAGE : `orderDate` (YYYY-MM-DD) permet de rattacher la commande à un
//     jour civil passé. Absent = jour en cours. Le `createdAt` est alors aligné
//     sur ce jour pour conserver un tri chronologique cohérent dans l'historique.
//
// Aucune logique métier n'est dupliquée ailleurs : la numérotation quotidienne
// (`getNextDailyNumber`), l'upsert client et l'attribution de fidélité sont
// réutilisés tels quels.

import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import {
  getNextDailyNumber,
  todayDailyDate,
  DAILY_NUMBER_MAX_RETRIES,
} from '@/lib/daily-numbering';
import { generateOrderReference } from '@/lib/orders';
import { upsertCustomerForOrder } from '@/lib/customer-mutations';
import { awardLoyaltyForOrder } from '@/lib/loyalty-mutations';
import { normalizeIvorianPhone } from '@/lib/phone';
import { computeItemsTotal } from '@/lib/orders/totals';
import { parseDateOnlyToUTC } from '@/lib/timezone';
import { getMenuAdmin } from '@/lib/menu';
import { cartItemSchema } from '@/lib/schemas/order';
import type { CartItem } from '@/lib/cart-store';
import type { CartItemInput, OrderTypeInput } from '@/lib/schemas/order';

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
