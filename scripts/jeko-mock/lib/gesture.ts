import { randomUUID } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import type { JekoMockOptions, PaymentRequest } from './types';
import { sendWebhook } from './webhook';

/** Gestes du « client » sur la page de paiement factice. */
export async function gesture(
  options: JekoMockOptions,
  r: PaymentRequest,
  action: string,
  res: ServerResponse
) {
  const redirect = (url: string) => {
    res.writeHead(303, { Location: url });
    res.end();
  };

  if (action === 'abandon') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(
      '<p>Vous avez quitté la page de paiement. Rien n’a changé : la commande attend toujours son paiement.</p>'
    );
  }
  // Une demande déjà réglée ou échouée ne se rejoue pas.
  if (r.status !== 'pending') {
    return redirect(r.status === 'success' ? r.successUrl : r.errorUrl);
  }
  if (action === 'fail') {
    r.status = 'error';
    r.errorReason = 'insufficient_balance';
    return redirect(r.errorUrl);
  }
  // 'pay' (avec webhook) ou 'pay-silent' (sans)
  r.status = 'success';
  r.transactionId = `txn_${randomUUID().slice(0, 8)}`;
  r.executedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (action === 'pay') await sendWebhook(options, r);
  redirect(r.successUrl);
}
