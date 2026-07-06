// app/api/push/subscribe/route.ts
//
// POST /api/push/subscribe
// Body : PushSubscription.toJSON() (endpoint + keys.p256dh + keys.auth)
//
// Enregistre l'abonnement push de l'utilisateur staff connecté. Réservé au
// backoffice (ADMIN/CASHIER/KITCHEN) — voir lib/auth-helpers.ts.

import { NextResponse } from 'next/server';
import { requireDashboardAccess } from '@/lib/auth-helpers';
import { pushSubscriptionSchema } from '@/lib/schemas/push';
import { savePushSubscription } from '@/lib/push-subscriptions';

export async function POST(request: Request) {
  let session;
  try {
    session = await requireDashboardAccess();
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

  const parsed = pushSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await savePushSubscription(
    session.user.id,
    parsed.data,
    request.headers.get('user-agent')
  );

  return NextResponse.json({ ok: true });
}
