// lib/online-payment-config.ts
//
// Ce que le checkout lit de `GET /api/paiement/config`. La réponse vient du
// réseau : on n'en croit que ce qui est bien formé, et on ne propose JAMAIS un
// moyen que le serveur ne sait pas traiter (un moyen inconnu ferait échouer la
// commande). Sans import serveur : module chargé côté navigateur.

import { z } from 'zod';
import {
  JEKO_PAYMENT_METHODS,
  type JekoPaymentMethod,
} from '@/lib/jeko/payment-methods';

export type OnlinePaymentConfig = {
  enabled: boolean;
  feePercent: number;
  methods: JekoPaymentMethod[];
};

const responseSchema = z.object({
  enabled: z.boolean(),
  feePercent: z.number().finite().nonnegative(),
  methods: z.array(z.string()),
});

const isKnownMethod = (m: string): m is JekoPaymentMethod =>
  (JEKO_PAYMENT_METHODS as readonly string[]).includes(m);

export function parseOnlinePaymentConfig(
  data: unknown
): OnlinePaymentConfig | null {
  const parsed = responseSchema.safeParse(data);
  if (!parsed.success) return null;

  const methods = parsed.data.methods.filter(isKnownMethod);
  return {
    // « Actif » sans aucun moyen utilisable ne peut rien encaisser.
    enabled: parsed.data.enabled && methods.length > 0,
    feePercent: parsed.data.feePercent,
    methods,
  };
}
