// lib/schemas/push.ts
//
// Schémas Zod pour les notifications push (backoffice). `pushSubscriptionSchema`
// valide le shape renvoyé par `PushSubscription.toJSON()` côté navigateur
// (PushManager.subscribe) avant persistance (lib/push-subscriptions.ts).

import { z } from 'zod';

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const unsubscribePushSchema = z.object({
  endpoint: z.string().url(),
});
