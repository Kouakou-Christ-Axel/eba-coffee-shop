// app/(public)/carte/page.tsx
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getMenuSettings } from '@/lib/menu-settings-db';
import { BreadcrumbJsonLd } from '@/components/(public)/breadcrumb-json-ld';
import CarteHeroSection from '@/components/(public)/carte/carte-hero-section';
import CarteMenuSection from '@/components/(public)/carte/carte-menu-section';
import CarteMenuSkeleton from '@/components/(public)/carte/carte-menu-skeleton';
import CartFloatingButton from '@/components/(public)/carte/cart-floating-button';
import DownloadMenuPdf from '@/components/(public)/carte/download-menu-pdf';

// ISR: regenerate the carte at most every 5 minutes. The menu changes more
// often than the homepage (prices, availability, supplements). The dashboard
// menu actions already call `revalidatePath('/carte')` on every edit, so this
// is mostly a freshness safety net behind the explicit invalidations.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'La carte',
  description:
    'Découvrez la carte EBA Coffee Shop : cafés de spécialité, pâtisseries artisanales, brunch et boissons signatures à Cocody, Abidjan.',
  alternates: { canonical: '/carte' },
  openGraph: {
    title: 'La carte',
    description:
      'Découvrez la carte EBA Coffee Shop : cafés de spécialité, pâtisseries artisanales, brunch et boissons signatures à Cocody, Abidjan.',
    url: '/carte',
    images: [
      {
        url: '/assets/examples/accueil/eba-hero.webp',
        width: 800,
        height: 449,
        alt: 'La carte EBA Coffee Shop',
      },
    ],
  },
};

async function CartePage() {
  const { menuPdfUrl } = await getMenuSettings();

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: 'La carte', path: '/carte' }]} />
      <CarteHeroSection menuPdfUrl={menuPdfUrl} />
      <Suspense fallback={<CarteMenuSkeleton />}>
        <CarteMenuSection />
      </Suspense>
      <CartFloatingButton />
      {menuPdfUrl && <DownloadMenuPdf pdfUrl={menuPdfUrl} />}
    </>
  );
}

export default CartePage;
