// components/(public)/carte/_components/product-media.tsx
//
// Briques visuelles partagées par les trois surfaces de vente de la carte :
// la ligne produit (`product-card.tsx`), la vitrine « Les plus commandés »
// (`featured-showcase.tsx`) et la modale produit (`supplement-modal.tsx`).
// Centralisées ici pour qu'un produit garde exactement la même identité — même
// photo, même repli, même badge — d'un bout à l'autre du tunnel.

import { MediaImage } from '@/components/ui/media-image';
import type { Product } from '@/config/menu';
import {
  MONOGRAM_GRADIENTS,
  POPULARITY_RANKED_COUNT,
} from '@/config/constants';
import { isWithinAnyPeriod } from '@/lib/supplements';

/**
 * Dégradé du repli, choisi par hash du `Product.id`. Déterministe — le serveur
 * et le client tombent sur la même variante, et un produit garde la sienne d'un
 * chargement à l'autre. Le hash est volontairement trivial : on répartit quatre
 * fonds, on ne protège rien.
 */
function monogramGradient(productId: string): string {
  let sum = 0;
  for (let i = 0; i < productId.length; i++) sum += productId.charCodeAt(i);
  return MONOGRAM_GRADIENTS[sum % MONOGRAM_GRADIENTS.length];
}

/**
 * Photo du produit, ou repli de marque quand il n'y en a pas. L'ancien repli
 * (initiale grise sur fond gris) se lisait comme une image cassée ; celui-ci
 * assume un visuel maison — dégradé de marque et monogramme traité — pour
 * qu'un produit sans photo reste vendable. Le dégradé varie par produit
 * (`monogramGradient`) : la plupart du catalogue n'est pas photographiée, et
 * une grille de tuiles identiques ressemblerait à un défaut de chargement.
 *
 * Toujours rendu en `fill` : c'est le conteneur (`relative`, dimensions +
 * `overflow-hidden`) qui décide de la taille, jamais ce composant.
 */
export function ProductMedia({
  product,
  sizes,
  className = '',
  monogramClassName = 'text-3xl',
}: {
  product: Product;
  /** Indice de taille pour `next/image` (obligatoire en `fill`). */
  sizes: string;
  /** Classes appliquées à l'image (ex. transition de survol). */
  className?: string;
  /** Taille du monogramme du repli, à ajuster selon le conteneur. */
  monogramClassName?: string;
}) {
  if (product.image) {
    return (
      <MediaImage
        src={product.image}
        alt={product.name}
        fill
        sizes={sizes}
        className={`object-cover ${className}`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      style={{ backgroundImage: monogramGradient(product.id) }}
      className="flex h-full w-full items-center justify-center"
    >
      <span
        className={`font-semibold tracking-tight text-primary/30 ${monogramClassName}`}
      >
        {product.name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

/**
 * Badge de mise en avant, en un seul exemplaire par produit. Priorité : une
 * « spécialité de la semaine » ACTIVEMENT en cours l'emporte sur tout le
 * reste (le plus urgent/nouveau d'abord) ; sinon le rang de vente l'emporte
 * sur le badge éditorial (`featuredBadge`, saisi au dashboard), parce qu'un
 * fait mesuré convainc mieux qu'une étiquette maison.
 *
 * Ne publie que le rang, jamais le volume de ventes (voir lib/menu-popularity.ts).
 */
export function productBadgeLabel(product: Product): string | null {
  if (
    (product.weeklySpecialPeriods?.length ?? 0) > 0 &&
    isWithinAnyPeriod(product.weeklySpecialPeriods)
  ) {
    return 'Spécialité de la semaine';
  }
  const rank = product.popularRank;
  // `popularRank` est posé sur tous les produits assez vendus (il sert aussi à
  // ORDONNER la vitrine) ; seuls les premiers méritent un badge — « #14 des
  // ventes » ne vend rien.
  if (rank != null && rank <= POPULARITY_RANKED_COUNT) {
    return rank === 1 ? 'Le plus commandé' : `#${rank} des ventes`;
  }
  return product.featuredBadge ?? null;
}

/**
 * Pastille de mise en avant, posée dans le BLOC TEXTE et non sur la photo.
 *
 * En overlay elle masquait une partie de l'image — exactement ce qu'on venait
 * d'agrandir pour donner envie — et sa lisibilité dépendait de ce qu'il y avait
 * dessous : un badge violet sur une photo sombre passait inaperçu, sur une
 * photo claire il écrasait le produit. Au-dessus du nom, elle est toujours
 * lisible, ne cache rien, et se lit dans le fil naturel « badge → nom → prix ».
 */
export function ProductBadge({
  label,
  className = '',
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block max-w-full truncate rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary ${className}`}
    >
      {label}
    </span>
  );
}
