// app/api/cron/revalidate-public/route.ts
//
// Appelée par le CD juste après le démarrage d'une nouvelle image. Le build se
// fait dans GitHub Actions sur une base vide : les pages publiques prérendues
// (ISR : accueil, carte, contact, sondages…) en sortent sans données. Cette route
// les invalide pour que la première visite les régénère depuis la vraie base.
// Même garde que `data-retention` : secret bearer, inerte (404) sans CRON_SECRET.

import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response('Non configuré', { status: 404 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Non autorisé', { status: 401 });
  }
  revalidatePath('/', 'layout');
  revalidatePath('/api/menu');
  return NextResponse.json({ ok: true });
}
