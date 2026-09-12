// app/api/customers/by-phone/route.ts
//
// GET /api/customers/by-phone?phone=...
//
// Lookup EXACT d'un client par téléphone (clé canonique), depuis la caisse :
// le champ « Téléphone » du formulaire « Nouvelle commande » l'appelle pour
// détecter qu'un numéro saisi correspond déjà à un client, et rattacher la
// commande à ce client plutôt que d'écraser son nom.
//
// Différent de `/api/customers/search` (recherche floue, plusieurs
// résultats possibles) : ici on veut UN client, identifié par la clé
// canonique du téléphone (`getCustomerByPhone`).

import { NextResponse } from 'next/server';
import { requireCashier } from '@/lib/auth-helpers';
import { getCustomerByPhone } from '@/lib/customers';

export async function GET(req: Request) {
  try {
    await requireCashier();
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const phone = new URL(req.url).searchParams.get('phone')?.trim() ?? '';
  if (!phone) {
    return NextResponse.json({ customer: null });
  }

  try {
    const customer = await getCustomerByPhone(phone);
    return NextResponse.json({
      customer: customer
        ? { id: customer.id, name: customer.name, phone: customer.phone }
        : null,
    });
  } catch (err) {
    console.error('[GET /api/customers/by-phone]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
