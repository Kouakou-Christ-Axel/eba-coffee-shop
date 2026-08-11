'use client';

// components/(public)/carte/_components/product-deep-link.tsx
//
// Ouverture d'un produit précis depuis un lien `/carte?p=<id>` — l'autre moitié
// de `share-product-button.tsx`. Un lien partagé sur WhatsApp amène le
// destinataire directement sur le produit dont on lui a parlé, pas en haut
// d'une carte de 62 lignes.
//
// Le paramètre est lu via `window.location.search` dans un effet, JAMAIS via
// `useSearchParams()` : sous une route prérendue, ce hook force le rendu client
// de tout l'arbre jusqu'à la `<Suspense>` la plus proche — ici celle de
// `app/(public)/carte/page.tsx`. Le HTML statique de /carte ne contiendrait
// alors plus que le squelette, et les 62 produits sortiraient de l'index.

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { MenuCategory, Product } from '@/config/menu';
import { CARTE_SCROLL_OFFSET_PX } from '@/config/constants';

const SupplementModal = dynamic(
  () => import('@/components/(public)/carte/supplement-modal'),
  { ssr: false }
);

/** Ancre DOM d'une carte produit, partagée avec `carte-menu-section-client`. */
export function productAnchorId(productId: string): string {
  return `produit-${productId}`;
}

export function findProductById(
  menuData: MenuCategory[],
  productId: string
): Product | null {
  for (const category of menuData) {
    const found = category.products.find((p) => p.id === productId);
    if (found) return found;
  }
  return null;
}

export function ProductDeepLink({ menuData }: { menuData: MenuCategory[] }) {
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    const productId = new URLSearchParams(window.location.search).get('p');
    if (!productId) return;

    const found = findProductById(menuData, productId);
    if (!found) {
      // Produit retiré de la carte depuis l'envoi du lien : on nettoie l'URL et
      // on laisse le visiteur sur la carte plutôt que de lui montrer une erreur.
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    // Tout est différé d'une frame : les sections viennent d'être montées, leur
    // position n'est pas encore stable au moment de l'effet. Et le défilement
    // doit précéder l'ouverture — la modale HeroUI verrouille le scroll du
    // document, un saut déclenché après elle n'aboutirait pas.
    const frame = requestAnimationFrame(() => {
      const anchor = document.getElementById(productAnchorId(found.id));
      if (anchor) {
        const top =
          anchor.getBoundingClientRect().top +
          window.scrollY -
          CARTE_SCROLL_OFFSET_PX * 2;
        window.scrollTo({ top, behavior: 'auto' });
      }

      // Un produit sans groupe d'options n'a rien à configurer : la modale
      // n'aurait qu'un bouton « Ajouter ». On s'en tient au défilement, et
      // l'anneau de focus signale la carte visée.
      if ((found.supplements?.length ?? 0) === 0) {
        anchor?.focus({ preventScroll: true });
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }

      setProduct(found);
    });

    return () => cancelAnimationFrame(frame);
  }, [menuData]);

  function handleClose() {
    const anchorId = product ? productAnchorId(product.id) : null;
    setProduct(null);
    // Sans ce nettoyage, un rechargement rouvrirait la modale — et un lien
    // remis en circulation depuis la barre d'adresse resterait collant.
    window.history.replaceState(null, '', window.location.pathname);
    if (anchorId) document.getElementById(anchorId)?.focus();
  }

  if (!product) return null;

  return (
    <SupplementModal product={product} isOpen onClose={handleClose} />
  );
}
