import { describe, expect, it } from 'vitest';
import {
  isProductSoldOut,
  productHasOptions,
  productNeedsPicker,
  searchProducts,
} from './catalog';
import type { MenuCategory, Product, SupplementGroup } from '@/config/menu';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Café allongé',
    description: '',
    price: 1000,
    ...overrides,
  };
}

function group(overrides: Partial<SupplementGroup> = {}): SupplementGroup {
  return {
    name: 'Extras',
    type: 'multiple',
    required: false,
    options: [{ name: 'Chantilly', price: 200 }],
    ...overrides,
  };
}

describe('productNeedsPicker', () => {
  it('renvoie false sans aucun supplément', () => {
    expect(productNeedsPicker(makeProduct())).toBe(false);
  });

  it("renvoie false quand le produit n'a que des extras GLOBAUX optionnels", () => {
    // Le cas qui cassait le tap-unique : getMenu() colle les extras globaux
    // sur tous les produits, donc « supplements.length > 0 » était toujours vrai.
    const product = makeProduct({
      supplements: [group({ isGlobal: true, required: false })],
    });
    expect(productNeedsPicker(product)).toBe(false);
  });

  it('renvoie true pour un groupe propre au produit', () => {
    const product = makeProduct({
      supplements: [group({ name: 'Taille', isGlobal: false })],
    });
    expect(productNeedsPicker(product)).toBe(true);
  });

  it('renvoie true pour un groupe global REQUIS', () => {
    const product = makeProduct({
      supplements: [group({ isGlobal: true, required: true })],
    });
    expect(productNeedsPicker(product)).toBe(true);
  });

  it('renvoie true dès quun seul groupe impose un choix', () => {
    const product = makeProduct({
      supplements: [
        group({ isGlobal: true, required: false }),
        group({ name: 'Taille', isGlobal: false }),
      ],
    });
    expect(productNeedsPicker(product)).toBe(true);
  });
});

describe('productHasOptions', () => {
  it('distingue « aucune option » de « options globales seulement »', () => {
    expect(productHasOptions(makeProduct())).toBe(false);
    expect(
      productHasOptions(
        makeProduct({ supplements: [group({ isGlobal: true })] })
      )
    ).toBe(true);
  });
});

describe('isProductSoldOut', () => {
  it('traite un stock absent ou null comme illimité', () => {
    expect(isProductSoldOut(makeProduct())).toBe(false);
    expect(isProductSoldOut(makeProduct({ stockQuantity: null }))).toBe(false);
    expect(isProductSoldOut(makeProduct({ remaining: null }))).toBe(false);
  });

  it('suit le drapeau soldOut de getMenu()', () => {
    expect(isProductSoldOut(makeProduct({ soldOut: true }))).toBe(true);
  });

  it('retombe sur remaining puis stockQuantity', () => {
    expect(isProductSoldOut(makeProduct({ remaining: 0 }))).toBe(true);
    expect(isProductSoldOut(makeProduct({ remaining: 3 }))).toBe(false);
    expect(isProductSoldOut(makeProduct({ stockQuantity: 0 }))).toBe(true);
  });
});

describe('searchProducts', () => {
  const menu: MenuCategory[] = [
    {
      id: 'boissons',
      name: 'Boissons chaudes',
      products: [
        makeProduct({ id: 'a', name: 'Crème brûlée latte' }),
        makeProduct({ id: 'b', name: 'Chocolat chaud' }),
      ],
    },
    {
      id: 'patisseries',
      name: 'Pâtisseries',
      products: [
        makeProduct({
          id: 'c',
          name: 'Crêpe sucrée',
          description: 'Au chocolat',
        }),
      ],
    },
  ];

  it('renvoie null sur un terme vide ou trop court (afficher les onglets normaux)', () => {
    expect(searchProducts(menu, '')).toBeNull();
    expect(searchProducts(menu, '   ')).toBeNull();
    // Seuil partagé avec la carte publique (CARTE_SEARCH_MIN_CHARS = 2) : une
    // seule lettre ne doit pas remplacer le catalogue par une liste au hasard.
    expect(searchProducts(menu, 'c')).toBeNull();
  });

  it('cherche aussi dans le nom de la catégorie', () => {
    // Hérité du moteur de la carte publique : « boissons » ramène la catégorie
    // entière plutôt que rien.
    expect(searchProducts(menu, 'boissons')?.map((h) => h.product.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('ignore les accents et la casse', () => {
    const hits = searchProducts(menu, 'CREME');
    expect(hits?.map((h) => h.product.id)).toEqual(['a']);
  });

  it('cherche dans toutes les catégories à la fois', () => {
    const hits = searchProducts(menu, 'chocolat');
    expect(hits?.map((h) => h.product.id)).toEqual(['b', 'c']);
  });

  it('exige que tous les mots correspondent', () => {
    expect(
      searchProducts(menu, 'choco chaud')?.map((h) => h.product.id)
    ).toEqual(['b']);
    expect(searchProducts(menu, 'chocolat introuvable')).toEqual([]);
  });

  it('remonte la catégorie dorigine pour situer le résultat', () => {
    expect(searchProducts(menu, 'crepe')?.[0]?.categoryName).toBe(
      'Pâtisseries'
    );
  });
});
