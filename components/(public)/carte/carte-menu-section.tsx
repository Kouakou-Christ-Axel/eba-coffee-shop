// components/(public)/carte/carte-menu-section.tsx
import { getMenu } from '@/lib/menu';
import { getMenuWithPopularity } from '@/lib/menu-popularity';
import { buildMenuJsonLd } from '@/lib/json-ld';
import CarteMenuSectionClient from './carte-menu-section-client';

export default async function CarteMenuSection() {
  const menuData = await getMenu();
  const menuJsonLd = buildMenuJsonLd(menuData);
  // Preuve sociale (« #1 le plus commandé », « 128 commandés ce mois-ci ») :
  // agrégée ici uniquement, derrière l'ISR de /carte — voir lib/menu-popularity.ts.
  const menuWithPopularity = await getMenuWithPopularity(menuData);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(menuJsonLd) }}
      />
      <CarteMenuSectionClient menuData={menuWithPopularity} />
    </>
  );
}
