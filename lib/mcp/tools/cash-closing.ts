// lib/mcp/tools/cash-closing.ts
//
// Outils MCP — clôture de caisse (espèces, journalière).

import { z } from 'zod';
import { parseDateOnlyToUTC } from '@/lib/timezone';
import {
  getCashFigures,
  getCashClosing,
  listCashClosings,
} from '@/lib/cash-closing';
import { saveCashClosing } from '@/lib/cash-closing-mutations';
import { cashClosingInputSchema } from '@/lib/schemas/cash-closing';
import { dateOnly, rangeSchema, toRange } from './helpers';
import type { McpTool } from './types';

export const cashClosingTools: McpTool[] = [
  // — Clôture de caisse (espèces, journalière) —
  {
    name: 'get_cash_position',
    toolset: 'finance',
    scope: 'finance',
    title: 'Position de caisse (espèces) d’un jour',
    description:
      'Pour un jour (`date`, `YYYY-MM-DD`), renvoie les chiffres liquides ' +
      '(ventes espèces, dépenses espèces, ventes Wave/Autre, CA total) et la ' +
      'clôture déjà enregistrée s’il y en a une. Sert à préparer une clôture.',
    inputSchema: z.object({ date: dateOnly }),
    readOnly: true,
    handler: async (args) => {
      const date = parseDateOnlyToUTC((args as { date: string }).date)!;
      const [figures, closing] = await Promise.all([
        getCashFigures(date),
        getCashClosing(date),
      ]);
      return { figures, closing };
    },
  },
  {
    name: 'get_cash_closing',
    toolset: 'finance',
    scope: 'finance',
    title: 'Lire une clôture de caisse',
    description:
      'Renvoie la clôture enregistrée pour un jour (`date`, `YYYY-MM-DD`), ou ' +
      'null si la caisse n’a pas encore été clôturée ce jour-là.',
    inputSchema: z.object({ date: dateOnly }),
    readOnly: true,
    handler: (args) => {
      const date = parseDateOnlyToUTC((args as { date: string }).date)!;
      return getCashClosing(date);
    },
  },
  {
    name: 'list_cash_closings',
    toolset: 'finance',
    scope: 'finance',
    title: 'Lister les clôtures de caisse',
    description:
      'Renvoie l’historique des clôtures de caisse sur une plage de dates ' +
      '(`from`/`to`, `YYYY-MM-DD`).',
    inputSchema: rangeSchema,
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      return listCashClosings(from, to);
    },
  },
  {
    name: 'save_cash_closing',
    toolset: 'finance',
    scope: 'finance',
    title: 'Enregistrer une clôture de caisse',
    description:
      'Crée ou met à jour la clôture d’un jour (une par jour). Fournis `date` ' +
      '(`YYYY-MM-DD`), `openingFloat` (fond de caisse) et `countedCash` ' +
      '(espèces comptées), en francs CFA. La caisse théorique et l’écart sont ' +
      'recalculés automatiquement (fond + ventes espèces − dépenses espèces).',
    inputSchema: cashClosingInputSchema,
    readOnly: false,
    handler: (args) => saveCashClosing(args),
  },
];
