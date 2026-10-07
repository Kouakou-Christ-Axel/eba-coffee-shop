// lib/mcp/tools/polls.ts
//
// Outils MCP — sondages — sondages et suggestions.

import { z } from 'zod';
import { uploadPollImage } from '@/lib/cloudinary';
import { ALLOWED_IMAGE_MIME_TYPES, imageUrlSchema } from '@/lib/schemas/upload';
import { getPollsAdmin, getPollAdmin, getPollResults } from '@/lib/polls';
import {
  createPoll,
  updatePoll,
  setPollStatus,
  deletePoll,
} from '@/lib/poll-mutations';
import {
  pollInputSchema,
  pollUpdateSchema,
  pollStatusUpdateSchema,
  pollFiltersSchema,
} from '@/lib/schemas/poll';
import { idSchema, resolveStoredImageUrl } from './helpers';
import type { McpTool } from './types';

export const pollsTools: McpTool[] = [
  // — Sondages (moteur générique de vote) —
  {
    name: 'list_polls',
    toolset: 'sondages',
    title: 'Lister les sondages',
    description:
      'Renvoie les sondages avec leur `id`, statut, nombre d’options, de votes ' +
      'et de suggestions en attente. Filtrable par `status` (DRAFT/OPEN/CLOSED) ' +
      'et `search` (titre).',
    inputSchema: pollFiltersSchema,
    readOnly: true,
    handler: (args) =>
      getPollsAdmin(args as Parameters<typeof getPollsAdmin>[0]),
  },
  {
    name: 'get_poll',
    toolset: 'sondages',
    title: 'Lire un sondage',
    description:
      'Renvoie le détail d’un sondage : ses options (y compris supprimées), le ' +
      'décompte des votes par option et le nombre de suggestions en attente.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: true,
    handler: (args) => getPollAdmin((args as { id: string }).id),
  },
  {
    name: 'get_poll_results',
    toolset: 'sondages',
    title: 'Lire les résultats d’un sondage',
    description:
      'Renvoie le décompte des votes par option (nombre + pourcentage) et le ' +
      'total de votes pour un sondage.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: true,
    handler: (args) => getPollResults((args as { id: string }).id),
  },
  {
    name: 'create_poll',
    toolset: 'sondages',
    title: 'Créer un sondage',
    description:
      'Crée un sondage générique avec ses options (au moins 2). `allowSuggestions` ' +
      'active la collecte de suggestions de la communauté sur ce sondage. ' +
      '`resultsVisibility` ∈ LIVE (résultats visibles pendant le vote) / ' +
      'AFTER_CLOSE (défaut, résultats visibles seulement une fois clôturé). Le ' +
      'sondage est créé en statut DRAFT — utilise `set_poll_status` pour l’ouvrir.',
    inputSchema: pollInputSchema,
    readOnly: false,
    handler: (args) => createPoll(args),
  },
  {
    name: 'update_poll',
    toolset: 'sondages',
    title: 'Modifier un sondage',
    description:
      'Met à jour les champs scalaires d’un sondage de façon PARTIELLE (titre, ' +
      'description, allowSuggestions, resultsVisibility, opensAt, closesAt). Les ' +
      'options se gèrent via `create_poll_option`/`update_poll_option`/ ' +
      '`move_poll_option`/`delete_poll_option`.',
    inputSchema: pollUpdateSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return updatePoll(id, rest);
    },
  },
  {
    name: 'set_poll_status',
    toolset: 'sondages',
    title: 'Ouvrir/clôturer un sondage',
    description:
      'Change le statut d’un sondage : DRAFT (préparation, peut déjà collecter ' +
      'des suggestions), OPEN (vote ouvert) ou CLOSED (clôturé, résultats figés).',
    inputSchema: pollStatusUpdateSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as {
        id: string;
        status: 'DRAFT' | 'OPEN' | 'CLOSED';
      };
      return setPollStatus(id, rest);
    },
  },
  {
    name: 'delete_poll',
    toolset: 'sondages',
    title: 'Supprimer un sondage',
    description:
      'Supprime définitivement un sondage. Refusé si le sondage n’est pas en ' +
      'DRAFT ou a déjà reçu des votes — clôture-le à la place avec `set_poll_status`.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deletePoll((args as { id: string }).id),
  },
  {
    name: 'set_poll_image',
    toolset: 'sondages',
    title: 'Illustrer un sondage',
    description:
      'Associe une image de couverture à un sondage. Deux modes : (1) `imageUrl` — ' +
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
        uploadPollImage,
        uploadPollImage
      );
      return updatePoll(id, { imageUrl: url });
    },
  },
];
