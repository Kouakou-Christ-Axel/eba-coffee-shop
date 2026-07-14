// components/(public)/carte/carte-menu-section.tsx
import { getMenu } from '@/lib/menu';
import { buildMenuJsonLd } from '@/lib/json-ld';
import CarteMenuSectionClient from './carte-menu-section-client';

export default async function CarteMenuSection() {
  const menuData = await getMenu();
  const menuJsonLd = buildMenuJsonLd(menuData);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(menuJsonLd) }}
      />
      <CarteMenuSectionClient menuData={menuData} />
    </>
  );
}
