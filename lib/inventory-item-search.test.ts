import { describe, expect, it } from 'vitest';

import type { SearchHit } from '@/lib/search/trgm';

import {
  compareForRestock,
  rankInventoryItems,
  suggestRestockQuantity,
  thresholdOf,
  urgencyRatio,
  type InventoryItemOption,
} from './inventory-item-search';

function item(
  over: Partial<InventoryItemOption> & { name: string }
): InventoryItemOption {
  return {
    id: over.name,
    sku: over.name.toUpperCase().replace(/\s/g, '-'),
    category: null,
    unit: 'UNIT',
    currentQuantity: 0,
    safetyStock: 0,
    reorderPoint: null,
    isLowStock: false,
    ...over,
  };
}

describe('thresholdOf', () => {
  it('donne la priorité au point de réappro', () => {
    expect(thresholdOf({ safetyStock: 5, reorderPoint: 12 })).toBe(12);
    expect(thresholdOf({ safetyStock: 5, reorderPoint: null })).toBe(5);
    // Un point de réappro à 0 est une valeur, pas une absence.
    expect(thresholdOf({ safetyStock: 5, reorderPoint: 0 })).toBe(0);
  });
});

describe('suggestRestockQuantity', () => {
  it('propose de quoi repasser au seuil', () => {
    expect(
      suggestRestockQuantity({
        currentQuantity: 2,
        safetyStock: 0,
        reorderPoint: 10,
      })
    ).toBe(8);
  });

  it('ne propose rien sans seuil', () => {
    // La grande majorité du catalogue réel est dans ce cas : proposer 0 serait
    // un mensonge présenté comme une suggestion.
    expect(
      suggestRestockQuantity({
        currentQuantity: 2,
        safetyStock: 0,
        reorderPoint: null,
      })
    ).toBeNull();
  });

  it('ne propose rien si le stock est déjà au-dessus', () => {
    expect(
      suggestRestockQuantity({
        currentQuantity: 20,
        safetyStock: 10,
        reorderPoint: null,
      })
    ).toBeNull();
  });

  it('garde trois décimales', () => {
    expect(
      suggestRestockQuantity({
        currentQuantity: 0.02,
        safetyStock: 0,
        reorderPoint: 0.4,
      })
    ).toBe(0.38);
  });
});

describe('urgencyRatio / compareForRestock', () => {
  it('place les références sous le seuil devant', () => {
    const low = item({
      name: 'Gobelet',
      isLowStock: true,
      safetyStock: 4,
      currentQuantity: 2,
    });
    const fine = item({ name: 'Alcool', isLowStock: false });
    expect([fine, low].sort(compareForRestock)[0]).toBe(low);
  });

  it('classe l’urgence en part du seuil, pas en quantité absolue', () => {
    // Il manque plus gravement 2 gobelets sur un seuil de 4 (50 %) que 8 tasses
    // sur un seuil de 100 (92 %).
    const gobelet = item({
      name: 'Gobelet',
      isLowStock: true,
      safetyStock: 4,
      currentQuantity: 2,
    });
    const tasse = item({
      name: 'Tasse',
      isLowStock: true,
      safetyStock: 100,
      currentQuantity: 92,
    });
    expect(urgencyRatio(gobelet)).toBeLessThan(urgencyRatio(tasse));
    expect([tasse, gobelet].sort(compareForRestock)[0]).toBe(gobelet);
  });

  it('départage à l’alphabet français', () => {
    const a = item({ name: 'Éponge' });
    const b = item({ name: 'Farine' });
    expect([b, a].sort(compareForRestock)[0]).toBe(a);
  });
});

describe('rankInventoryItems', () => {
  const items = [
    item({ name: 'Café Arabica', category: 'Café & thé' }),
    item({ name: 'Lait entier', category: 'Laitages' }),
    item({
      name: 'Gobelet 25 cl',
      category: 'Emballage',
      isLowStock: true,
      safetyStock: 50,
      currentQuantity: 5,
    }),
    item({ name: 'Farine T45', category: 'Épicerie' }),
  ];
  // Résultats de la base : l'id d'une référence est son nom.
  const hits = (...pairs: [string, number][]): SearchHit[] =>
    pairs.map(([id, score]) => ({ id, score }));

  it('renvoie tout le catalogue sur une requête vide, le manquant d’abord', () => {
    const ranked = rankInventoryItems(null, items, '');
    expect(ranked).toHaveLength(4);
    expect(ranked[0].name).toBe('Gobelet 25 cl');
  });

  it('ne garde que les références trouvées, meilleur score d’abord', () => {
    const ranked = rankInventoryItems(
      hits(['Lait entier', 0.7], ['Café Arabica', 1]),
      items,
      'a'
    );
    expect(ranked.map((i) => i.name)).toEqual(['Café Arabica', 'Lait entier']);
  });

  it('départage les scores équivalents par le métier (manquant d’abord)', () => {
    const ranked = rankInventoryItems(
      hits(['Café Arabica', 0.801], ['Gobelet 25 cl', 0.8]),
      items,
      'x'
    );
    expect(ranked[0].name).toBe('Gobelet 25 cl');
  });

  it('tant que la base n’a pas répondu, garde le catalogue entier', () => {
    expect(rankInventoryItems(null, items, 'gob')).toHaveLength(4);
  });

  it('ignore un résultat absent du catalogue chargé', () => {
    expect(rankInventoryItems(hits(['Inconnu', 1]), items, 'zzz')).toHaveLength(
      0
    );
  });

  it('respecte la limite demandée', () => {
    expect(rankInventoryItems(null, items, '', { limit: 2 })).toHaveLength(2);
  });
});
