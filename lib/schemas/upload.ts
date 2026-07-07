// lib/schemas/upload.ts
//
// Constantes et helpers centralisés pour la validation des uploads d'images.
// La whitelist couvre les formats d'ENTRÉE acceptés (dont HEIC/HEIF des
// iPhone) ; quel que soit le format reçu, l'image est redimensionnée et
// ré-encodée en WebP côté serveur (lib/uploads.ts → saveImage). Le plafond de
// taille est centralisé dans config/constants.ts (ré-exporté ci-dessous).

import { z } from 'zod';
import {
  MAX_UPLOAD_SIZE_BYTES,
  PAYMENT_PROOF_MAX_SIZE_BYTES,
} from '@/config/constants';

export { MAX_UPLOAD_SIZE_BYTES, PAYMENT_PROOF_MAX_SIZE_BYTES };

const MAX_UPLOAD_SIZE_MB = Math.round(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024));
const PAYMENT_PROOF_MAX_SIZE_MB = Math.round(
  PAYMENT_PROOF_MAX_SIZE_BYTES / (1024 * 1024)
);

// ─── MIME types autorisés en entrée (whitelist) ───────────────────────────────

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
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

// ─── Extension à partir du MIME ───────────────────────────────────────────────
//
// Note : les images stockées sont TOUJOURS en WebP (cf. lib/uploads.ts). Ce
// helper ne sert donc plus à dériver l'extension de sortie ; il reste exposé
// comme mapping explicite (pas de split('/'), pour éviter qu'un Content-Type
// frauduleux n'aboutisse à une extension non prévue) et renvoie `null` pour les
// formats sans extension « brute » canonique (HEIC/HEIF → reconvertis).

const MIME_TO_EXTENSION: Partial<
  Record<AllowedImageMimeType, 'jpg' | 'png' | 'webp' | 'avif'>
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
  return MIME_TO_EXTENSION[mime] ?? null;
}

// ─── Schéma Zod (validation File côté serveur) ────────────────────────────────
//
// Validation runtime d'un objet File extrait d'un FormData. Utilisable depuis
// une route handler après `formData.get('file')`.

export const uploadFileSchema = z
  .instanceof(File, { message: 'Fichier manquant' })
  .refine((file) => isAllowedImageMimeType(file.type), {
    message: 'Format non supporté (JPEG, PNG, WebP, AVIF, HEIC)',
  })
  .refine((file) => file.size > 0, { message: 'Fichier vide' })
  .refine((file) => file.size <= MAX_UPLOAD_SIZE_BYTES, {
    message: `Fichier trop volumineux (max ${MAX_UPLOAD_SIZE_MB} MB)`,
  });

export type UploadFileInput = z.infer<typeof uploadFileSchema>;

// ─── Preuve de paiement (page publique de suivi) ──────────────────────────────
//
// Plafond dédié bien plus strict (1 Mo, cf. config/constants.ts) : l'image est
// déjà compressée dans le NAVIGATEUR (lib/image-compress.ts) avant d'arriver
// ici. Ce schéma n'est qu'un garde-fou serveur, pas le mécanisme de réduction.

export const paymentProofFileSchema = z
  .instanceof(File, { message: 'Fichier manquant' })
  .refine((file) => isAllowedImageMimeType(file.type), {
    message: 'Format non supporté (JPEG, PNG, WebP, AVIF, HEIC)',
  })
  .refine((file) => file.size > 0, { message: 'Fichier vide' })
  .refine((file) => file.size <= PAYMENT_PROOF_MAX_SIZE_BYTES, {
    message: `Image trop lourde (max ${PAYMENT_PROOF_MAX_SIZE_MB} Mo) — réessaie avec une capture d’écran`,
  });

export type PaymentProofFileInput = z.infer<typeof paymentProofFileSchema>;

// ─── URL/chemin d'image d'un produit ──────────────────────────────────────────
//
// Depuis la migration VPS, `/api/upload` renvoie un chemin RELATIF same-origin
// (`/uploads/products/<uuid>.<ext>`) — qui n'est pas une URL absolue valide. Le
// schéma de produit utilisait `z.string().url()`, qui REJETTE ces chemins : la
// sauvegarde d'une image uploadée localement échouait donc (dashboard ET MCP).
//
// `imageUrlSchema` accepte les deux formes réellement affichables :
//   • un chemin relatif same-origin commençant par `/` (uploads locaux) ;
//   • une URL absolue http(s) (ex. legacy Vercel Blob, CDN whitelisté).
//
// Note rendu : les chemins relatifs s'affichent sous CSP `img-src 'self'` ; une
// URL absolue doit pointer vers un hôte autorisé dans `next.config.ts`
// (`images.remotePatterns`) et la CSP `img-src` pour être rendue par next/image.

export const imageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((v) => v.startsWith('/') || z.string().url().safeParse(v).success, {
    message:
      "URL d'image invalide : chemin relatif (/uploads/...) ou URL http(s) attendu",
  });

export type ImageUrlInput = z.infer<typeof imageUrlSchema>;
