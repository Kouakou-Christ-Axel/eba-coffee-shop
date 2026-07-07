// lib/image-compress.ts
//
// Compression d'image côté NAVIGATEUR avant upload (canvas → JPEG). Utilisée
// par la page publique de suivi pour la preuve de paiement : une capture Wave
// de 1-4 Mo ressort à ~100-300 Ko — sous le plafond serveur de 1 Mo
// (PAYMENT_PROOF_MAX_SIZE_BYTES) et la limite par défaut des reverse proxies,
// et rapide à envoyer en 3G.
//
// Bonus : une photo iPhone HEIC est décodée nativement par Safari et ressort
// en JPEG — le serveur n'a plus besoin de libheif pour ce flux.
//
// Client only (canvas / createImageBitmap) — à importer uniquement depuis des
// composants 'use client'.

import {
  PAYMENT_PROOF_JPEG_QUALITY,
  PAYMENT_PROOF_MAX_DIMENSION,
} from '@/config/constants';

type CompressOptions = {
  /** Plus grand côté (px) après redimensionnement (jamais agrandi). */
  maxDimension?: number;
  /** Qualité JPEG (0-1). */
  quality?: number;
};

/** Décode le fichier en bitmap, via createImageBitmap puis repli <img>. */
async function decodeImage(
  file: File
): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // Certains formats (ex. HEIC sur Chrome) échouent ici mais passent
      // parfois par le décodeur <img> — on tente le repli.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image illisible'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Redimensionne (« inside », sans agrandir) et ré-encode le fichier en JPEG.
 * Renvoie `null` si le navigateur ne sait pas décoder le fichier — l'appelant
 * décide alors quoi faire (envoyer l'original, afficher une erreur…).
 */
export async function compressImage(
  file: File,
  {
    maxDimension = PAYMENT_PROOF_MAX_DIMENSION,
    quality = PAYMENT_PROOF_JPEG_QUALITY,
  }: CompressOptions = {}
): Promise<File | null> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decodeImage(file);
  } catch {
    return null;
  }

  const srcWidth =
    'naturalWidth' in source ? source.naturalWidth : source.width;
  const srcHeight =
    'naturalHeight' in source ? source.naturalHeight : source.height;
  if (!srcWidth || !srcHeight) return null;

  const scale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight));
  const width = Math.max(1, Math.round(srcWidth * scale));
  const height = Math.max(1, Math.round(srcHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // Fond blanc : le JPEG n'a pas d'alpha (captures PNG transparentes).
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  if ('close' in source) source.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality);
  });
  if (!blob) return null;

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}
