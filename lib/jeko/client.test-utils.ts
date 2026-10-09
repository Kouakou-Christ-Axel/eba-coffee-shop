export const config = {
  apiKey: 'key',
  apiKeyId: 'key-id',
  storeId: '59ae202a-f583-4a15-970f-9e99bd1e0baa',
};

export const input = {
  reference: 'EBA-0012-1',
  amountFcfa: 3485,
  paymentMethod: 'wave' as const,
  successUrl: 'https://eba-coffee.com/commande/o1?paiement=ok',
  errorUrl: 'https://eba-coffee.com/commande/o1?paiement=echec',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
