// components/(public)/carte/_components/showcase-selection.test.ts
//
// Règles de sélection des deux surfaces de mise en avant : la vitrine en tête
// de carte et la vente additionnelle du panier. Ce sont elles qui décident ce
// qu'on pousse au client — un produit épuisé mis en avant est une promesse
// qu'on ne peut pas tenir.

import { describe, it, expect } from 'vitest';
import type { MenuCategory, Product } from '@/config/menu';
import { selectShowcaseProducts } from '../featured-showcase';
import { selectUpsellProducts } from './cart-upsell';
import { SHOWCASE_MAX_PRODUCTS, UPSELL_MAX_PRODUCTS } from '@/config/constants';

function product(id: string, extra: Partial<Product> = {}): Product {
  return {
    id,
    name: id,
    description: `Description ${id}`,
    price: 1000,
    ...extra,
  };
}

function menuOf(products: Product[]): MenuCategory[] {
  return [{ id: 'cat', name: 'Catégorie', products }];
}

const HOUR_MS = 60 * 60 * 1000;

describe('selectShowcaseProducts', () => {
  it('classe les produits par rang de vente avant les mises en avant éditoriales', () => {
    const result = selectShowcaseProducts(
      menuOf([
        product('editorial', { featured: true, featuredOrder: 1 }),
        product('second', { popularRank: 2 }),
        product('premier', { popularRank: 1 }),
      ])
    );

    expect(result.map((p) => p.id)).toEqual(['premier', 'second', 'editorial']);
  });

  it('respecte featuredOrder entre produits éditoriaux', () => {
    const result = selectShowcaseProducts(
      menuOf([
        product('b', { featured: true, featuredOrder: 2 }),
        product('a', { featured: true, featuredOrder: 1 }),
      ])
    );

    expect(result.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('écarte les produits épuisés ou en pause', () => {
    const result = selectShowcaseProducts(
      menuOf([
        product('epuise', { popularRank: 1, soldOut: true }),
        product('en-pause', {
          popularRank: 2,
          unavailableUntil: new Date(Date.now() + HOUR_MS).toISOString(),
        }),
        product('dispo', { popularRank: 3 }),
      ])
    );

    expect(result.map((p) => p.id)).toEqual(['dispo']);
  });

  it('reprend un produit dont la pause est terminée', () => {
    const result = selectShowcaseProducts(
      menuOf([
        product('pause-finie', {
          popularRank: 1,
          unavailableUntil: new Date(Date.now() - HOUR_MS).toISOString(),
        }),
      ])
    );

    expect(result.map((p) => p.id)).toEqual(['pause-finie']);
  });

  it('ignore les produits ni classés ni mis en avant', () => {
    expect(selectShowcaseProducts(menuOf([product('quelconque')]))).toEqual([]);
  });

  it('borne la vitrine', () => {
    const many = Array.from({ length: SHOWCASE_MAX_PRODUCTS + 5 }, (_, i) =>
      product(`p${i}`, { featured: true, featuredOrder: i })
    );

    expect(selectShowcaseProducts(menuOf(many))).toHaveLength(
      SHOWCASE_MAX_PRODUCTS
    );
  });
});

describe('selectUpsellProducts', () => {
  it('ne repropose pas ce qui est déjà dans le panier', () => {
    const result = selectUpsellProducts(
      menuOf([
        product('deja-pris', { popularRank: 1 }),
        product('a-proposer', { popularRank: 2 }),
      ]),
      ['deja-pris']
    );

    expect(result.map((p) => p.id)).toEqual(['a-proposer']);
  });

  it('écarte les produits épuisés ou en pause', () => {
    const result = selectUpsellProducts(
      menuOf([
        product('epuise', { featured: true, soldOut: true }),
        product('en-pause', {
          featured: true,
          unavailableUntil: new Date(Date.now() + HOUR_MS).toISOString(),
        }),
        product('dispo', { featured: true }),
      ]),
      []
    );

    expect(result.map((p) => p.id)).toEqual(['dispo']);
  });

  it('fait passer les produits classés devant les éditoriaux', () => {
    const result = selectUpsellProducts(
      menuOf([
        product('editorial', { featured: true, featuredOrder: 1 }),
        product('classe', { popularRank: 3 }),
      ]),
      []
    );

    expect(result.map((p) => p.id)).toEqual(['classe', 'editorial']);
  });

  it('borne les suggestions', () => {
    const many = Array.from({ length: UPSELL_MAX_PRODUCTS + 5 }, (_, i) =>
      product(`p${i}`, { featured: true, featuredOrder: i })
    );

    expect(selectUpsellProducts(menuOf(many), [])).toHaveLength(
      UPSELL_MAX_PRODUCTS
    );
  });

  it('ne propose rien quand le menu n’a aucune mise en avant', () => {
    expect(selectUpsellProducts(menuOf([product('quelconque')]), [])).toEqual(
      []
    );
  });
});
