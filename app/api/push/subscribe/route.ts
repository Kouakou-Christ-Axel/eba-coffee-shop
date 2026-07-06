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
import { sendTestPush } from '@/lib/push-notify';

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

  // Preuve immédiate que l'abonnement fonctionne : un échec d'envoi ne doit
  // pas faire échouer l'activation (l'abonnement est déjà enregistré).
  try {
    await sendTestPush({
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    });
  } catch (err) {
    console.error('[push/subscribe] notification de test échouée :', err);
  }

  return NextResponse.json({ ok: true });
}
