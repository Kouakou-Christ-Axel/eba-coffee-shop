// app/api/internal/revalidate/route.ts
//
// POST /api/internal/revalidate — réchauffage d'un déploiement. L'image Docker est
// construite sur une base vide : le HTML ISR prérendu (accueil, carte, sondages,
// sitemap, llms.txt) serait servi vide jusqu'à son `revalidate`. `deploy/deploy.sh`
// appelle cette route sur la NOUVELLE couleur avant la bascule, puis télécharge
// chaque page pour la régénérer avec la vraie base. Même garde que les crons :
// secret bearer (CRON_SECRET), route inerte (404) s'il n'est pas configuré.

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Pages ISR (ou prérendues) qui lisent la base. À tenir alignée avec `deploy/deploy.sh`. */
export const WARMUP_PATHS = [
  '/',
  '/carte',
  '/sondages',
  '/sitemap.xml',
  '/llms.txt',
  '/api/menu',
] as const;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response('Non configuré', { status: 404 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Non autorisé', { status: 401 });
  }
  for (const path of WARMUP_PATHS) revalidatePath(path);
  return NextResponse.json({ ok: true, paths: WARMUP_PATHS });
}
