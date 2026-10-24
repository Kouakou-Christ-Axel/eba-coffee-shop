// lib/search/route.ts
//
// Corps commun des routes `GET …/search?q=` : validation de la saisie et forme
// de la réponse `{ hits: [{ id, score }] }`. L'authentification reste dans la
// route (chaque domaine a ses rôles).

import { NextResponse } from 'next/server';
import type { SearchHit } from './trgm';

export const MAX_SEARCH_QUERY_LENGTH = 100;

export async function searchResponse(
  req: Request,
  search: (term: string) => Promise<SearchHit[]>,
  routeName: string
) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q === '') return NextResponse.json({ hits: [] });
  try {
    const hits = await search(q.slice(0, MAX_SEARCH_QUERY_LENGTH));
    return NextResponse.json(
      { hits },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error(`[GET ${routeName}]`, err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
