// lib/mcp/tools/refunds.ts
//
// Outils MCP — remboursements. Lecture + DEMANDE seulement : valider, refuser,
// renvoyer ou marquer « fait » exige une personne identifiée (un admin dans
// l'application), or un outil MCP n'a pas d'utilisateur nommé. La règle « un admin
// valide avant que l'argent ne parte » reste donc intacte.

import { z } from 'zod';
import { REFUND_STATUSES } from '@/lib/schemas/refund';
import { SELECTABLE_PAYMENT_MODES } from '@/lib/payment-modes';
import { createRefundSchema } from '@/lib/schemas/refund';
import { createRefund } from '@/lib/refunds/create';
import { getRefundDetail, listRefunds } from '@/lib/refunds/queries';
import { getRefundStats } from '@/lib/refunds/stats';
import { parseDateOnlyToUTC } from '@/lib/timezone';
import { dateOnly, idSchema, rangeSchema, toRange } from './helpers';
import type { McpTool } from './types';

const listSchema = z.object({
  from: dateOnly.optional().describe('Demandés à partir de (YYYY-MM-DD).'),
  to: dateOnly.optional().describe('Demandés jusqu’à (YYYY-MM-DD, inclus).'),
  status: z.array(z.enum(REFUND_STATUSES)).optional(),
  channel: z.enum(SELECTABLE_PAYMENT_MODES).optional(),
  orderId: z.string().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
});

export const refundsTools: McpTool[] = [
  {
    name: 'list_refunds',
    toolset: 'finance',
    scope: 'finance',
    title: 'Lister les remboursements',
    description:
      'Renvoie les remboursements (partiels ou totaux), filtrables par plage de ' +
      'dates de demande (`from`/`to`, `YYYY-MM-DD`), `status` ' +
      '(REQUESTED=à valider, APPROVED, PROCESSING=transfert en cours, ' +
      'UNCERTAIN=à vérifier chez Jèko, FAILED=à corriger, PAID, REJECTED, ' +
      'CANCELLED), `channel` (canal de sortie) et `orderId`. Montants en francs CFA. ' +
      'Les numéros de téléphone sont masqués côté assistant.',
    inputSchema: listSchema,
    readOnly: true,
    handler: (args) => {
      const a = args as z.infer<typeof listSchema>;
      const to = parseDateOnlyToUTC(a.to);
      return listRefunds({
        from: parseDateOnlyToUTC(a.from) ?? undefined,
        toExclusive: to ? new Date(to.getTime() + 86_400_000) : undefined,
        status: a.status,
        channel: a.channel,
        orderId: a.orderId,
        page: a.page,
        pageSize: a.pageSize,
      });
    },
  },
  {
    name: 'get_refund',
    toolset: 'finance',
    scope: 'finance',
    title: 'Détail d’un remboursement',
    description:
      'Renvoie un remboursement avec ses lignes (produits et suppléments), son ' +
      'journal (qui a fait passer quel statut à quel autre) et sa commande.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: true,
    handler: async (args) => {
      const refund = await getRefundDetail((args as { id: string }).id);
      if (!refund) throw new Error('Remboursement introuvable');
      return refund;
    },
  },
  {
    name: 'get_refund_summary',
    toolset: 'finance',
    scope: 'finance',
    title: 'Statistiques de remboursements',
    description:
      'Statistiques des remboursements PARTIS sur une plage de dates (jour où ' +
      'l’argent est parti) : nombre, montant, taux du CA brut, frais de ' +
      'transfert, répartition par motif, canal, demandeur, approbateur et produit, ' +
      'taux d’échec des transferts Jèko, délai moyen de validation et files en ' +
      'attente. Montants en francs CFA.',
    inputSchema: rangeSchema,
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      return getRefundStats(from, to);
    },
  },
  {
    name: 'create_refund',
    toolset: 'finance',
    scope: 'finance',
    title: 'Demander un remboursement',
    description:
      'CRÉE UNE DEMANDE de remboursement (statut « à valider ») : aucun argent ne ' +
      'part tant qu’un admin ne l’a pas validée dans l’application ' +
      '(Remboursements). `orderId` + `amount` (FCFA, ≤ restant remboursable de la ' +
      'commande, frais en ligne exclus) + `reason`. Par défaut: canal = mode ' +
      'utilisé par le client, transfert Jèko si la commande a été payée via Jèko, ' +
      'sinon remise à la main, numéro = celui de la commande. `lines` rattache ' +
      'des produits/suppléments ; `restockItems` (défaut false) les remet en stock.',
    inputSchema: createRefundSchema,
    readOnly: false,
    // Demandeur anonyme de rôle « manager » : la demande est tracée sans nom et
    // l'admin est prévenu (un demandeur admin ne le serait pas).
    handler: (args) => createRefund(args, { id: null, role: 'MANAGER' }),
  },
];
