// components/(public)/carte/carte-menu-section.tsx
import { getMenu } from '@/lib/menu';
import { getMenuWithPopularity } from '@/lib/menu-popularity';
import { sortProductsForDisplay } from '@/lib/menu-display';
import { buildMenuJsonLd } from '@/lib/json-ld';
import CarteMenuSectionClient from './carte-menu-section-client';

export default async function CarteMenuSection() {
  const menuData = await getMenu();
  // JSON-LD construit AVANT le tri d'affichage : la carte déclarée aux moteurs
  // garde l'ordre officiel du dashboard, indépendant de ce qui est épuisé à
  // l'instant du rendu.
  const menuJsonLd = buildMenuJsonLd(menuData);
  // Preuve sociale (« #1 le plus commandé », « 128 commandés ce mois-ci ») :
  // agrégée ici uniquement, derrière l'ISR de /carte — voir lib/menu-popularity.ts.
  const menuWithPopularity = await getMenuWithPopularity(menuData);
  // Tri par disponibilité côté SERVEUR : il dépend de l'heure courante, et le
  // refaire au rendu client divergerait du HTML mis en cache par l'ISR
  // (mismatch d'hydratation). Voir lib/menu-display.ts.
  const menuForDisplay = sortProductsForDisplay(menuWithPopularity);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(menuJsonLd) }}
      />
      <CarteMenuSectionClient menuData={menuForDisplay} />
    </>
  );
}
