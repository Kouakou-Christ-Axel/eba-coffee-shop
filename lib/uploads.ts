// lib/uploads.ts
//
// Logique de persistance des images uploadées, partagée entre la route HTTP
// (`app/api/upload/route.ts`, upload multipart depuis le dashboard) et le
// serveur MCP (`lib/mcp/tools.ts`, upload en base64 depuis un agent). Aucune
// duplication : la validation (MIME/taille) et l'écriture disque vivent ici.
//
// Les fichiers sont écrits dans `public/uploads/<subdir>/` et exposés en
// same-origin sous `/uploads/<subdir>/<uuid>.<ext>` (rendu sous CSP `'self'`).
// Deux familles aujourd'hui : `products` (images produit) et `receipts`
// (justificatifs de dépense).

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { IMAGE_MAX_DIMENSION, IMAGE_WEBP_QUALITY } from '@/config/constants';
import {
  MAX_UPLOAD_SIZE_BYTES,
  isAllowedImageMimeType,
} from '@/lib/schemas/upload';

const MAX_UPLOAD_SIZE_MB = Math.round(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024));

/** Sous-dossiers d'upload autorisés (whitelist — pas de chemin arbitraire). */
export type UploadSubdir = 'products' | 'receipts';

/** URL publique (relative, same-origin) servie pour un fichier uploadé. */
function publicUrl(subdir: UploadSubdir, filename: string): string {
  return `/uploads/${subdir}/${filename}`;
}

/**
 * Valide (MIME déclaré + taille), retraite l'image avec sharp
 * (auto-orientation EXIF, redimensionnement « à l'intérieur » de
 * IMAGE_MAX_DIMENSION, ré-encodage WebP), puis l'écrit dans `subdir`. Renvoie
 * l'URL relative du fichier WebP. Lève une `Error` (message lisible) si la
 * taille dépasse, si le MIME déclaré n'est pas autorisé, ou si le contenu n'est
 * pas une image décodable.
 *
 * Quel que soit le format d'entrée (JPEG/PNG/WebP/AVIF/HEIC…), la sortie stockée
 * est un `.webp` léger — ce qui permet d'accepter des photos de téléphone
 * volumineuses tout en gardant des fichiers compacts.
 */
export async function saveImage(
  buffer: Buffer,
  mimeType: string,
  subdir: UploadSubdir
): Promise<string> {
  if (!isAllowedImageMimeType(mimeType)) {
    throw new Error('Format non supporté (JPEG, PNG, WebP, AVIF, HEIC)');
  }
  if (buffer.length === 0) {
    throw new Error('Fichier vide');
  }
  if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(`Fichier trop volumineux (max ${MAX_UPLOAD_SIZE_MB} MB)`);
  }

  let webp: Buffer;
  try {
    webp = await sharp(buffer, { failOn: 'none' })
      .rotate() // applique l'orientation EXIF puis la supprime
      .resize(IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: IMAGE_WEBP_QUALITY })
      .toBuffer();
  } catch {
    // sharp valide réellement le contenu : un fichier corrompu ou un format
    // non décodable (ex. HEIC sur un build sans libheif) échoue ici.
    throw new Error('Image illisible ou format non supporté');
  }

  const filename = `${randomUUID()}.webp`;
  const dir = join(process.cwd(), 'public', 'uploads', subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), webp);
  return publicUrl(subdir, filename);
}

/**
 * Décode une image fournie en base64 (brut) ou en data URI
 * (`data:<mime>;base64,<...>`) et l'enregistre dans `subdir`. Le `mimeType`
 * explicite est requis sauf si une data URI le porte. Pensée pour le serveur
 * MCP, où l'agent envoie l'image encodée en texte JSON plutôt qu'en multipart.
 */
export async function saveImageFromBase64(
  input: string,
  subdir: UploadSubdir,
  mimeType?: string
): Promise<string> {
  let data = input.trim();
  let mime = mimeType;

  const dataUri = data.match(/^data:([^;,]+);base64,([\s\S]*)$/);
  if (dataUri) {
    mime = dataUri[1];
    data = dataUri[2];
  }

  if (!mime) {
    throw new Error(
      'mimeType requis (ou fournis une data URI `data:<mime>;base64,...`)'
    );
  }
  if (!isAllowedImageMimeType(mime)) {
    throw new Error('Format non supporté (JPEG, PNG, WebP, AVIF, HEIC)');
  }

  return saveImage(Buffer.from(data, 'base64'), mime, subdir);
}

// ─── Wrappers par famille (subdir figé) ───────────────────────────────────────

/** Image produit (multipart dashboard). */
export const saveProductImage = (buffer: Buffer, mimeType: string) =>
  saveImage(buffer, mimeType, 'products');

/** Image produit depuis base64 (MCP). */
export const saveProductImageFromBase64 = (input: string, mimeType?: string) =>
  saveImageFromBase64(input, 'products', mimeType);

/** Justificatif de dépense (multipart dashboard). */
export const saveReceiptImage = (buffer: Buffer, mimeType: string) =>
  saveImage(buffer, mimeType, 'receipts');

/** Justificatif de dépense depuis base64 (MCP). */
export const saveReceiptImageFromBase64 = (input: string, mimeType?: string) =>
  saveImageFromBase64(input, 'receipts', mimeType);
