// lib/schemas/upload.ts
//
// Constantes et helpers centralisés pour la validation des uploads d'images.
// Source : app/api/upload/route.ts (MAX_BYTES, ALLOWED_MIMES, extension
// derivation). On élargit la whitelist à AVIF pour préparer la prochaine vague
// de l'intégration ; les routes existantes ne sont pas touchées dans ce lot.

import { z } from 'zod';

// ─── MIME types autorisés (whitelist) ─────────────────────────────────────────

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

const ALLOWED_IMAGE_MIME_SET: ReadonlySet<string> = new Set(
  ALLOWED_IMAGE_MIME_TYPES
);

export function isAllowedImageMimeType(
  mime: string
): mime is AllowedImageMimeType {
  return ALLOWED_IMAGE_MIME_SET.has(mime);
}

// ─── Taille maximale ──────────────────────────────────────────────────────────
// 5 MB en octets (valeur historique de app/api/upload/route.ts).

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

// ─── Extension à partir du MIME ───────────────────────────────────────────────
//
// Whitelist explicite — pas de split('/'), pour éviter qu'un Content-Type
// frauduleux (ex. "image/svg+xml") n'aboutisse à une extension non prévue.

const MIME_TO_EXTENSION: Record<
  AllowedImageMimeType,
  'jpg' | 'png' | 'webp' | 'avif'
> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export function imageExtensionFromMime(
  mime: string
): 'jpg' | 'png' | 'webp' | 'avif' | null {
  if (!isAllowedImageMimeType(mime)) return null;
  return MIME_TO_EXTENSION[mime];
}

// ─── Schéma Zod (validation File côté serveur) ────────────────────────────────
//
// Validation runtime d'un objet File extrait d'un FormData. Utilisable depuis
// une route handler après `formData.get('file')`.

export const uploadFileSchema = z
  .instanceof(File, { message: 'Fichier manquant' })
  .refine((file) => isAllowedImageMimeType(file.type), {
    message: 'Format non supporté (JPEG, PNG, WebP, AVIF uniquement)',
  })
  .refine((file) => file.size > 0, { message: 'Fichier vide' })
  .refine((file) => file.size <= MAX_UPLOAD_SIZE_BYTES, {
    message: 'Fichier trop volumineux (max 5 MB)',
  });

export type UploadFileInput = z.infer<typeof uploadFileSchema>;
