// lib/customer-mutations.ts
//
// Rattachement / création d'un client (CRM) au fil des commandes. Le client est
// identifié par son téléphone normalisé (clé canonique). Appelé DANS la
// transaction de création de commande pour rester atomique.

import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { customerPhoneKey } from '@/lib/phone';
import {
  customerInputSchema,
  customerUpdateSchema,
} from '@/lib/schemas/customer';

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

// ─── CRM : création / modification directe d'un client ─────────────────────────

/**
 * Crée un client (CRM). Le téléphone est normalisé en clé canonique ; un doublon
 * (même numéro) est refusé avec un message lisible.
 */
export async function createCustomer(input: unknown) {
  const data = customerInputSchema.parse(input);
  const key = customerPhoneKey(data.phone);
  if (!key) throw new Error('Numéro de téléphone invalide.');
  try {
    return await prisma.customer.create({
      data: { phone: key, name: data.name?.trim() || null },
    });
  } catch (err) {
    throw rethrowDuplicatePhone(err);
  }
}

/**
 * Met à jour un client (nom et/ou téléphone). Mise à jour partielle : seuls les
 * champs fournis changent. Le téléphone reste unique.
 */
export async function updateCustomer(id: string, input: unknown) {
  const data = customerUpdateSchema.parse(input);
  const patch: Prisma.CustomerUpdateInput = {};
  if (data.name !== undefined) patch.name = data.name?.trim() || null;
  if (data.phone !== undefined) {
    const key = customerPhoneKey(data.phone);
    if (!key) throw new Error('Numéro de téléphone invalide.');
    patch.phone = key;
  }
  try {
    return await prisma.customer.update({ where: { id }, data: patch });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      throw new Error('Client introuvable.');
    }
    throw rethrowDuplicatePhone(err);
  }
}

function rethrowDuplicatePhone(err: unknown): unknown {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    return new Error('Un client utilise déjà ce numéro de téléphone.');
  }
  return err;
}
