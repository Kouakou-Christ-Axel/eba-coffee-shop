// lib/customer-mutations.ts
//
// Rattachement / création d'un client (CRM) au fil des commandes. Le client est
// identifié par son téléphone normalisé (clé canonique). Appelé DANS la
// transaction de création de commande pour rester atomique.

import { Prisma } from '@/generated/prisma/client';
import { customerPhoneKey } from '@/lib/phone';

/**
 * Upsert d'un client à partir du téléphone d'une commande, et renvoie son `id`
 * (ou null si aucun téléphone exploitable → commande anonyme). Met à jour le
 * `name` avec le dernier nom connu quand il est fourni.
 */
export async function upsertCustomerForOrder(
  tx: Prisma.TransactionClient,
  rawPhone: string | null | undefined,
  name: string | null | undefined
): Promise<string | null> {
  const key = customerPhoneKey(rawPhone);
  if (!key) return null;

  const cleanName = name?.trim() || null;
  const customer = await tx.customer.upsert({
    where: { phone: key },
    create: { phone: key, name: cleanName },
    update: cleanName ? { name: cleanName } : {},
  });
  return customer.id;
}
