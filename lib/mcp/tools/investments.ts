// lib/mcp/tools/investments.ts
//
// Outils MCP — investments (extrait de lib/mcp/tools.ts, sans changement de comportement).

import { z } from 'zod';
import { parseDateOnlyToUTC } from '@/lib/timezone';
import { uploadReceiptImage } from '@/lib/cloudinary';
import { ALLOWED_IMAGE_MIME_TYPES, imageUrlSchema } from '@/lib/schemas/upload';
import {
  listInvestmentSources,
  listInvestments,
  getInvestmentSummary,
} from '@/lib/investments';
import {
  createInvestmentSource,
  updateInvestmentSource,
  deleteInvestmentSource,
  createInvestment,
  updateInvestment,
  deleteInvestment,
} from '@/lib/investment-mutations';
import {
  investmentSourceInputSchema,
  investmentInputSchema,
  investmentObjectSchema,
  investmentFiltersSchema,
} from '@/lib/schemas/investment';
import {
  idSchema,
  rangeSchema,
  toRange,
  resolveStoredImageUrl,
} from './helpers';
import type { McpTool } from './types';

export const investmentsTools: McpTool[] = [
  // — Investissements : sources de financement —
  {
    name: 'list_investment_sources',
    toolset: 'finance',
    scope: 'finance',
    title: 'Lister les sources de financement',
    description:
      'Renvoie les sources de financement (capital propre, prêt, apport ' +
      'd’associé, subvention…) avec leur `id` et le nombre d’apports rattachés. ' +
      'Utilise ces `id` pour `create_investment`.',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => listInvestmentSources(),
  },
  {
    name: 'create_investment_source',
    toolset: 'finance',
    scope: 'finance',
    title: 'Créer une source de financement',
    description:
      'Crée une source de financement (ex. « Prêt bancaire », « Apport ' +
      'associé »). Le nom doit être unique.',
    inputSchema: investmentSourceInputSchema,
    readOnly: false,
    handler: (args) => createInvestmentSource(args),
  },
  {
    name: 'update_investment_source',
    toolset: 'finance',
    scope: 'finance',
    title: 'Renommer une source de financement',
    description: 'Met à jour le nom d’une source de financement.',
    inputSchema: investmentSourceInputSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string; name: string };
      return updateInvestmentSource(id, rest);
    },
  },
  {
    name: 'delete_investment_source',
    toolset: 'finance',
    scope: 'finance',
    title: 'Supprimer une source de financement',
    description:
      'Supprime une source de financement. Refusé si des apports y sont ' +
      'rattachés.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteInvestmentSource((args as { id: string }).id),
  },

  // — Investissements : apports —
  {
    name: 'list_investments',
    toolset: 'finance',
    scope: 'finance',
    title: 'Lister les apports',
    description:
      'Renvoie les apports/financements filtrés par plage de dates ' +
      '(`from`/`to`, `YYYY-MM-DD`, jour civil Abidjan), `sourceId` et/ou ' +
      '`reimbursable`, avec le total investi, le total remboursé et le restant ' +
      'dû. Tous les filtres sont optionnels.',
    inputSchema: investmentFiltersSchema,
    readOnly: true,
    handler: (args) => {
      const f = args as {
        from?: string;
        to?: string;
        sourceId?: string;
        reimbursable?: boolean;
      };
      return listInvestments({
        dateFrom: parseDateOnlyToUTC(f.from),
        dateTo: parseDateOnlyToUTC(f.to),
        sourceId: f.sourceId,
        reimbursable: f.reimbursable,
      });
    },
  },
  {
    name: 'get_investment_summary',
    toolset: 'finance',
    scope: 'finance',
    title: 'Synthèse des investissements',
    description:
      'Renvoie le total des apports, leur ventilation par source et le restant ' +
      'dû (apports remboursables) sur une plage de dates. Montants en francs CFA.',
    inputSchema: rangeSchema,
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      return getInvestmentSummary(from, to);
    },
  },
  {
    name: 'create_investment',
    toolset: 'finance',
    scope: 'finance',
    title: 'Créer un apport',
    description:
      'Enregistre un apport / financement. `date` au format `YYYY-MM-DD`, ' +
      '`amount` en francs CFA entiers, `sourceId` issu de ' +
      '`list_investment_sources`. `paymentMethod` ∈ CASH/WAVE/BANK/OTHER ' +
      '(défaut CASH, canal d’entrée des fonds). `financier`, `note`, ' +
      '`documentUrl` sont optionnels. Pour un apport remboursable, mets ' +
      '`reimbursable` à true et renseigne éventuellement `amountRepaid` (≤ ' +
      '`amount`) et `dueDate`. Pour joindre une photo encodée, utilise ' +
      '`set_investment_document` après création.',
    inputSchema: investmentInputSchema,
    readOnly: false,
    handler: (args) => createInvestment(args),
  },
  {
    name: 'update_investment',
    toolset: 'finance',
    scope: 'finance',
    title: 'Modifier un apport',
    description:
      'Met à jour un apport de façon PARTIELLE : ne fournis que les champs à ' +
      'modifier. Utile notamment pour enregistrer un remboursement via ' +
      '`amountRepaid`.',
    inputSchema: investmentObjectSchema.partial().extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return updateInvestment(id, rest);
    },
  },
  {
    name: 'delete_investment',
    toolset: 'finance',
    scope: 'finance',
    title: 'Supprimer un apport',
    description: 'Supprime définitivement un apport. Action irréversible.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteInvestment((args as { id: string }).id),
  },
  {
    name: 'set_investment_document',
    toolset: 'finance',
    scope: 'finance',
    title: 'Joindre un justificatif à un apport',
    description:
      'Associe une photo de justificatif à un apport. Deux modes : (1) ' +
      '`imageUrl` — une URL http(s) est TÉLÉCHARGÉE côté serveur puis stockée ' +
      'localement (un chemin `/uploads/...` déjà local est conservé) ; (2) ' +
      '`imageBase64` (base64 brut ou data URI) + `mimeType`. Formats : ' +
      ALLOWED_IMAGE_MIME_TYPES.join(', ') +
      ' (converties automatiquement en WebP, redimensionnées, max 25 MB).',
    inputSchema: z
      .object({
        id: idSchema,
        imageBase64: z.string().min(1).optional(),
        mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES).optional(),
        imageUrl: imageUrlSchema.optional(),
      })
      .refine((v) => Boolean(v.imageBase64) || Boolean(v.imageUrl), {
        message: 'Fournis soit `imageBase64`, soit `imageUrl`.',
      }),
    readOnly: false,
    handler: async (args) => {
      const { id, ...image } = args as {
        id: string;
        imageBase64?: string;
        mimeType?: string;
        imageUrl?: string;
      };
      const url = await resolveStoredImageUrl(
        image,
        uploadReceiptImage,
        uploadReceiptImage
      );
      return updateInvestment(id, { documentUrl: url });
    },
  },
];
