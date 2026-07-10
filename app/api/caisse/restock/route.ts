// app/api/caisse/restock/route.ts
//
// POST /api/caisse/restock
// Réappro rapide d'un produit ou d'un « goût » (option de supplément) DEPUIS la
// caisse, sans passer par la gestion du menu. Cas pratique : une nouvelle
// fournée de tartelettes sort de cuisine → le caissier recrédite le stock du
// goût épuisé et peut l'ajouter immédiatement à une commande.
//
// Body :
//   { target: 'product', productId, delta }
//   { target: 'option',  productId, groupName, optionName, delta }
//
// Réservé à la caisse (`requireCashier`). Renvoie le nouveau stock pour que le
// client mette à jour son menu local (stock live sans rechargement).

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCashier } from '@/lib/auth-helpers';
import { restockOptionByRef, restockProductById } from '@/lib/menu-mutations';

// Plafond de garde-fou anti-faute de frappe : une fournée reste modeste.
const MAX_RESTOCK_DELTA = 500;

const bodySchema = z.discriminatedUnion('target', [
  z.object({
    target: z.literal('product'),
    productId: z.string().min(1),
    delta: z.number().int().min(1).max(MAX_RESTOCK_DELTA),
  }),
  z.object({
    target: z.literal('option'),
    productId: z.string().min(1),
    groupName: z.string().min(1),
    optionName: z.string().min(1),
    delta: z.number().int().min(1).max(MAX_RESTOCK_DELTA),
  }),
]);

// La réappro change le stock : la carte publique (ISR) doit se rafraîchir.
// Best-effort, jamais bloquant.
function revalidatePublicMenu() {
  try {
    revalidatePath('/api/menu');
    revalidatePath('/carte');
  } catch (err) {
    console.warn('[caisse/restock] revalidatePublicMenu a échoué', err);
  }
}

export async function POST(req: Request) {
  try {
    await requireCashier();
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête invalide' },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const body = parsed.data;

  try {
    const result =
      body.target === 'product'
        ? await restockProductById({
            productId: body.productId,
            delta: body.delta,
          })
        : await restockOptionByRef({
            productId: body.productId,
            groupName: body.groupName,
            optionName: body.optionName,
            delta: body.delta,
          });
    revalidatePublicMenu();
    return NextResponse.json({ ok: true, stockQuantity: result.stockQuantity });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Réappro impossible';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
