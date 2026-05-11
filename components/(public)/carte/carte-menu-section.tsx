// components/(public)/carte/carte-menu-section.tsx
import { getMenu } from '@/lib/menu';
import CarteMenuSectionClient from './carte-menu-section-client';

export default async function CarteMenuSection() {
  const menuData = await getMenu();
  return <CarteMenuSectionClient menuData={menuData} />;
}
