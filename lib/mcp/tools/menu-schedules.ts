// lib/mcp/tools/menu-schedules.ts
//
// Outils MCP — menu-schedules (extrait de lib/mcp/tools.ts, sans changement de comportement).

import { z } from 'zod';
import {
  getMenuAdmin,
  listProductSchedules,
  listProductWeeklySpecials,
} from '@/lib/menu';
import {
  createProductSchedule,
  updateProductSchedule,
  deleteProductSchedule,
  createProductWeeklySpecial,
  updateProductWeeklySpecial,
  deleteProductWeeklySpecial,
  productScheduleSchema,
  productScheduleUpdateSchema,
  productWeeklySpecialSchema,
  productWeeklySpecialUpdateSchema,
} from '@/lib/menu-mutations';
import { idSchema } from './helpers';
import type { McpTool } from './types';

export const menuSchedulesTools: McpTool[] = [
  // — Plannings récurrents (« à la cal.com ») —
  //
  // Un planning est nommé et réutilisable : assignable à plusieurs produits ET
  // catégories à la fois via leur `scheduleId` (`create_product`/`update_product`,
  // `create_category`/`update_category`). Modifier le planning met à jour tout
  // ce qui l'utilise.
  {
    name: 'list_product_schedules',
    toolset: 'menu',
    title: 'Lister les plannings récurrents',
    description:
      'Renvoie les plannings récurrents (`id`, `name`, `days` [0=dimanche…' +
      '6=samedi], nombre de produits et de catégories assignés). Utilise ces ' +
      '`id` pour `scheduleId` sur `create_product`/`update_product`/' +
      '`create_category`/`update_category`.',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => listProductSchedules(),
  },
  {
    name: 'create_product_schedule',
    toolset: 'menu',
    title: 'Créer un planning récurrent',
    description:
      'Crée un planning récurrent nommé (ex. « Jour du chocolat »). `days` ' +
      '(0=dimanche…6=samedi) doit contenir au moins un jour. Assigne-le ensuite ' +
      'via `scheduleId` sur un ou plusieurs produits/catégories.',
    inputSchema: productScheduleSchema,
    readOnly: false,
    handler: (args) =>
      createProductSchedule(args as z.infer<typeof productScheduleSchema>),
  },
  {
    name: 'update_product_schedule',
    toolset: 'menu',
    title: 'Modifier un planning récurrent',
    description:
      'Met à jour un planning existant de façon PARTIELLE (nom et/ou jours) : ' +
      'tout ce qui l’utilise (produits, catégories) est affecté immédiatement.',
    inputSchema: productScheduleUpdateSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & z.infer<
        typeof productScheduleUpdateSchema
      >;
      return updateProductSchedule(id, rest);
    },
  },
  {
    name: 'delete_product_schedule',
    toolset: 'menu',
    title: 'Supprimer un planning récurrent',
    description:
      'Supprime un planning récurrent. Les produits et catégories qui ' +
      'l’utilisaient sont simplement DÉSASSIGNÉS (redeviennent disponibles ' +
      'tous les jours) — rien d’autre n’est supprimé.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteProductSchedule((args as { id: string }).id),
  },

  // — Spécialité de la semaine —
  //
  // Historique structuré des passages « spécialité de la semaine » d'un
  // produit : dès qu'AU MOINS UNE fenêtre existe, le produit n'est commandable
  // QUE dans une fenêtre active (en dehors, visible avec un badge « Revient le
  // … », prix masqué). Un produit peut être reconduit : chaque passage reste
  // enregistré dans l'historique.
  {
    name: 'list_product_weekly_specials',
    toolset: 'menu',
    title: 'Lister l’historique « spécialité de la semaine »',
    description:
      'Renvoie l’historique des fenêtres « spécialité de la semaine » d’un ' +
      'produit (`productId` optionnel — omis, renvoie tous les produits ayant ' +
      'un historique), triées de la plus récente à la plus ancienne.',
    inputSchema: z.object({ productId: idSchema.optional() }),
    readOnly: true,
    handler: async (args) => {
      const { productId } = args as { productId?: string };
      if (productId) return listProductWeeklySpecials(productId);
      const menu = await getMenuAdmin();
      return menu.flatMap((cat) =>
        cat.products
          .filter((p) => p.weeklySpecials.length > 0)
          .map((p) => ({
            productId: p.id,
            productName: p.name,
            weeklySpecials: p.weeklySpecials,
          }))
      );
    },
  },
  {
    name: 'create_product_weekly_special',
    toolset: 'menu',
    title: 'Programmer une « spécialité de la semaine »',
    description:
      'Programme une fenêtre de disponibilité (`startDate`/`endDate`, format ' +
      'YYYY-MM-DD) pour un produit : il ne sera commandable QUE durant cette ' +
      'fenêtre (en dehors, visible avec un badge « Revient le … », prix ' +
      'masqué). Peut être appelé plusieurs fois pour le même produit — chaque ' +
      'passage reste dans l’historique (`list_product_weekly_specials`), même ' +
      'après la fin de sa fenêtre.',
    inputSchema: productWeeklySpecialSchema.extend({ productId: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { productId, ...rest } = args as { productId: string } & z.infer<
        typeof productWeeklySpecialSchema
      >;
      return createProductWeeklySpecial(productId, rest);
    },
  },
  {
    name: 'update_product_weekly_special',
    toolset: 'menu',
    title: 'Modifier une « spécialité de la semaine »',
    description:
      'Corrige une fenêtre existante de façon PARTIELLE (dates et/ou note), ' +
      'sans créer de nouvelle ligne d’historique.',
    inputSchema: productWeeklySpecialUpdateSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & z.infer<
        typeof productWeeklySpecialUpdateSchema
      >;
      return updateProductWeeklySpecial(id, rest);
    },
  },
  {
    name: 'delete_product_weekly_special',
    toolset: 'menu',
    title: 'Retirer une « spécialité de la semaine »',
    description:
      'Supprime une ligne de l’historique « spécialité de la semaine » (annule ' +
      'un passage programmé, ou efface un passage passé). Si c’était la ' +
      'DERNIÈRE fenêtre du produit, il redevient commandable normalement ' +
      '(comme un produit sans historique).',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteProductWeeklySpecial((args as { id: string }).id),
  },
];
