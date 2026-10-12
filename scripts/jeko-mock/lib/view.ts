import { FEE_RATE, type PaymentRequest } from './types';

export function paymentRequestView(r: PaymentRequest, baseUrl: string) {
  return {
    id: r.id,
    storeId: r.storeId,
    reference: r.reference,
    type: 'redirect',
    paymentMethod: r.paymentMethod,
    status: r.status,
    errorReason: r.errorReason,
    redirectUrl: `${baseUrl}/pay/${r.id}`,
    transaction:
      r.status === 'success'
        ? {
            id: r.transactionId,
            amount: { amount: r.amountCents, currency: 'XOF' },
            fees: {
              amount: Math.round(r.amountCents * FEE_RATE),
              currency: 'XOF',
            },
            status: 'success',
            counterpartLabel: 'Client factice',
            counterpartIdentifier: '+2250700000000',
            description: `Paiement ${r.reference}`,
            executedAt: r.executedAt,
          }
        : null,
  };
}
