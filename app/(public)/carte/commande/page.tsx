// app/(public)/carte/commande/page.tsx
//
// Page plein écran de saisie des informations de retrait (mode, contact,
// créneau, note) — sortie de l'ancienne modal centrée (étape 2 de
// CartDrawer) pour plus de confort sur mobile. Le panier vit dans le store
// client (lib/cart-store.ts) ; cette page redirige vers /carte s'il est
// vide (navigation directe, refresh, ou commande déjà envoyée).

import type { Metadata } from 'next';
import { CheckoutPage } from '@/components/(public)/carte/checkout-page';

export const metadata: Metadata = {
  title: 'Finaliser ta commande — EBA Coffee Shop',
  robots: { index: false, follow: false },
};

export default function CarteCommandePage() {
  return <CheckoutPage />;
}
