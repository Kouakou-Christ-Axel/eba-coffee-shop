// GET /api/inventory/search?q=
// Références d'inventaire correspondant à `q` (nom, SKU, catégorie), classées :
// `{ hits: [{ id, score }] }`. Les écrans filtrent et classent leur liste déjà
// chargée avec ces ids (cf. `useSearchHits`).

import { NextResponse } from 'next/server';
import { requireRoleOrAnalyst, ROLE_GROUPS } from '@/lib/auth-helpers';
import { searchInventoryItemHits } from '@/lib/inventory-search';
import { searchResponse } from '@/lib/search/route';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await requireRoleOrAnalyst(ROLE_GROUPS.KITCHEN_PLUS);
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  return searchResponse(req, searchInventoryItemHits, '/api/inventory/search');
}
