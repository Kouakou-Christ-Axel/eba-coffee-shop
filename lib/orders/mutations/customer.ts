// lib/orders/mutations/customer.ts
//
// Mutations de commandes — customer (extrait de lib/order-mutations.ts, sans changement de comportement).

import prisma from '@/lib/prisma';
import { upsertCustomerForOrder } from '@/lib/customer-mutations';
import { awardLoyaltyForOrder } from '@/lib/loyalty-mutations';
import { normalizeIvorianPhone } from '@/lib/phone';
import { OrderMutationError } from './errors';

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
 * invalide, 409 si `customerId` a changé entre la lecture et l'écriture —
 * un autre caissier a modifié le client entre-temps). Renvoie l'`id` client
 * final (ou null si détaché).
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
      const result = await tx.order.updateMany({
        where: { id: orderId, customerId: order.customerId },
        data: { customerId: null },
      });
      if (result.count === 0) {
        throw new OrderMutationError(
          'Client déjà modifié entre-temps, recharger',
          409
        );
      }
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

    const result = await tx.order.updateMany({
      where: { id: orderId, customerId: order.customerId },
      data: { customerId, customerName, customerPhone },
    });
    if (result.count === 0) {
      throw new OrderMutationError(
        'Client déjà modifié entre-temps, recharger',
        409
      );
    }

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
