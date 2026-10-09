// lib/mcp/tools/tiktok.ts
//
// Outils MCP — vidéos TikTok.

import { z } from 'zod';
import { getTiktokVideosAdmin, getTiktokVideoAdmin } from '@/lib/tiktok';
import {
  createTiktokVideo,
  updateTiktokVideo,
  deleteTiktokVideo,
  moveTiktokVideo,
} from '@/lib/tiktok-mutations';
import {
  tiktokVideoInputSchema,
  tiktokVideoUpdateSchema,
} from '@/lib/schemas/tiktok';
import { idSchema } from './helpers';
import type { McpTool } from './types';

export const tiktokTools: McpTool[] = [
  // — Vidéos TikTok embarquées (section "Suivez l'aventure" de l'accueil) —
  {
    name: 'list_tiktok_videos',
    toolset: 'tiktok',
    title: 'Lister les vidéos TikTok',
    description:
      'Renvoie toutes les vidéos TikTok embarquées (actives et inactives), ' +
      'triées par ordre d’affichage.',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => getTiktokVideosAdmin(),
  },
  {
    name: 'get_tiktok_video',
    toolset: 'tiktok',
    title: 'Lire une vidéo TikTok',
    description: 'Renvoie le détail d’une vidéo TikTok embarquée.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: true,
    handler: (args) => getTiktokVideoAdmin((args as { id: string }).id),
  },
  {
    name: 'create_tiktok_video',
    toolset: 'tiktok',
    title: 'Ajouter une vidéo TikTok',
    description:
      'Ajoute une vidéo TikTok à embarquer sur l’accueil, à partir de son URL ' +
      '(format `https://www.tiktok.com/@compte/video/<id>` — l’identifiant de ' +
      'vidéo requis par le script d’embed TikTok en est extrait automatiquement). ' +
      '`caption` (légende personnalisée affichée sur le site) est optionnelle, ' +
      '`isActive` par défaut à `true`. La légende d’origine TikTok, l’auteur et ' +
      'une miniature sont également récupérés automatiquement en best-effort ' +
      'via l’oEmbed public de TikTok (utilisés en repli si `caption` est ' +
      'absente, sans jamais bloquer l’ajout si TikTok est injoignable). ' +
      'Ajoutée en fin de liste d’affichage.',
    inputSchema: tiktokVideoInputSchema,
    readOnly: false,
    handler: (args) => createTiktokVideo(args),
  },
  {
    name: 'update_tiktok_video',
    toolset: 'tiktok',
    title: 'Modifier une vidéo TikTok',
    description:
      'Met à jour une vidéo TikTok embarquée de façon PARTIELLE (url, caption, ' +
      'isActive). Changer `url` redéclenche automatiquement la récupération ' +
      'best-effort de la légende d’origine/auteur/miniature via l’oEmbed ' +
      'TikTok pour la nouvelle vidéo.',
    inputSchema: tiktokVideoUpdateSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return updateTiktokVideo(id, rest);
    },
  },
  {
    name: 'move_tiktok_video',
    toolset: 'tiktok',
    title: 'Réordonner une vidéo TikTok',
    description:
      'Déplace une vidéo TikTok d’un cran (haut/bas) dans l’ordre d’affichage ' +
      'de la section "Suivez l’aventure".',
    inputSchema: z.object({
      id: idSchema,
      direction: z.enum(['up', 'down']),
    }),
    readOnly: false,
    handler: (args) => {
      const { id, direction } = args as {
        id: string;
        direction: 'up' | 'down';
      };
      return moveTiktokVideo(id, direction);
    },
  },
  {
    name: 'delete_tiktok_video',
    toolset: 'tiktok',
    title: 'Supprimer une vidéo TikTok',
    description:
      'Retire une vidéo TikTok embarquée (suppression douce, ne s’affiche plus ' +
      'sur le site public).',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteTiktokVideo((args as { id: string }).id),
  },
];
