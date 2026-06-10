// app/api/customers/search/route.ts
//
// GET /api/customers/search?q=...
// Recherche de clients existants depuis la caisse (autocomplétion du champ
// téléphone de l'écran « Nouvelle commande »).
//
// Réutilise `listCustomers` (lib/customers.ts) — qui recherche déjà par nom OU
// chiffres du téléphone — et renvoie une charge allégée (id, name, phone), sans
// les stats CRM dont le sélecteur n'a pas besoin.

import { NextResponse } from 'next/server';
import { requireCashier } from '@/lib/auth-helpers';
import { listCustomers } from '@/lib/customers';

const MIN_QUERY_LENGTH = 2;

export async function GET(req: Request) {
  try {
    await requireCashier();
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ customers: [] });
  }

  try {
    const { customers } = await listCustomers({ search: q });
    return NextResponse.json({
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
      })),
    });
  } catch (err) {
    console.error('[GET /api/customers/search]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
