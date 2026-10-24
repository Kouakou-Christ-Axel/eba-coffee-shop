// GET /api/expenses/articles/search?q=
// Articles de dépense correspondant à `q`, classés : `{ hits: [{ id, score }] }`.
// Le formulaire de dépense filtre son référentiel déjà chargé avec ces ids
// (cf. `useSearchHits`).

import { NextResponse } from 'next/server';
import { requireRoleOrAnalyst, ROLE_GROUPS } from '@/lib/auth-helpers';
import { searchExpenseArticleHits } from '@/lib/expense-articles-search';
import { searchResponse } from '@/lib/search/route';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await requireRoleOrAnalyst(ROLE_GROUPS.FINANCE);
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  return searchResponse(
    req,
    searchExpenseArticleHits,
    '/api/expenses/articles/search'
  );
}
