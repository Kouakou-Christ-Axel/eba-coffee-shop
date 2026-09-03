// lib/customer-search.ts
//
// Recherche de clients (CRM + caisse), au-dessus de lib/fuzzy-search.ts pour le
// nom — accents repliés, ordre des mots indifférent, tolérance aux fautes de
// frappe — et d'un match exact sur les chiffres pour le téléphone : un numéro
// ne se floute pas.
//
// Pur : aucune dépendance Prisma ni React. Consommé par lib/customers.ts
// (listCustomers), donc partagé par la liste /dashboard/clients ET le
// sélecteur de client de la caisse (app/api/customers/search).

import { createFuzzyIndex } from '@/lib/fuzzy-search';

export type CustomerSearchable = {
  id: string;
  name: string | null;
  phone: string;
};

/**
 * Classe `customers` par pertinence pour `query`. Téléphone (match exact sur
 * les chiffres saisis) en premier — signal plus fort qu'un match flou sur le
 * nom — puis les correspondances de nom, dédoublonnées par id.
 */
export function searchCustomers<T extends CustomerSearchable>(
  customers: readonly T[],
  query: string
): T[] {
  const term = query.trim();
  if (!term) return [];

  const digits = term.replace(/\D/g, '');
  const phoneMatches = digits
    ? customers.filter((c) => c.phone.includes(digits))
    : [];

  const index = createFuzzyIndex(customers, { keys: [{ name: 'name' }] });
  const nameMatches = index.search(term).map((hit) => hit.item);

  const seen = new Set<string>();
  const merged: T[] = [];
  for (const c of [...phoneMatches, ...nameMatches]) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    merged.push(c);
  }
  return merged;
}
