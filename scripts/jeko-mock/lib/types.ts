export const SUPPORTED_METHODS = [
  'wave',
  'orange',
  'mtn',
  'moov',
  'djamo',
  'jeko',
];
// Jèko Checkout prélève 1,5 % (page Tarifs de la doc).
export const FEE_RATE = 0.015;

export type JekoMockOptions = {
  apiKey: string;
  apiKeyId: string;
  /** Secret qui signe les webhooks envoyés à l'application. */
  webhookSecret: string;
  /** URL du webhook de l'application, ex. http://localhost:3000/api/webhooks/jeko */
  webhookUrl: string;
  port: number;
  host?: string;
};

export type PaymentRequest = {
  id: string;
  storeId: string;
  reference: string;
  amountCents: number;
  paymentMethod: string;
  status: 'pending' | 'success' | 'error';
  errorReason: string | null;
  successUrl: string;
  errorUrl: string;
  transactionId: string | null;
  executedAt: string | null;
};
