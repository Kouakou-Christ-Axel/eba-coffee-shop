// lib/mcp/tools/menu-extras.ts
//
// Outils MCP — menu-extras (extrait de lib/mcp/tools.ts, sans changement de comportement).

import { z } from 'zod';
import { getGlobalExtras } from '@/lib/menu';
import {
  createGlobalExtraGroup,
  updateGlobalExtraGroup,
  deleteGlobalExtraGroup,
  createGlobalExtraOption,
  updateGlobalExtraOption,
  deleteGlobalExtraOption,
} from '@/lib/global-extras-mutations';
import {
  globalExtraGroupInputSchema,
  globalExtraGroupUpdateSchema,
  globalExtraOptionUpdateSchema,
  supplementOptionSchema,
  type GlobalExtraGroupInput,
  type GlobalExtraGroupUpdate,
  type GlobalExtraOptionUpdate,
  type SupplementOptionInput,
} from '@/lib/schemas/menu';
import { idSchema } from './helpers';
import type { McpTool } from './types';

export const menuExtrasTools: McpTool[] = [
  // — Extras globaux —
  //
  // Un « extra » global (ex. chantilly) est configuré UNE fois puis proposé
  // automatiquement dans le sélecteur de suppléments de TOUS les produits,
  // sans devoir le rattacher individuellement à chacun — au contraire des
  // groupes de suppléments d'un produit (gérés en bloc via `update_product`).
  // Un groupe est créé sans option (`create_global_extra_group`), puis ses
  // options (« Chantilly », « Sirop vanille »...) sont ajoutées une à une via
  // `create_global_extra_option`. `set_option_stock`/`restock_option`
  // fonctionnent déjà par `id` d'option : aucun nouvel outil de stock requis.
  {
    name: 'list_global_extras',
    toolset: 'menu',
    title: 'Lister les extras globaux',
    description:
      'Renvoie tous les groupes d’extras globaux (« Extras », ex. chantilly, ' +
      'sirops) avec leurs `id` et options, indépendamment de tout produit — ' +
      'ils apparaissent déjà fusionnés dans les `supplements` de chaque ' +
      'produit renvoyé par `get_menu`, ceci en donne la vue de gestion dédiée.',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => getGlobalExtras(),
  },
  {
    name: 'create_global_extra_group',
    toolset: 'menu',
    title: 'Créer un groupe d’extras global',
    description:
      'Crée un groupe d’extras global (sans option — les ajouter ensuite via ' +
      '`create_global_extra_option`). `type` ∈ single (un choix) / multiple ' +
      '(cases à cocher) / quantity (répartition d’une quantité entre options).',
    inputSchema: globalExtraGroupInputSchema,
    readOnly: false,
    handler: (args) => createGlobalExtraGroup(args as GlobalExtraGroupInput),
  },
  {
    name: 'update_global_extra_group',
    toolset: 'menu',
    title: 'Modifier un groupe d’extras global',
    description:
      'Met à jour PARTIELLEMENT un groupe d’extras global (nom, requis, ' +
      'disponibilité, bornes). Champs non fournis = inchangés.',
    inputSchema: globalExtraGroupUpdateSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & GlobalExtraGroupUpdate;
      return updateGlobalExtraGroup(id, rest);
    },
  },
  {
    name: 'delete_global_extra_group',
    toolset: 'menu',
    title: 'Supprimer un groupe d’extras global',
    description:
      'Supprime définitivement un groupe d’extras global et, en cascade, ses ' +
      'options. Il disparaît alors du sélecteur de tous les produits.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteGlobalExtraGroup((args as { id: string }).id),
  },
  {
    name: 'create_global_extra_option',
    toolset: 'menu',
    title: 'Ajouter une option à un groupe d’extras global',
    description:
      'Ajoute une option (ex. « Chantilly ») à un groupe d’extras global ' +
      'existant (`groupId`, obtenu via `list_global_extras`).',
    inputSchema: z.object({
      groupId: idSchema,
      option: supplementOptionSchema,
    }),
    readOnly: false,
    handler: (args) =>
      createGlobalExtraOption(
        args as { groupId: string; option: SupplementOptionInput }
      ),
  },
  {
    name: 'update_global_extra_option',
    toolset: 'menu',
    title: 'Modifier une option d’extra global',
    description:
      'Met à jour PARTIELLEMENT une option d’extra global (nom, prix, ' +
      'disponibilité, stock). Champs non fournis = inchangés. Pour un simple ' +
      'ajustement de stock, préfère `set_option_stock`/`restock_option`.',
    inputSchema: globalExtraOptionUpdateSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & GlobalExtraOptionUpdate;
      return updateGlobalExtraOption(id, rest);
    },
  },
  {
    name: 'delete_global_extra_option',
    toolset: 'menu',
    title: 'Supprimer une option d’extra global',
    description: 'Supprime définitivement une option d’extra global.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteGlobalExtraOption((args as { id: string }).id),
  },
];
