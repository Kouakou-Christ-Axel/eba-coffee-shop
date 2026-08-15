'use client';

// components/layouts/navbar-cart-button.tsx
//
// Indicateur de panier persistant dans la navbar : le panier vit dans le
// localStorage (lib/cart-store.ts) mais n'était visible que sur /carte via le
// bouton flottant. Un visiteur qui remplissait son panier puis naviguait vers
// l'accueil ou les sondages n'avait plus aucun rappel ni chemin de retour.
//
// Masqué sur /carte* : le bouton flottant (plus gros, mieux placé pour le
// pouce) y fait déjà le travail, et le checkout affiche le panier en entier.

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Button } from '@heroui/react';
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { useCartSummary } from '@/lib/hooks/use-cart-summary';
import { priceFormatter } from '@/config/menu';

// Même stratégie que cart-floating-button : le drawer tire HeroUI Modal + le
// menu (/api/menu) et l'upsell — hors du bundle de première peinture.
const CartDrawer = dynamic(
  () => import('@/components/(public)/carte/cart-drawer'),
  { ssr: false }
);

export default function NavbarCartButton() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const { totalItems, totalPrice } = useCartSummary();
  const [isOpen, setIsOpen] = useState(false);

  // Le bouton flottant de /carte et la page /carte/commande couvrent déjà le
  // panier : deux entrées simultanées seraient redondantes.
  if (pathname.startsWith('/carte')) return null;

  return (
    <>
      <AnimatePresence>
        {totalItems > 0 && (
          // `li` animé plutôt qu'un `NavbarItem` fixe contenant une `div` :
          // panier vide = aucun `<li>` dans la barre, donc pas de `gap`
          // orphelin, et l'entrée/sortie reste animée.
          <m.li
            className="box-border list-none"
            initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            {/* Compteur EN LIGNE plutôt qu'un `Badge` en surimpression : sur la
                variante large (avec le montant) la pastille se posait sur le
                texte. Même grammaire visuelle que le bouton flottant de /carte
                — icône · nombre · séparateur · montant. */}
            <Button
              radius="full"
              variant="flat"
              color="primary"
              size="sm"
              onPress={() => setIsOpen(true)}
              // Le libellé porte tout le contexte : sous `sm` le montant est
              // masqué visuellement mais reste annoncé ici.
              aria-label={`Voir le panier, ${totalItems} article${
                totalItems > 1 ? 's' : ''
              }, ${priceFormatter.format(totalPrice)} francs`}
              className="min-w-0 gap-1.5 px-3"
            >
              <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-sm font-semibold">{totalItems}</span>
              <span
                className="hidden h-3.5 w-px bg-primary/30 sm:block"
                aria-hidden
              />
              <span className="hidden text-sm font-semibold sm:inline">
                {priceFormatter.format(totalPrice)}&nbsp;F
              </span>
            </Button>
          </m.li>
        )}
      </AnimatePresence>

      <CartDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
