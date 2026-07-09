// lib/cloudinary-loader.ts
//
// Loader `next/image` personnalisé pour les URLs Cloudinary : insère les
// paramètres de transformation (format auto, qualité auto, largeur demandée)
// directement dans l'URL Cloudinary, qui sert l'image redimensionnée depuis
// son propre CDN. Contrairement à l'optimiseur par défaut de Next.js, aucune
// requête ne repasse par `/_next/image` ni par notre serveur.
//
// À passer en prop `loader` PAR `<Image>`, jamais en `images.loader: 'custom'`
// global (ça casserait les `<Image>` pointant vers des assets statiques
// locaux de `public/`, qui n'ont pas d'URL Cloudinary à transformer).

type LoaderArgs = {
  src: string;
  width: number;
  quality?: number;
};

const UPLOAD_MARKER = '/image/upload/';

export default function cloudinaryLoader({
  src,
  width,
  quality,
}: LoaderArgs): string {
  const idx = src.indexOf(UPLOAD_MARKER);
  if (idx === -1) return src;

  const insertAt = idx + UPLOAD_MARKER.length;
  const transformation = `f_auto,q_${quality ?? 'auto'},w_${width}`;
  return src.slice(0, insertAt) + transformation + '/' + src.slice(insertAt);
}
