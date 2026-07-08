// lib/uploads.ts
//
// Logique de persistance des images uploadées, partagée entre la route HTTP
// (`app/api/upload/route.ts`, upload multipart depuis le dashboard) et le
// serveur MCP (`lib/mcp/tools.ts`, upload en base64 depuis un agent). Aucune
// duplication : la validation (MIME/taille) et l'écriture disque vivent ici.
//
// Les fichiers sont écrits dans `public/uploads/<subdir>/` et exposés en
// same-origin sous `/uploads/<subdir>/<uuid>.<ext>` (rendu sous CSP `'self'`).
// Trois familles aujourd'hui : `products` (images produit), `receipts`
// (justificatifs de dépense) et `payment-proofs` (preuves de paiement de
// commande envoyées par les clients).

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

/** Délai max (ms) pour télécharger une image distante depuis une URL. */
const REMOTE_FETCH_TIMEOUT_MS = 15000;

/** Sous-dossiers d'upload autorisés (whitelist — pas de chemin arbitraire). */
export type UploadSubdir =
  | 'products'
  | 'receipts'
  | 'payment-proofs'
  | 'poll-options';

/**
 * Racine disque des fichiers uploadés : `<cwd>/public/uploads`.
 *
 * ⚠️ En production (`next start`), les fichiers écrits ici **au runtime** ne
 * sont PAS servis par le handler statique de `public/` (seuls les assets
 * présents au moment du `build` le sont). C'est pourquoi ils sont servis par un
 * route handler dédié (`app/uploads/[...path]/route.ts`), qui lit exactement ce
 * dossier — d'où la centralisation ici pour garantir l'alignement écriture ↔
 * lecture. En prod, ce dossier est persisté entre déploiements (symlink/volume,
 * cf. `.gitignore`).
 */
export function uploadsBaseDir(): string {
  return join(process.cwd(), 'public', 'uploads');
}

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
  const dir = join(uploadsBaseDir(), subdir);
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

/**
 * Devine le type MIME réel d'un buffer image en le décodant avec sharp
 * (le `Content-Type` HTTP d'un serveur distant n'est pas fiable). Renvoie
 * `undefined` si le format décodé n'est pas dans la whitelist.
 */
async function sniffAllowedImageMime(
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

/**
 * Lit le corps d'une réponse HTTP en refusant tout ce qui dépasse
 * `MAX_UPLOAD_SIZE_BYTES` (un `Content-Length` menteur ne suffit pas à faire
 * exploser la mémoire : on coupe au fil de la lecture).
 */
async function readBodyCapped(res: Response): Promise<Buffer> {
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

/**
 * Télécharge une image depuis une URL http(s), la valide (taille + format
 * réellement décodé), la retraite avec sharp et l'enregistre localement dans
 * `subdir`. Renvoie l'URL relative du WebP stocké.
 *
 * Pensée pour le serveur MCP : un client comme Claude ne peut pas ré-encoder
 * une photo en base64 dans un appel d'outil, mais il peut fournir une URL
 * publique. En rapatriant le fichier côté serveur, l'image finit servie en
 * same-origin (`/uploads/...`) — donc affichable sous la CSP `img-src 'self'`,
 * sans avoir à whitelister l'hôte distant dans `next.config.ts`.
 */
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

// ─── Wrappers par famille (subdir figé) ───────────────────────────────────────

/** Image produit (multipart dashboard). */
export const saveProductImage = (buffer: Buffer, mimeType: string) =>
  saveImage(buffer, mimeType, 'products');

/** Image produit depuis base64 (MCP). */
export const saveProductImageFromBase64 = (input: string, mimeType?: string) =>
  saveImageFromBase64(input, 'products', mimeType);

/** Image produit rapatriée depuis une URL distante (MCP). */
export const saveProductImageFromUrl = (url: string) =>
  saveImageFromUrl(url, 'products');

/** Justificatif de dépense (multipart dashboard). */
export const saveReceiptImage = (buffer: Buffer, mimeType: string) =>
  saveImage(buffer, mimeType, 'receipts');

/** Justificatif de dépense depuis base64 (MCP). */
export const saveReceiptImageFromBase64 = (input: string, mimeType?: string) =>
  saveImageFromBase64(input, 'receipts', mimeType);

/** Justificatif de dépense/apport rapatrié depuis une URL distante (MCP). */
export const saveReceiptImageFromUrl = (url: string) =>
  saveImageFromUrl(url, 'receipts');

/** Preuve de paiement d'une commande (capture Wave, page publique de suivi). */
export const savePaymentProofImage = (buffer: Buffer, mimeType: string) =>
  saveImage(buffer, mimeType, 'payment-proofs');

/** Image d'une option de sondage (multipart dashboard). */
export const savePollOptionImage = (buffer: Buffer, mimeType: string) =>
  saveImage(buffer, mimeType, 'poll-options');

/** Image d'une option de sondage depuis base64 (MCP). */
export const savePollOptionImageFromBase64 = (
  input: string,
  mimeType?: string
) => saveImageFromBase64(input, 'poll-options', mimeType);

/** Image d'une option de sondage rapatriée depuis une URL distante (MCP). */
export const savePollOptionImageFromUrl = (url: string) =>
  saveImageFromUrl(url, 'poll-options');

/**
 * Photo jointe à une suggestion de pâtisserie (multipart, page publique — même
 * pipeline `saveImage`, aucune session requise). Route dédiée en capability
 * URL : app/api/sondages/suggestions/[id]/photo/route.ts.
 */
export const savePollSuggestionImage = (buffer: Buffer, mimeType: string) =>
  saveImage(buffer, mimeType, 'poll-options');
