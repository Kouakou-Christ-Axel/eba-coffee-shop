// components/(public)/carte/_components/product-media.tsx
//
// Briques visuelles partagées par les trois surfaces de vente de la carte :
// la ligne produit (`product-card.tsx`), la vitrine « Les plus commandés »
// (`featured-showcase.tsx`) et la modale produit (`supplement-modal.tsx`).
// Centralisées ici pour qu'un produit garde exactement la même identité — même
// photo, même repli, même badge — d'un bout à l'autre du tunnel.

import { MediaImage } from '@/components/ui/media-image';
import type { Product } from '@/config/menu';

/**
 * Photo du produit, ou repli de marque quand il n'y en a pas. L'ancien repli
 * (initiale grise sur fond gris) se lisait comme une image cassée ; celui-ci
 * assume un visuel maison — dégradé crème/violet et monogramme traité — pour
 * qu'un produit sans photo reste vendable.
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
      className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(247,239,232,1)_0%,rgba(233,220,240,1)_100%)]"
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
 * Badge de mise en avant, en un seul exemplaire par produit : le rang de vente
 * l'emporte sur le badge éditorial (`featuredBadge`, saisi au dashboard), parce
 * qu'un fait mesuré convainc mieux qu'une étiquette maison.
 *
 * Ne publie que le rang, jamais le volume de ventes (voir lib/menu-popularity.ts).
 */
export function productBadgeLabel(product: Product): string | null {
  if (product.popularRank === 1) return 'Le plus commandé';
  if (product.popularRank != null) return `#${product.popularRank} des ventes`;
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
