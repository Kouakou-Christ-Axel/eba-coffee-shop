// lib/mcp/tools/orders-ops.ts
//
// Outils MCP — commandes — opérations (statut, paiement, remise, édition).

import { z } from 'zod';
import { extendClosingToday, getRangesForDay } from '@/lib/pickup-settings';
import {
  getPickupSettings,
  updatePickupSettings,
} from '@/lib/pickup-settings-db';
import { getOrder } from '@/lib/orders';
import { updateOrderItems, OrderMutationError } from '@/lib/order-mutations';
import type { CartItem } from '@/lib/cart-store';
import { idSchema } from './helpers';
import type { McpTool } from './types';

export const ordersOpsTools: McpTool[] = [
  {
    name: 'extend_today_closing',
    toolset: 'commandes',
    title: 'Repousser la fermeture du jour',
    description:
      "Repousse l'heure de fermeture d'AUJOURD'HUI de `minutes` minutes, pour " +
      'garder la carte accessible côté client plus longtemps (popup « fermé » ' +
      'et créneaux de retrait proposés au-delà de l’horaire habituel). Étend ' +
      'le dernier créneau du jour (exception de date déjà en place pour ' +
      "aujourd'hui, sinon horaires hebdomadaires par défaut), plafonné à " +
      "23:59. Échoue si le magasin est marqué fermé aujourd'hui — ce n'est " +
      'pas un moyen d’ouvrir un jour fermé. Revient automatiquement aux ' +
      'horaires normaux dès demain (exception ponctuelle par date, pas un ' +
      'changement permanent des horaires hebdomadaires).',
    inputSchema: z.object({
      minutes: z
        .number()
        .int()
        .min(1)
        .max(720)
        .describe('Minutes à ajouter à la fermeture du jour (1 à 720).'),
    }),
    readOnly: false,
    handler: async (args) => {
      const { minutes } = args as { minutes: number };
      const settings = await getPickupSettings();
      const next = extendClosingToday(settings, minutes);
      await updatePickupSettings(next);
      const ranges = getRangesForDay(new Date(), next);
      const newClosingTime = ranges.reduce(
        (max, r) => (r.end > max ? r.end : max),
        '00:00'
      );
      return { newClosingTime };
    },
  },
  {
    name: 'apply_order_discount',
    toolset: 'commandes',
    title: 'Appliquer une remise à une commande',
    description:
      'Applique une remise (montant fixe FCFA) à une ou plusieurs lignes d’une ' +
      'commande existante. Chaque ligne est ciblée par son `cartId` (visible ' +
      'dans les `items` renvoyés par `list_orders`). `discount` est le montant ' +
      'retiré de la ligne (0 pour annuler une remise), plafonné à un pourcentage ' +
      'du montant de la ligne ; `reason` est un motif optionnel. Les lignes non ' +
      'citées sont inchangées. Le total de la commande est recalculé. Refusé sur ' +
      'une commande terminée ou annulée.',
    inputSchema: z.object({
      id: idSchema,
      lines: z
        .array(
          z.object({
            cartId: z
              .string()
              .min(1)
              .describe('Identifiant de ligne (cf. `items` de `list_orders`).'),
            discount: z
              .number()
              .int()
              .nonnegative()
              .describe('Montant de remise en FCFA (0 = retirer la remise).'),
            reason: z.string().max(120).nullable().optional(),
          })
        )
        .min(1, 'Au moins une ligne'),
    }),
    readOnly: false,
    handler: async (args) => {
      const { id, lines } = args as {
        id: string;
        lines: { cartId: string; discount: number; reason?: string | null }[];
      };

      const order = await getOrder(id);
      if (!order) {
        throw new OrderMutationError('Commande introuvable', 404);
      }

      const items = order.items as CartItem[];
      const byCartId = new Map(lines.map((l) => [l.cartId, l]));

      // Toutes les lignes ciblées doivent exister dans la commande.
      for (const l of lines) {
        if (!items.some((it) => it.cartId === l.cartId)) {
          throw new OrderMutationError(
            `Ligne introuvable dans la commande : ${l.cartId}`,
            400
          );
        }
      }

      const updated = items.map((it) => {
        const l = byCartId.get(it.cartId);
        if (!l) return it;
        return {
          ...it,
          discount: l.discount,
          discountReason: l.reason ?? null,
        };
      });

      const { total } = await updateOrderItems(id, updated);
      return { ok: true, id, total };
    },
  },
];
