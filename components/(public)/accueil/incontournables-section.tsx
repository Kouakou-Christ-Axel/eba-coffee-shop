// components/(public)/accueil/incontournables-section.tsx
//
// Vitrine éditoriale de l'accueil. Elle passe par `getMenu()` — la même source
// que /carte — et non plus par une requête Prisma sur mesure : depuis que les
// cartes sont commandables, il faut les suppléments, le stock, les plannings et
// les coûts, qu'un `select` de six champs n'exposait pas.

import { getMenu } from '@/lib/menu';
import { isOrderableNow } from '@/lib/supplements';
import { HOME_FEATURED_MAX_PRODUCTS } from '@/config/constants';
import type { MenuCategory, Product } from '@/config/menu';
import IncontournablesSectionClient from './incontournables-section-client';

/**
 * Sélection de l'accueil : mises en avant ÉDITORIALES (`featured`, cochées au
 * dashboard), dans l'ordre voulu par la gérance.
 *
 * Volontairement distincte de `selectShowcaseProducts` (vitrine de /carte), qui
 * privilégie le classement aux ventes : ici le discours est « ce qu'on aime
 * vous servir », pas « les plus commandés ». Seuls les produits réellement
 * commandables entrent — mettre en avant un produit épuisé est une promesse
 * qu'on ne peut pas tenir, et la carte propose désormais de l'ajouter au panier.
 */
export function selectFeaturedProducts(menuData: MenuCategory[]): Product[] {
  return menuData
    .flatMap((category) => category.products)
    .filter((p) => p.featured && isOrderableNow(p))
    .sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0))
    .slice(0, HOME_FEATURED_MAX_PRODUCTS);
}

async function IncontournablesSection() {
  const items = selectFeaturedProducts(await getMenu());

  if (items.length === 0) return null;

  return <IncontournablesSectionClient items={items} />;
}

export default IncontournablesSection;
