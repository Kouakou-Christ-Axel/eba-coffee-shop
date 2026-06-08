// lib/uploads.ts
//
// Logique de persistance des images produit, partagée entre la route HTTP
// (`app/api/upload/route.ts`, upload multipart depuis le dashboard) et le
// serveur MCP (`lib/mcp/tools.ts`, upload en base64 depuis un agent). Aucune
// duplication : la validation (MIME/taille) et l'écriture disque vivent ici.
//
// Les fichiers sont écrits dans `public/uploads/products/` et exposés en
// same-origin sous `/uploads/products/<uuid>.<ext>` (rendu sous CSP `'self'`).

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  MAX_UPLOAD_SIZE_BYTES,
  imageExtensionFromMime,
  isAllowedImageMimeType,
} from '@/lib/schemas/upload';

const UPLOAD_SUBDIR = ['public', 'uploads', 'products'] as const;

/** URL publique (relative, same-origin) servie pour un fichier produit. */
function publicUrl(filename: string): string {
  return `/uploads/products/${filename}`;
}

/**
 * Valide (MIME + taille) puis écrit un buffer image et renvoie son URL relative.
 * Lève une `Error` (message lisible) en cas de format/taille invalide.
 */
export async function saveProductImage(
  buffer: Buffer,
  mimeType: string
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
  const dir = join(process.cwd(), ...UPLOAD_SUBDIR);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), buffer);
  return publicUrl(filename);
}

/**
 * Décode une image fournie en base64 (brut) ou en data URI
 * (`data:<mime>;base64,<...>`) et l'enregistre. Le `mimeType` explicite est
 * requis sauf si une data URI le porte. Pensée pour le serveur MCP, où l'agent
 * envoie l'image encodée en texte JSON plutôt qu'en multipart.
 */
export async function saveProductImageFromBase64(
  input: string,
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

  const buffer = Buffer.from(data, 'base64');
  return saveProductImage(buffer, mime);
}
