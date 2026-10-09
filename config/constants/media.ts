/** Taille maximale d'un upload d'image en octets (25 MB). */
export const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

/** Plus grand côté (px) après redimensionnement. */
export const IMAGE_MAX_DIMENSION = 2200;

export const MENU_PDF_MAX_SIZE_BYTES = 10 * 1024 * 1024;

/** Qualité WebP (0-100) à l'encodage des images stockées. */
export const IMAGE_WEBP_QUALITY = 80;

/** Vignette de partage unique du site : Open Graph, Twitter Card et champ `image` du JSON-LD pointent tous ici. */
export const OG_IMAGE = {
  url: '/assets/og/eba-og.jpg',
  width: 1200,
  height: 630,
  alt: 'EBA Coffee Shop à Abidjan',
} as const;
