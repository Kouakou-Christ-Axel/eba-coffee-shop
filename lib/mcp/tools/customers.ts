// lib/mcp/tools/customers.ts
//
// Outils MCP — customers (extrait de lib/mcp/tools.ts, sans changement de comportement).

import { z } from 'zod';
import {
  listCustomers,
  getCustomer,
  getCustomerByPhone,
} from '@/lib/customers';
import { fetchArdoise } from '@/lib/ardoise';
import type { McpTool } from './types';

export const customersTools: McpTool[] = [
  // — Clients (CRM, lecture seule) —
  {
    name: 'list_customers',
    toolset: 'crm',
    title: 'Lister / rechercher des clients',
    description:
      'Renvoie les clients (identifiés par téléphone) avec leurs stats ' +
      '(nb de commandes, total dépensé, dernière commande). `search` filtre ' +
      'par nom ou téléphone ; `page` pagine (20 par page).',
    inputSchema: z.object({
      search: z.string().optional(),
      page: z.number().int().positive().optional(),
    }),
    readOnly: true,
    handler: (args) => {
      const { search, page } = args as { search?: string; page?: number };
      return listCustomers({ search, page });
    },
  },
  {
    name: 'get_customer',
    toolset: 'crm',
    title: 'Détail d’un client',
    description:
      'Renvoie un client avec ses stats et ses commandes récentes. Fournis ' +
      'soit `id`, soit `phone` (numéro saisi librement, normalisé ' +
      'automatiquement). Renvoie null si introuvable.',
    inputSchema: z
      .object({
        id: z.string().min(1).optional(),
        phone: z.string().min(1).optional(),
      })
      .refine((v) => Boolean(v.id) || Boolean(v.phone), {
        message: 'Fournis `id` ou `phone`.',
      }),
    readOnly: true,
    handler: async (args) => {
      const { id, phone } = args as { id?: string; phone?: string };
      if (id) return getCustomer(id);
      const found = await getCustomerByPhone(phone!);
      return found ? getCustomer(found.id) : null;
    },
  },

  {
    name: 'get_ardoise',
    toolset: 'crm',
    title: 'Ardoise (dette par client)',
    description:
      'Renvoie ce qui est réellement dû au commerce — commandes RÉCUPÉRÉES ' +
      '(`COMPLETED`) et non payées : marchandise remise, argent pas reçu — ' +
      'regroupé par client et trié par dette la plus ancienne (total dû, ' +
      'nombre de commandes, ancienneté, détail). Toutes dates confondues, ' +
      'aucune borne : une commande récupérée impayée compte dès le jour même. ' +
      'Une commande encore en cours (`NEW`/`PREPARING`/`READY`) n’est pas une ' +
      'dette, le client n’a rien emporté. `toCheck` liste à part les impayées ' +
      'd’avant aujourd’hui jamais marquées comme récupérées (pointage oublié ' +
      'ou commande à annuler) : elles sont visibles mais JAMAIS comptées dans ' +
      '`totalOwed`. `onlyOnAccount` restreint la dette à l’ardoise consentie ' +
      '(`isOnAccount`), par opposition aux impayés oubliés — sans effet sur ' +
      '`toCheck`. Lecture seule : le règlement passe par `mark_order_paid`.',
    inputSchema: z.object({
      onlyOnAccount: z.boolean().optional(),
    }),
    readOnly: true,
    handler: (args) => {
      const { onlyOnAccount } = args as { onlyOnAccount?: boolean };
      return fetchArdoise({ onlyOnAccount });
    },
  },
];
