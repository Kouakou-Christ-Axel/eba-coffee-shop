import { createHmac } from 'node:crypto';
import { FEE_RATE, type JekoMockOptions, type PaymentRequest } from './types';

/** Webhook `TRANSACTION_COMPLETED` signé (HMAC-SHA256 du corps brut). */
export async function sendWebhook(options: JekoMockOptions, r: PaymentRequest) {
  const raw = JSON.stringify({
    id: r.transactionId,
    amount: { amount: r.amountCents, currency: 'XOF' },
    fees: { amount: Math.round(r.amountCents * FEE_RATE), currency: 'XOF' },
    status: 'success',
    counterpartLabel: 'Client factice',
    counterpartIdentifier: '+2250700000000',
    paymentMethod: r.paymentMethod,
    transactionType: 'payment',
    storeId: r.storeId,
    description: `Paiement ${r.reference}`,
    executedAt: r.executedAt,
    transactionDetails: { id: r.id, reference: r.reference },
  });
  const signature = createHmac('sha256', options.webhookSecret)
    .update(raw)
    .digest('hex');
  try {
    const res = await fetch(options.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Jeko-Signature': signature,
        'Jeko-Event': 'TRANSACTION_COMPLETED',
      },
      body: raw,
    });
    console.log(`[jeko-mock] webhook ${r.reference} → ${res.status}`);
  } catch (err) {
    console.error(`[jeko-mock] webhook ${r.reference} injoignable :`, err);
  }
}
