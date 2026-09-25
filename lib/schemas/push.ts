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

/**
 * Alerte « de retour en stock » (carte publique, `/api/menu/alertes`) : un
 * produit, ou un goût précis désigné par NOMS (groupe + option), comme dans
 * le panier. `subscription` = `PushSubscription.toJSON()` de l'appareil.
 */
export const restockAlertTargetSchema = z
  .object({
    productId: z.string().min(1).max(100),
    groupName: z.string().min(1).max(100).optional(),
    optionName: z.string().min(1).max(100).optional(),
  })
  .refine((d) => (d.groupName === undefined) === (d.optionName === undefined), {
    message: 'Groupe et option vont ensemble',
    path: ['optionName'],
  });

export const restockAlertSchema = z.object({
  target: restockAlertTargetSchema,
  subscription: pushSubscriptionSchema,
});

export const restockAlertRemoveSchema = z.object({
  target: restockAlertTargetSchema,
  endpoint: z.string().url(),
});

export type RestockAlertTarget = z.infer<typeof restockAlertTargetSchema>;

/** Clé d'unicité d'une cible d'alerte, par appareil (`RestockAlert.targetKey`)
 * — aussi la clé du souvenir local côté navigateur (use-restock-alert.ts). */
export function restockTargetKey(t: RestockAlertTarget): string {
  return t.groupName && t.optionName
    ? `${t.productId}|${t.groupName}|${t.optionName}`
    : t.productId;
}
