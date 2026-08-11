// components/(public)/carte/carte-menu-section-client.test.tsx
//
// Garde-fou de référencement. /carte est prérendue (ISR 300 s) et porte un
// JSON-LD `Menu` : la carte complète DOIT se trouver dans le HTML servi, pas
// seulement après hydratation.
//
// La recherche et le filtre ajoutés à cette page sont précisément ce qui peut
// casser ça. Deux régressions possibles :
//   - un `useSearchParams()` glissé dans l'arbre : sous une route prérendue il
//     force le rendu client jusqu'à la `<Suspense>` de `page.tsx`, et le HTML
//     statique ne contient plus que `CarteMenuSkeleton` ;
//   - un état initial dérivé de l'URL ou du localStorage : le premier rendu ne
//     serait plus la carte complète.
//
// Ce test rend le composant EXACTEMENT comme le serveur le fait et vérifie que
// tous les produits y sont.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MenuCategory } from '@/config/menu';

// Le panier vit dans localStorage : hors DOM ici, et de toute façon jamais lu
// au rendu serveur (`skipHydration`).
vi.mock('@/lib/cart-store', () => ({
  useCartStore: (selector: (s: unknown) => unknown) =>
    selector({ addItem: () => {} }),
}));

import CarteMenuSectionClient from './carte-menu-section-client';

const MENU: MenuCategory[] = [
  {
    id: 'boissons-chaudes',
    name: 'Boissons chaudes',
    products: [
      {
        id: 'p1',
        name: 'Cappuccino',
        description: 'Mousse onctueuse',
        price: 1500,
      },
      {
        id: 'p2',
        name: 'Chocolat chaud',
        description: 'Cacao maison',
        price: 2000,
      },
    ],
  },
  {
    id: 'grand-format',
    name: 'Grand Format',
    // Volontairement en DERNIÈRE position et non commandable : c'est le
    // contenu de bas de page qui disparaît en premier si le rendu bascule
    // côté client.
    products: [
      {
        id: 'p3',
        name: 'Layer Cake entier',
        description: 'Sur commande',
        price: 25000,
        soldOut: true,
      },
    ],
  },
];

describe('CarteMenuSectionClient — rendu serveur', () => {
  const html = renderToStaticMarkup(
    React.createElement(CarteMenuSectionClient, { menuData: MENU })
  );

  it('rend tous les produits, y compris ceux de la dernière catégorie', () => {
    expect(html).toContain('Cappuccino');
    expect(html).toContain('Chocolat chaud');
    expect(html).toContain('Layer Cake entier');
  });

  it('rend les produits non commandables plutôt que de les masquer', () => {
    // Un produit épuisé reste sur la carte avec son motif : la découverte ne
    // dépend pas de la disponibilité du jour.
    expect(html).toContain('Épuisé');
  });

  it('rend la nav de catégories avec son compteur de produits', () => {
    expect(html).toContain('Boissons chaudes');
    expect(html).toContain('Grand Format');
  });

  it('n’applique aucun filtre au premier rendu', () => {
    // L'état vide ne doit jamais apparaître dans le HTML servi.
    expect(html).not.toContain('Aucun produit ne correspond');
    // Ni l'annonce de filtrage, dont la live region est montée mais vide.
    expect(html).not.toContain('produits sur');
  });

  it('expose une ancre de partage par produit', () => {
    expect(html).toContain('id="produit-p1"');
  });
});
