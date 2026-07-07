// app/api/commandes/[id]/notifications/route.ts
//
// POST   /api/commandes/:id/notifications — Body : PushSubscription.toJSON()
// DELETE /api/commandes/:id/notifications — Body : { endpoint }
//
// Abonnement push du CLIENT au suivi de SA commande (page publique
// /commande/:id) : il sera notifié des changements de statut (préparation,
// prête, récupérée, annulée, paiement validé — lib/push-notify.ts). Même
// modèle de confiance que les routes /livreur et /preuve-paiement : l'`id`
// cuid non devinable sert de capability URL. Refusé sur une commande terminée
// ou annulée (plus rien à notifier).

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  pushSubscriptionSchema,
  unsubscribePushSchema,
} from '@/lib/schemas/push';
import {
  removePushSubscription,
  saveOrderPushSubscription,
} from '@/lib/push-subscriptions';
import { sendTestPush } from '@/lib/push-notify';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;

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

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!order) {
      return NextResponse.json(
        { error: 'Commande introuvable' },
        { status: 404 }
      );
    }
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Commande terminée ou annulée : rien à suivre' },
        { status: 409 }
      );
    }

    await saveOrderPushSubscription(
      id,
      parsed.data,
      request.headers.get('user-agent')
    );

    // Preuve immédiate que l'abonnement fonctionne : un échec d'envoi ne doit
    // pas faire échouer l'activation (l'abonnement est déjà enregistré).
    try {
      await sendTestPush(
        {
          endpoint: parsed.data.endpoint,
          p256dh: parsed.data.keys.p256dh,
          auth: parsed.data.keys.auth,
        },
        {
          title: 'Notifications activées ✅',
          body: 'On te prévient dès que ta commande avance — et surtout quand c’est prêt !',
          tag: `order-status-${id}`,
          url: `/commande/${id}`,
        }
      );
    } catch (err) {
      console.error(
        '[commandes/notifications] notification de test échouée :',
        err
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/commandes/:id/notifications]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  await params; // capability URL : la suppression est par endpoint.

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

  try {
    await removePushSubscription(parsed.data.endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/commandes/:id/notifications]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
