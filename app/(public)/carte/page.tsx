// app/(public)/carte/page.tsx
import type { Metadata } from 'next';
import CarteHeroSection from '@/components/(public)/carte/carte-hero-section';
import CarteMenuSection from '@/components/(public)/carte/carte-menu-section';
import CartFloatingButton from '@/components/(public)/carte/cart-floating-button';

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
};

function CartePage() {
  return (
    <>
      <CarteHeroSection />
      <CarteMenuSection />
      <CartFloatingButton />
    </>
  );
}

export default CartePage;
