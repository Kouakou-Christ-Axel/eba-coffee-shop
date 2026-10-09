import {
  MAX_UPLOAD_SIZE_BYTES,
  isAllowedImageMimeType,
} from '@/lib/schemas/upload';
import { MAX_UPLOAD_SIZE_MB, saveImage, sniffAllowedImageMime } from './save';
import type { UploadSubdir } from './paths';

/** Délai max (ms) pour télécharger une image distante depuis une URL. */
export const REMOTE_FETCH_TIMEOUT_MS = 15000;

/** Lit le corps en refusant tout ce qui dépasse la taille max, sans le charger en entier. */
export async function readBodyCapped(res: Response): Promise<Buffer> {
  const reader = res.body?.getReader();
  if (!reader) {
    // Pas de flux : on retombe sur arrayBuffer (petits corps).
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_UPLOAD_SIZE_BYTES) {
      throw new Error(`Fichier trop volumineux (max ${MAX_UPLOAD_SIZE_MB} MB)`);
    }
    return buf;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.length;
      if (total > MAX_UPLOAD_SIZE_BYTES) {
        await reader.cancel();
        throw new Error(
          `Fichier trop volumineux (max ${MAX_UPLOAD_SIZE_MB} MB)`
        );
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks);
}

/** Télécharge une image http(s), la valide (taille + format) puis l'enregistre. */
export async function saveImageFromUrl(
  url: string,
  subdir: UploadSubdir
): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('URL invalide');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('URL invalide : protocole http(s) attendu');
  }

  let res: Response;
  try {
    res = await fetch(parsed, {
      redirect: 'follow',
      signal: AbortSignal.timeout(REMOTE_FETCH_TIMEOUT_MS),
      headers: { accept: 'image/*' },
    });
  } catch {
    throw new Error('Téléchargement de l’image impossible (URL injoignable)');
  }
  if (!res.ok) {
    throw new Error(
      `Téléchargement de l’image impossible (HTTP ${res.status})`
    );
  }

  // Rejet précoce si le serveur annonce une taille trop grande.
  const declaredLength = Number(res.headers.get('content-length'));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_UPLOAD_SIZE_BYTES
  ) {
    throw new Error(`Fichier trop volumineux (max ${MAX_UPLOAD_SIZE_MB} MB)`);
  }

  const buffer = await readBodyCapped(res);

  // Le `Content-Type` déclaré peut mentir : on privilégie le format réellement
  // décodé, avec le Content-Type comme repli.
  const declaredMime = (res.headers.get('content-type') ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  const mime = isAllowedImageMimeType(declaredMime)
    ? declaredMime
    : await sniffAllowedImageMime(buffer);
  if (!mime) {
    throw new Error(
      'L’URL ne pointe pas vers une image supportée (JPEG, PNG, WebP, AVIF, HEIC)'
    );
  }

  return saveImage(buffer, mime, subdir);
}
