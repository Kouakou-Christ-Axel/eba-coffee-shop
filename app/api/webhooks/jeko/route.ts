// app/api/webhooks/jeko/route.ts
//
// Webhook Jèko (`TRANSACTION_COMPLETED`). Source de vérité du paiement en ligne.
//
// - Secret absent : route inerte (404), comme `/api/inventory/reminder-check`.
// - La signature `Jeko-Signature` est vérifiée sur le corps BRUT (`req.text()`),
//   AVANT toute lecture du JSON.
// - Jèko envoie à CETTE URL toutes les transactions du magasin : ce qui n'est pas
//   un de nos paiements est acquitté (200) sans rien faire, sinon Jèko réessaierait
//   puis désactiverait le webhook après 15 échecs consécutifs.
// - Une erreur de traitement répond 500 : Jèko réessaie (3 livraisons au plus).

import { NextResponse } from 'next/server';
import { jekoWebhookSecret } from '@/lib/jeko/config';
import { expirePendingOrders } from '@/lib/jeko/expiry';
import { settleJekoTransaction } from '@/lib/jeko/settle';
import { verifyJekoSignature } from '@/lib/jeko/signature';
import { parseJekoTransaction } from '@/lib/jeko/webhook-payload';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const secret = jekoWebhookSecret();
  if (!secret) {
    return new Response('Non configuré', { status: 404 });
  }

  const raw = await req.text();
  if (!verifyJekoSignature(raw, req.headers.get('Jeko-Signature'), secret)) {
    return new Response('Signature invalide', { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('JSON invalide', { status: 400 });
  }

  const tx = parseJekoTransaction(body);
  if (!tx) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const outcome = await settleJekoTransaction(tx);
    // Nettoyage opportuniste des commandes expirées (pas de cron) : jamais
    // bloquant, la réponse à Jèko n'en dépend pas.
    void expirePendingOrders().catch(() => {});
    return NextResponse.json({ ok: true, outcome });
  } catch (err) {
    console.error('[jeko] règlement du webhook échoué :', err);
    return new Response('Erreur de traitement', { status: 500 });
  }
}
