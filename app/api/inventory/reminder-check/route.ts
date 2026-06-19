// app/api/inventory/reminder-check/route.ts
//
// Déclencheur externe (cron) du rappel email d'inventaire. Protégé par un secret
// bearer (CRON_SECRET). Si le secret n'est pas configuré, la route est inerte
// (404). maybeSendInventoryReminder est idempotent (≤ 1 envoi / 24 h).

import { NextResponse } from 'next/server';
import { maybeSendInventoryReminder } from '@/lib/inventory-mutations';

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

  await maybeSendInventoryReminder();
  return NextResponse.json({ ok: true });
}
