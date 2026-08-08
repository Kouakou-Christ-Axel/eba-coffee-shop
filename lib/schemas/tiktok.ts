// lib/schemas/tiktok.ts
//
// Schémas Zod centralisés pour les vidéos TikTok embarquées (section "Suivez
// l'aventure" de l'accueil). Réutilisés par les server actions dashboard et
// le serveur MCP. Conformément à CLAUDE.md : pas de redéclaration inline
// ailleurs.

import { z } from 'zod';
import { TIKTOK_CAPTION_MAX } from '@/config/constants';

// Format attendu : https://www.tiktok.com/@compte/video/1234567890123456789
// (avec query string/fragment optionnels). Le videoId est extrait ici plutôt
// que ressaisi par l'admin.
const TIKTOK_VIDEO_URL_REGEX =
  /^https:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/(\d+)(?:[/?#].*)?$/i;

export function extractTiktokVideoId(url: string): string | null {
  return url.trim().match(TIKTOK_VIDEO_URL_REGEX)?.[1] ?? null;
}

export const tiktokVideoUrlSchema = z
  .string()
  .trim()
  .refine((url) => extractTiktokVideoId(url) !== null, {
    message:
      'URL TikTok invalide (format attendu : https://www.tiktok.com/@compte/video/1234567890123456789)',
  });

export const tiktokVideoInputSchema = z.object({
  url: tiktokVideoUrlSchema,
  caption: z
    .string()
    .trim()
    .max(TIKTOK_CAPTION_MAX, 'Légende trop longue')
    .nullable()
    .optional(),
  isActive: z.boolean().default(true),
});

export type TiktokVideoInput = z.infer<typeof tiktokVideoInputSchema>;

export const tiktokVideoUpdateSchema = tiktokVideoInputSchema
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Au moins un champ à mettre à jour est requis',
  });

export type TiktokVideoUpdateInput = z.infer<typeof tiktokVideoUpdateSchema>;

export const moveTiktokVideoSchema = z.object({
  direction: z.enum(['up', 'down']),
});

export type MoveTiktokVideoInput = z.infer<typeof moveTiktokVideoSchema>;
