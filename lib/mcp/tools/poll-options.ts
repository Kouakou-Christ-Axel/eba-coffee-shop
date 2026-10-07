// lib/mcp/tools/poll-options.ts
//
// Outils MCP — poll-options (extrait de lib/mcp/tools.ts, sans changement de comportement).

import { z } from 'zod';
import { uploadPollOptionImage } from '@/lib/cloudinary';
import { ALLOWED_IMAGE_MIME_TYPES, imageUrlSchema } from '@/lib/schemas/upload';
import { listSuggestionsAdmin, getSuggestion } from '@/lib/polls';
import {
  createPollOption,
  updatePollOption,
  movePollOption,
  deletePollOption,
  moderatePollSuggestion,
} from '@/lib/poll-mutations';
import {
  pollOptionInputSchema,
  pollOptionUpdateSchema,
  pollSuggestionModerationSchema,
} from '@/lib/schemas/poll';
import { idSchema, resolveStoredImageUrl } from './helpers';
import type { McpTool } from './types';

export const pollOptionsTools: McpTool[] = [
  {
    name: 'create_poll_option',
    toolset: 'sondages',
    title: 'Ajouter une option à un sondage',
    description:
      'Ajoute une option de vote à un sondage existant (`pollId`). `label` ' +
      'requis, `description`/`imageUrl` optionnels.',
    inputSchema: pollOptionInputSchema.extend({ pollId: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { pollId, ...rest } = args as { pollId: string } & Record<
        string,
        unknown
      >;
      return createPollOption(pollId, rest);
    },
  },
  {
    name: 'update_poll_option',
    toolset: 'sondages',
    title: 'Modifier une option de sondage',
    description:
      'Met à jour une option de façon PARTIELLE (label, description, imageUrl).',
    inputSchema: pollOptionUpdateSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return updatePollOption(id, rest);
    },
  },
  {
    name: 'move_poll_option',
    toolset: 'sondages',
    title: 'Réordonner une option de sondage',
    description:
      'Déplace une option d’un cran (haut/bas) dans l’ordre d’affichage de son ' +
      'sondage.',
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
      return movePollOption(id, direction);
    },
  },
  {
    name: 'delete_poll_option',
    toolset: 'sondages',
    title: 'Supprimer une option de sondage',
    description:
      'Retire une option d’un sondage (suppression douce : les votes déjà ' +
      'enregistrés sur cette option sont conservés).',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deletePollOption((args as { id: string }).id),
  },
  {
    name: 'set_poll_option_image',
    toolset: 'sondages',
    title: 'Illustrer une option de sondage',
    description:
      'Associe une image à une option de sondage. Deux modes : (1) `imageUrl` — ' +
      'une URL http(s) est TÉLÉCHARGÉE côté serveur puis stockée localement (un ' +
      'chemin `/uploads/...` déjà local est conservé) ; (2) `imageBase64` (base64 ' +
      'brut ou data URI) + `mimeType`. Formats : ' +
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
        uploadPollOptionImage,
        uploadPollOptionImage
      );
      return updatePollOption(id, { imageUrl: url });
    },
  },
  {
    name: 'list_poll_suggestions',
    toolset: 'sondages',
    title: 'Lister les suggestions de la communauté',
    description:
      'Renvoie les suggestions (pâtisseries proposées par les clients) ' +
      'filtrables par `pollId` et `status` (PENDING/APPROVED/REJECTED). Utilise ' +
      '`moderate_poll_suggestion` pour approuver/rejeter.',
    inputSchema: z.object({
      pollId: idSchema.optional(),
      status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
      page: z.number().int().positive().optional(),
    }),
    readOnly: true,
    handler: (args) => listSuggestionsAdmin(args as Record<string, unknown>),
  },
  {
    name: 'get_poll_suggestion',
    toolset: 'sondages',
    title: 'Lire une suggestion',
    description: 'Renvoie le détail d’une suggestion de la communauté.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: true,
    handler: (args) => getSuggestion((args as { id: string }).id),
  },
  {
    name: 'moderate_poll_suggestion',
    toolset: 'sondages',
    title: 'Approuver/rejeter une suggestion',
    description:
      'Modère une suggestion PENDING. `decision: "approve"` la promeut en ' +
      'véritable option de vote sur son sondage. `decision: "reject"` la rejette ' +
      '(nécessite `rejectionReason`). Refusé si la suggestion est déjà modérée.',
    inputSchema: pollSuggestionModerationSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return moderatePollSuggestion(id, rest);
    },
  },
];
