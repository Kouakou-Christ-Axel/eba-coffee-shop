// lib/jeko/webhook-payload.ts
//
// Analyse du corps d'un webhook Jèko. `TRANSACTION_COMPLETED` est la transaction
// elle-même, sans enveloppe. L'URL de webhook reçoit TOUTES les transactions du
// magasin (reversements, liens de paiement, encaissements hors site) : on ne
// retient que les paiements portant une référence ; le reste renvoie `null` et
// l'appelant répond 200 sans rien faire.

import { z } from 'zod';
import { CENTS_PER_FCFA, type JekoStatus } from './client';

const transactionSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'success', 'error']),
  transactionType: z.literal('payment'),
  amount: z.object({ amount: z.number() }),
  fees: z.object({ amount: z.number() }).optional(),
  paymentMethod: z.string().optional(),
  transactionDetails: z.object({
    id: z.string().optional(),
    reference: z.string().min(1),
  }),
});

export type JekoTransaction = {
  transactionId: string;
  status: JekoStatus;
  amountFcfa: number;
  gatewayFeeFcfa: number;
  paymentMethod: string | null;
  reference: string;
  paymentRequestId: string | null;
};

export function parseJekoTransaction(body: unknown): JekoTransaction | null {
  const parsed = transactionSchema.safeParse(body);
  if (!parsed.success) return null;
  const t = parsed.data;
  return {
    transactionId: t.id,
    status: t.status,
    amountFcfa: t.amount.amount / CENTS_PER_FCFA,
    gatewayFeeFcfa: (t.fees?.amount ?? 0) / CENTS_PER_FCFA,
    paymentMethod: t.paymentMethod ?? null,
    reference: t.transactionDetails.reference,
    paymentRequestId: t.transactionDetails.id ?? null,
  };
}
