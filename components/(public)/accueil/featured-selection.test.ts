// components/(public)/accueil/featured-selection.test.ts
//
// Règle de sélection de la vitrine éditoriale de l'accueil. Depuis que ses
// cartes proposent « Ajouter » au panier, y laisser passer un produit épuisé,
// en pause ou hors planning n'est plus une simple maladresse d'affichage : le
// client cliquerait sur une promesse qu'on ne peut pas tenir.

import { describe, it, expect } from 'vitest';
import type { MenuCategory, Product } from '@/config/menu';
import { selectFeaturedProducts } from './incontournables-section';
import { HOME_FEATURED_MAX_PRODUCTS } from '@/config/constants';
import { getAbidjanWeekday } from '@/lib/timezone';

// Un jour garanti différent d'aujourd'hui (Abidjan) — évite un test flaky
// selon le jour d'exécution.
const NOT_TODAY = [(getAbidjanWeekday() + 1) % 7];
const HOUR_MS = 60 * 60 * 1000;

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

describe('selectFeaturedProducts', () => {
  it('ne retient que les produits mis en avant au dashboard', () => {
    const result = selectFeaturedProducts(
      menuOf([
        product('vedette', { featured: true, featuredOrder: 1 }),
        product('ordinaire'),
        // Le rang de vente fait la vitrine de /carte, pas celle de l'accueil :
        // ici le discours est éditorial (« ce qu'on aime vous servir »).
        product('best-seller', { popularRank: 1 }),
      ])
    );

    expect(result.map((p) => p.id)).toEqual(['vedette']);
  });

  it('respecte featuredOrder', () => {
    const result = selectFeaturedProducts(
      menuOf([
        product('c', { featured: true, featuredOrder: 3 }),
        product('a', { featured: true, featuredOrder: 1 }),
        product('b', { featured: true, featuredOrder: 2 }),
      ])
    );

    expect(result.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('écarte les produits épuisés ou en pause', () => {
    const result = selectFeaturedProducts(
      menuOf([
        product('epuise', { featured: true, featuredOrder: 1, soldOut: true }),
        product('en-pause', {
          featured: true,
          featuredOrder: 2,
          unavailableUntil: new Date(Date.now() + HOUR_MS).toISOString(),
        }),
        product('dispo', { featured: true, featuredOrder: 3 }),
      ])
    );

    expect(result.map((p) => p.id)).toEqual(['dispo']);
  });

  it('écarte les produits hors planning hebdomadaire', () => {
    const result = selectFeaturedProducts(
      menuOf([
        product('autre-jour', {
          featured: true,
          featuredOrder: 1,
          availableDays: NOT_TODAY,
        }),
        product('aujourd-hui', { featured: true, featuredOrder: 2 }),
      ])
    );

    expect(result.map((p) => p.id)).toEqual(['aujourd-hui']);
  });

  it('écarte les spécialités hors de leur fenêtre', () => {
    const result = selectFeaturedProducts(
      menuOf([
        product('hors-fenetre', {
          featured: true,
          featuredOrder: 1,
          weeklySpecialPeriods: [
            { startDate: '2020-01-01', endDate: '2020-01-07' },
          ],
        }),
        product('sans-fenetre', { featured: true, featuredOrder: 2 }),
      ])
    );

    expect(result.map((p) => p.id)).toEqual(['sans-fenetre']);
  });

  it('reprend un produit dont la pause est terminée', () => {
    const result = selectFeaturedProducts(
      menuOf([
        product('pause-finie', {
          featured: true,
          featuredOrder: 1,
          unavailableUntil: new Date(Date.now() - HOUR_MS).toISOString(),
        }),
      ])
    );

    expect(result.map((p) => p.id)).toEqual(['pause-finie']);
  });

  it('borne la vitrine', () => {
    const many = Array.from(
      { length: HOME_FEATURED_MAX_PRODUCTS + 4 },
      (_, i) => product(`p${i}`, { featured: true, featuredOrder: i })
    );

    expect(selectFeaturedProducts(menuOf(many))).toHaveLength(
      HOME_FEATURED_MAX_PRODUCTS
    );
  });

  it('agrège les produits de toutes les catégories', () => {
    const result = selectFeaturedProducts([
      {
        id: 'boissons',
        name: 'Boissons',
        products: [product('cafe', { featured: true, featuredOrder: 2 })],
      },
      {
        id: 'patisseries',
        name: 'Pâtisseries',
        products: [product('cookie', { featured: true, featuredOrder: 1 })],
      },
    ]);

    expect(result.map((p) => p.id)).toEqual(['cookie', 'cafe']);
  });
});
