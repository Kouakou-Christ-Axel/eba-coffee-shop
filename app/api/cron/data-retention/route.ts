// app/api/cron/data-retention/route.ts
//
// Déclencheur externe (cron quotidien) de la purge des données personnelles
// échues. Même garde que app/api/inventory/reminder-check : secret bearer
// (CRON_SECRET), route inerte (404) s'il n'est pas configuré.

import { NextResponse } from 'next/server';
import { purgeExpiredPersonalData } from '@/lib/data-retention';

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
  const report = await purgeExpiredPersonalData();
  return NextResponse.json({ ok: true, report });
}
