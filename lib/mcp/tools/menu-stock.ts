// lib/mcp/tools/menu-stock.ts
//
// Outils MCP — menu-stock (extrait de lib/mcp/tools.ts, sans changement de comportement).

import { z } from 'zod';
import { getPendingDemand } from '@/lib/orders/pending-demand';
import {
  setProductStock,
  setOptionStock,
  restockProduct,
  restockOption,
  pauseProduct,
  resumeProduct,
} from '@/lib/menu-mutations';
import { idSchema, dateOnly } from './helpers';
import type { McpTool } from './types';

export const menuStockTools: McpTool[] = [
  // — Stock & pause (produits/options) —
  //
  // Trois mécanismes distincts : stock illimité (défaut, `stockQuantity: null`),
  // stock suivi (produit ET option, décrémenté au PAIEMENT — pas à la création
  // de la commande — pour ne jamais survendre), et pause programmée (le produit
  // reste visible sur la carte avec un tag « Indisponible — retour {heure} »,
  // mais n’est pas commandable ; reprise automatique à `until`, sans action
  // manuelle). `set_*_stock` pose une valeur ABSOLUE (geste du matin) ;
  // `restock_*` AJOUTE un delta (nouvelle fournée en journée).
  {
    name: 'set_product_stock',
    toolset: 'menu',
    title: 'Définir le stock d’un produit (absolu)',
    description:
      'Définit la quantité vendable ACTUELLE d’un produit (« définir le matin »). ' +
      '`quantity` = nombre entier ≥ 0 (quantité restante suivie, `0` = épuisé), ' +
      'ou `null`/absent pour repasser le produit en stock illimité (comportement ' +
      'par défaut, aucun suivi). Le stock est DÉCRÉMENTÉ À L’ENTRÉE EN CUISINE ' +
      '(passage `NEW → PREPARING` : encaissement, envoi manuel ou ardoise), ' +
      'jamais à la simple création d’une commande — une commande non payée et ' +
      'jamais envoyée en cuisine ne réserve rien. `id` provient de `get_menu`. ' +
      'Pour ajouter une nouvelle fournée sans écraser la valeur courante, ' +
      'utilise plutôt `restock_product`.',
    inputSchema: z.object({
      id: idSchema,
      quantity: z
        .number()
        .int()
        .nonnegative()
        .nullable()
        .optional()
        .describe('Quantité restante, ou null/absent pour illimité.'),
    }),
    readOnly: false,
    handler: (args) => {
      const { id, quantity } = args as { id: string; quantity?: number | null };
      return setProductStock(id, quantity ?? null);
    },
  },
  {
    name: 'set_option_stock',
    toolset: 'menu',
    title: 'Définir le stock d’une option (absolu)',
    description:
      'Définit la quantité vendable ACTUELLE d’une option de supplément (un ' +
      '« goût »). Mêmes règles que `set_product_stock` : `quantity` entier ≥ 0, ' +
      'ou `null`/absent pour repasser l’option en stock illimité. Décrémenté à ' +
      'L’ENTRÉE EN CUISINE (pas à la création). `id` (id d’option, pas de ' +
      'produit) provient de `get_menu` — attention, les noms d’option peuvent ' +
      'être dupliqués entre produits, cible toujours par `id`.',
    inputSchema: z.object({
      id: idSchema,
      quantity: z
        .number()
        .int()
        .nonnegative()
        .nullable()
        .optional()
        .describe('Quantité restante, ou null/absent pour illimité.'),
    }),
    readOnly: false,
    handler: (args) => {
      const { id, quantity } = args as { id: string; quantity?: number | null };
      return setOptionStock(id, quantity ?? null);
    },
  },
  {
    name: 'restock_product',
    toolset: 'menu',
    title: 'Réapprovisionner un produit (+ fournée)',
    description:
      'AJOUTE `delta` au stock courant d’un produit (nouvelle fournée en cours ' +
      'de journée), sans écraser la valeur — au contraire de ' +
      '`set_product_stock`. `delta` peut être négatif pour corriger une saisie. ' +
      'Refusé si le produit est actuellement en stock illimité (pose d’abord ' +
      'une valeur via `set_product_stock`). `id` provient de `get_menu`.',
    inputSchema: z.object({
      id: idSchema,
      delta: z
        .number()
        .int()
        .describe('Quantité à ajouter (négatif = retirer).'),
    }),
    readOnly: false,
    handler: (args) => {
      const { id, delta } = args as { id: string; delta: number };
      return restockProduct(id, delta);
    },
  },
  {
    name: 'restock_option',
    toolset: 'menu',
    title: 'Réapprovisionner une option (+ fournée)',
    description:
      'Équivalent de `restock_product` pour une option de supplément : AJOUTE ' +
      '`delta` au stock courant de l’option. `id` (id d’option) provient de ' +
      '`get_menu`.',
    inputSchema: z.object({
      id: idSchema,
      delta: z
        .number()
        .int()
        .describe('Quantité à ajouter (négatif = retirer).'),
    }),
    readOnly: false,
    handler: (args) => {
      const { id, delta } = args as { id: string; delta: number };
      return restockOption(id, delta);
    },
  },
  {
    name: 'get_pending_demand',
    toolset: 'menu',
    title: 'Quantité restant à produire',
    description:
      'Renvoie, par produit et par option, la quantité déjà engagée par des ' +
      'commandes PAS ENCORE PARTIES EN CUISINE (stock non réservé, statut ' +
      'différent de CANCELLED) — visibilité PURE LECTURE, n’affecte jamais le ' +
      'stock réel (décrémenté à l’ENTRÉE EN CUISINE). Utile pour anticiper une ' +
      'survente (plusieurs commandes en attente sur le dernier goût) et pour ' +
      'savoir ce qu’il reste à produire. `day` (YYYY-MM-DD, jour civil ' +
      'Abidjan) restreint au jour de RETRAIT (ou de création si la commande ' +
      'n’a pas de créneau) : c’est ainsi qu’on lit « que dois-je produire ' +
      'demain ? ». Omis = toutes dates confondues.',
    inputSchema: z.object({
      day: dateOnly
        .nullable()
        .optional()
        .describe('Jour civil Abidjan (YYYY-MM-DD). Omis = toutes dates.'),
    }),
    readOnly: true,
    handler: async (args) => {
      const { day } = args as { day?: string | null };
      const { products, options } = await getPendingDemand(
        day ? { day } : undefined
      );
      return {
        products: [...products.entries()].map(([productId, quantity]) => ({
          productId,
          quantity,
        })),
        options: [...options.entries()].map(([optionId, quantity]) => ({
          optionId,
          quantity,
        })),
      };
    },
  },
  {
    name: 'pause_product',
    toolset: 'menu',
    title: 'Mettre un produit en pause',
    description:
      'Met un produit en pause jusqu’à `until` (datetime ISO 8601) : il reste ' +
      'VISIBLE sur la carte publique avec un tag « Indisponible — retour ' +
      '{heure} », mais devient non commandable. La reprise est AUTOMATIQUE à ' +
      '`until` (calculée à la lecture, sans intervention) ; utilise ' +
      '`resume_product` pour lever la pause manuellement avant son terme. ' +
      'Différent de `toggle_product_availability`, qui masque complètement le ' +
      'produit. `id` provient de `get_menu`.',
    inputSchema: z.object({
      id: idSchema,
      until: z
        .string()
        .datetime({ message: 'Date de reprise invalide' })
        .describe('Datetime ISO 8601 de reprise automatique.'),
    }),
    readOnly: false,
    handler: (args) => {
      const { id, until } = args as { id: string; until: string };
      return pauseProduct(id, new Date(until));
    },
  },
  {
    name: 'resume_product',
    toolset: 'menu',
    title: 'Lever la pause d’un produit',
    description:
      'Lève manuellement la pause d’un produit avant son terme naturel (efface ' +
      '`unavailableUntil`) : redevient immédiatement commandable. `id` provient ' +
      'de `get_menu`.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => resumeProduct((args as { id: string }).id),
  },
];
