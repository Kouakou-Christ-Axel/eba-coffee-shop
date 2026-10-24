// app/api/customers/search/route.ts
//
// GET /api/customers/search?q=...
// Recherche de clients existants depuis la caisse (autocomplétion du champ
// téléphone de l'écran « Nouvelle commande »).
//
// Réutilise `listCustomers` (lib/customers.ts) — qui recherche déjà par nom OU
// chiffres du téléphone — et renvoie une charge allégée (id, name, phone).
// `listCustomers` ne calcule plus les stats par défaut : plus d'agrégation sur
// les commandes à chaque frappe de la caisse.

import { NextResponse } from 'next/server';
import { requireCashier } from '@/lib/auth-helpers';
import { listCustomers } from '@/lib/customers';
import { allowCustomerLookup } from '@/lib/enumeration-rate-limit';

// 3 caractères minimum et 8 résultats au plus : une saisie de 1-2 lettres ne doit
// pas permettre de parcourir tout le fichier clients.
const MIN_QUERY_LENGTH = 3;
const MAX_RESULTS = 8;

export async function GET(req: Request) {
  let userId: string;
  try {
    userId = (await requireCashier()).user.id;
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  if (!allowCustomerLookup(`search:${userId}`)) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 });
  }

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ customers: [] });
  }

  try {
    const { customers } = await listCustomers({ search: q });
    return NextResponse.json({
      customers: customers.slice(0, MAX_RESULTS).map((c) => ({
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
