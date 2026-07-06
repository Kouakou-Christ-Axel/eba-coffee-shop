// app/api/push/unsubscribe/route.ts
//
// POST /api/push/unsubscribe
// Body : { endpoint: string }
//
// Supprime un abonnement push. Pas de vérification de propriété (l'endpoint
// est un identifiant opaque non énumérable) — seul un utilisateur staff
// connecté peut appeler cette route.

import { NextResponse } from 'next/server';
import { requireDashboardAccess } from '@/lib/auth-helpers';
import { unsubscribePushSchema } from '@/lib/schemas/push';
import { removePushSubscription } from '@/lib/push-subscriptions';

export async function POST(request: Request) {
  try {
    await requireDashboardAccess();
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête invalide' },
      { status: 400 }
    );
  }

  const parsed = unsubscribePushSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await removePushSubscription(parsed.data.endpoint);

  return NextResponse.json({ ok: true });
}
