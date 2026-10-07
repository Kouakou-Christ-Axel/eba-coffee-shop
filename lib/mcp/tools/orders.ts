// lib/mcp/tools/orders.ts
//
// Outils MCP — commandes — lecture et création.

import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseDateOnlyToUTC } from '@/lib/timezone';
import { listOrders } from '@/lib/orders';
import {
  createCashierOrder,
  buildOrderItemsFromMenu,
  setOrderStatus,
  setOrderPayment,
  updateOrderDetails,
  type OrderItemRef,
} from '@/lib/order-mutations';
import {
  orderTypeSchema,
  orderStatusSchema,
  paymentModeSchema,
  isBackdateCompatibleWithPickup,
  BACKDATE_PICKUP_CONFLICT_MESSAGE,
} from '@/lib/schemas/order';
import { idSchema, dateOnly } from './helpers';
import type { McpTool } from './types';

export const ordersTools: McpTool[] = [
  // — Commandes (écriture) —
  {
    name: 'create_order',
    toolset: 'commandes',
    title: 'Enregistrer une commande',
    description:
      'Enregistre une commande (utile pour saisir des commandes anciennes). ' +
      '`orderDate` (`YYYY-MM-DD`, jour civil Abidjan) ANTIDATE la commande ; ' +
      'omis = jour en cours. `items` référence les produits par `productId` ' +
      '(issu de `get_menu`) avec une `quantity` ; les prix, coûts et prix des ' +
      'suppléments sont résolus depuis le menu — ne les fournis pas. Les ' +
      'suppléments se désignent par `groupName` + `optionName`, avec une ' +
      '`quantity` optionnelle (défaut 1) pour les groupes type « quantity » ' +
      '(répartition, ex. 2x un goût). Le total est ' +
      'calculé côté serveur (net après remises). `orderType` ∈ ' +
      'DELIVERY/DINE_IN/TAKEAWAY (défaut TAKEAWAY). `customerName`, ' +
      '`customerPhone` (normalisé, rattache la fidélité) et `note` sont ' +
      'optionnels. Renvoie l’`id`, la `reference` et le `dailyNumber`.',
    inputSchema: z.object({
      orderDate: dateOnly
        .nullable()
        .optional()
        .describe('Jour civil d’antidatage (YYYY-MM-DD). Omis = aujourd’hui.'),
      items: z
        .array(
          z.object({
            productId: idSchema.describe('`id` produit (cf. `get_menu`).'),
            quantity: z.number().int().positive(),
            supplements: z
              .array(
                z.object({
                  groupName: z.string().min(1),
                  optionName: z.string().min(1),
                  quantity: z
                    .number()
                    .int()
                    .positive()
                    .optional()
                    .describe(
                      'Nombre de fois choisi (groupe type "quantity"). Défaut 1.'
                    ),
                })
              )
              .optional()
              .describe('Suppléments choisis (groupe + option, par nom).'),
            discount: z
              .number()
              .int()
              .nonnegative()
              .optional()
              .describe('Remise ligne (montant fixe FCFA), plafonnée.'),
            discountReason: z.string().max(120).nullable().optional(),
          })
        )
        .min(1, 'Au moins 1 article'),
      orderType: orderTypeSchema.optional(),
      customerName: z.string().trim().max(50).nullable().optional(),
      customerPhone: z.string().trim().max(30).nullable().optional(),
      note: z.string().trim().max(500).nullable().optional(),
      pickupTime: z
        .string()
        .datetime()
        .nullable()
        .optional()
        .describe(
          'Créneau de retrait, ISO 8601. Absent = « dès que possible ». Un ' +
            'retrait un JOUR ULTÉRIEUR crée une commande DIFFÉRÉE : elle ne ' +
            'décompte PAS le stock du jour et n’entre en cuisine que sur le ' +
            'geste « Lancer la préparation », le jour venu. Incompatible avec ' +
            '`orderDate` (antidatage) sauf pour le même jour civil.'
        ),
    }),
    readOnly: false,
    handler: async (args) => {
      const a = args as {
        orderDate?: string | null;
        items: OrderItemRef[];
        orderType?: 'DELIVERY' | 'DINE_IN' | 'TAKEAWAY';
        customerName?: string | null;
        customerPhone?: string | null;
        note?: string | null;
        pickupTime?: string | null;
      };
      if (!isBackdateCompatibleWithPickup(a)) {
        throw new Error(BACKDATE_PICKUP_CONFLICT_MESSAGE);
      }
      const items = await buildOrderItemsFromMenu(a.items);
      const order = await createCashierOrder({
        items,
        orderType: a.orderType ?? 'TAKEAWAY',
        orderDate: a.orderDate ?? null,
        customerName: a.customerName ?? null,
        customerPhone: a.customerPhone ?? null,
        note: a.note ?? null,
        pickupTime: a.pickupTime ?? null,
        source: 'MCP',
      });
      return {
        id: order.id,
        reference: order.reference,
        dailyDate: order.dailyDate,
        dailyNumber: order.dailyNumber,
        total: order.total,
      };
    },
  },
  {
    name: 'list_orders',
    toolset: 'commandes',
    title: 'Lister les commandes',
    description:
      'Renvoie les commandes (les plus récentes d’abord) avec leur `id`, ' +
      '`dailyNumber`, `reference`, statut, état de paiement, total et client. ' +
      'Filtres optionnels : `status` (NEW/PREPARING/READY/COMPLETED/CANCELLED), ' +
      'plage de jours `from`/`to` (`YYYY-MM-DD`, jour civil Abidjan), `search` ' +
      '(référence, nom ou téléphone), `page` (20 par page). Utilise l’`id` ' +
      'renvoyé pour `set_order_status` / `mark_order_paid`.',
    inputSchema: z.object({
      status: orderStatusSchema.optional(),
      from: dateOnly.optional().describe('Jour de début (inclus), YYYY-MM-DD.'),
      to: dateOnly.optional().describe('Jour de fin (inclus), YYYY-MM-DD.'),
      search: z.string().optional(),
      page: z.number().int().positive().optional(),
    }),
    readOnly: true,
    handler: (args) => {
      const a = args as {
        status?: z.infer<typeof orderStatusSchema>;
        from?: string;
        to?: string;
        search?: string;
        page?: number;
      };
      return listOrders({
        page: a.page ?? 1,
        status: a.status,
        dateFrom: parseDateOnlyToUTC(a.from),
        dateTo: parseDateOnlyToUTC(a.to),
        search: a.search,
      });
    },
  },
  {
    name: 'set_order_status',
    toolset: 'commandes',
    title: 'Changer le statut d’une commande',
    description:
      'Fait passer une commande à un nouveau `status` ' +
      '(NEW → PREPARING → READY → COMPLETED, ou CANCELLED). « Récupérée » = ' +
      'COMPLETED. Les transitions invalides sont refusées. `id` provient de ' +
      '`list_orders`.',
    inputSchema: z.object({
      id: idSchema,
      status: orderStatusSchema,
    }),
    readOnly: false,
    handler: async (args) => {
      const { id, status } = args as {
        id: string;
        status: z.infer<typeof orderStatusSchema>;
      };
      // Le serveur MCP agit avec les pleins droits (jeton d’administration).
      await setOrderStatus(id, status, 'ADMIN');
      return { ok: true, id, status };
    },
  },
  {
    name: 'mark_order_paid',
    toolset: 'commandes',
    title: 'Encaisser une commande',
    description:
      'Marque une commande comme payée avec un `paymentMode` ∈ ' +
      'CASH/WAVE/ORANGE_MONEY/OTHER. Encaisser une commande encore NEW la pousse aussi en ' +
      'cuisine (passe en PREPARING). `id` provient de `list_orders`.',
    inputSchema: z.object({
      id: idSchema,
      paymentMode: paymentModeSchema,
    }),
    readOnly: false,
    handler: async (args) => {
      const { id, paymentMode } = args as {
        id: string;
        paymentMode: z.infer<typeof paymentModeSchema>;
      };
      const order = await prisma.order.findUnique({
        where: { id },
        select: { total: true, depositPaid: true },
      });
      if (!order) throw new Error('Commande introuvable');
      const { startedPreparation } = await setOrderPayment(id, true, [
        {
          mode: paymentMode,
          amount: order.total - (order.depositPaid ?? 0),
        },
      ]);
      return { ok: true, id, paymentMode, startedPreparation };
    },
  },
  {
    name: 'update_order',
    toolset: 'commandes',
    title: 'Modifier les détails d’une commande',
    description:
      'Met à jour de façon PARTIELLE les métadonnées d’une commande existante : ' +
      '`orderType` (DELIVERY/DINE_IN/TAKEAWAY), `pickupTime` (créneau de retrait, ' +
      'datetime ISO 8601 ou null pour walk-in), `paymentMode` (CASH/WAVE/ORANGE_MONEY/OTHER, ou ' +
      'null si non payée) et `note`. Ne modifie ni le statut ni l’état de paiement ' +
      '(utilise `set_order_status` / `mark_order_paid`). On ne peut pas retirer le ' +
      'mode de paiement d’une commande déjà payée. `id` provient de `list_orders`.',
    inputSchema: z.object({
      id: idSchema,
      orderType: orderTypeSchema.optional(),
      pickupTime: z
        .string()
        .datetime({ message: 'Date de retrait invalide' })
        .nullable()
        .optional()
        .describe('Créneau de retrait (ISO 8601) ou null pour walk-in.'),
      paymentMode: paymentModeSchema.nullable().optional(),
      note: z.string().max(500).nullable().optional(),
    }),
    readOnly: false,
    handler: async (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      await updateOrderDetails(id, rest);
      return { ok: true, id };
    },
  },
];
