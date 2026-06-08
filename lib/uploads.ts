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
import {
  MAX_UPLOAD_SIZE_BYTES,
  imageExtensionFromMime,
  isAllowedImageMimeType,
} from '@/lib/schemas/upload';

/** Sous-dossiers d'upload autorisés (whitelist — pas de chemin arbitraire). */
export type UploadSubdir = 'products' | 'receipts';

/** URL publique (relative, same-origin) servie pour un fichier uploadé. */
function publicUrl(subdir: UploadSubdir, filename: string): string {
  return `/uploads/${subdir}/${filename}`;
}

/**
 * Valide (MIME + taille) puis écrit un buffer image dans `subdir` et renvoie
 * son URL relative. Lève une `Error` (message lisible) si format/taille invalide.
 */
export async function saveImage(
  buffer: Buffer,
  mimeType: string,
  subdir: UploadSubdir
): Promise<string> {
  const ext = imageExtensionFromMime(mimeType);
  if (!ext) {
    throw new Error('Format non supporté (JPEG, PNG, WebP, AVIF uniquement)');
  }
  if (buffer.length === 0) {
    throw new Error('Fichier vide');
  }
  if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error('Fichier trop volumineux (max 5 MB)');
  }

  const filename = `${randomUUID()}.${ext}`;
  const dir = join(process.cwd(), 'public', 'uploads', subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), buffer);
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
    throw new Error('Format non supporté (JPEG, PNG, WebP, AVIF uniquement)');
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
