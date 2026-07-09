// components/ui/media-image.tsx
//
// Wrapper autour de `next/image` pour les médias dynamiques (produits,
// sondages, justificatifs, preuves de paiement) : bascule automatiquement sur
// le loader Cloudinary (lib/cloudinary-loader.ts) quand `src` pointe vers
// Cloudinary, pour que le redimensionnement/format se fasse côté CDN
// Cloudinary sans jamais repasser par notre serveur (`/_next/image`). Pour
// une URL locale legacy (`/uploads/...`), l'optimiseur Next par défaut reste
// utilisé (comportement inchangé, repli lecture seule).
//
// À utiliser à la place de `next/image` pour tout `<Image>` dont `src` peut
// contenir un des 7 champs média dynamiques (Product/Poll/PollOption
// .imageUrl, Expense.receiptUrl, Investment.documentUrl,
// Order.paymentProofUrl). Les images statiques marketing (`public/assets/*`)
// continuent d'utiliser `next/image` directement — jamais de loader
// Cloudinary sur une URL locale de build.

import Image, { type ImageProps } from 'next/image';
import cloudinaryLoader from '@/lib/cloudinary-loader';

const CLOUDINARY_HOST = 'res.cloudinary.com';

export function MediaImage(props: ImageProps) {
  const src = typeof props.src === 'string' ? props.src : '';
  const loader = src.includes(CLOUDINARY_HOST) ? cloudinaryLoader : undefined;
  // `alt` est requis par `ImageProps` et transite via le spread ci-dessous ;
  // la règle ne détecte pas les props répandues (faux positif).
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image {...props} loader={loader} />;
}
