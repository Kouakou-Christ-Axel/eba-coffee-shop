import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { IMAGE_MAX_DIMENSION, IMAGE_WEBP_QUALITY } from '@/config/constants';
import {
  MAX_UPLOAD_SIZE_BYTES,
  isAllowedImageMimeType,
} from '@/lib/schemas/upload';
import { type UploadSubdir, uploadsBaseDir, publicUrl } from './paths';

export const MAX_UPLOAD_SIZE_MB = Math.round(
  MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)
);

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
  const dir = join(uploadsBaseDir(), subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), webp);
  return publicUrl(subdir, filename);
}

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

/** Format réel détecté par sharp (le Content-Type distant n'est pas fiable). */
export async function sniffAllowedImageMime(
  buffer: Buffer
): Promise<string | undefined> {
  let format: string | undefined;
  try {
    ({ format } = await sharp(buffer, { failOn: 'none' }).metadata());
  } catch {
    return undefined;
  }
  // sharp expose 'jpeg' | 'png' | 'webp' | 'avif' | 'heif' | 'gif' | …
  switch (format) {
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    case 'heif':
      return 'image/heic';
    default:
      return undefined;
  }
}
