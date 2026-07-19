import { describe, expect, it } from 'vitest';
import {
  buildArticleAnalytics,
  type ArticleAnalyticsLine,
} from './expense-article-analytics';

const line = (
  date: string,
  amount: number,
  qtyBase: number | null,
  supplier: string | null = null
): ArticleAnalyticsLine => ({ date, amount, qtyBase, supplier });

describe('buildArticleAnalytics', () => {
  it('gère un historique vide', () => {
    const a = buildArticleAnalytics([], '2026-07-19');
    expect(a.pricePoints).toEqual([]);
    expect(a.avgUnitPrice).toBeNull();
    expect(a.avgIntervalDays).toBeNull();
    expect(a.daysSinceLast).toBeNull();
    expect(a.dueInDays).toBeNull();
    expect(a.lineCount).toBe(0);
    expect(a.missingQtyCount).toBe(0);
  });

  it('calcule le prix unitaire (amount/qtyBase) trié chronologiquement', () => {
    // Fourni en désordre → doit ressortir trié.
    const a = buildArticleAnalytics(
      [line('2026-03-10', 5200, 10), line('2026-01-05', 4500, 10)],
      '2026-07-19'
    );
    expect(a.pricePoints).toEqual([
      { date: '2026-01-05', unitPrice: 450 },
      { date: '2026-03-10', unitPrice: 520 },
    ]);
    expect(a.firstUnitPrice).toBe(450);
    expect(a.lastUnitPrice).toBe(520);
    expect(a.minUnitPrice).toBe(450);
    expect(a.maxUnitPrice).toBe(520);
    // (520-450)/450 ≈ 15.56 % → 16 %
    expect(a.priceChangePct).toBe(16);
  });

  it('pondère le prix moyen par la quantité', () => {
    const a = buildArticleAnalytics(
      [line('2026-01-01', 1000, 10), line('2026-02-01', 3000, 20)],
      '2026-07-19'
    );
    // (1000 + 3000) / (10 + 20) = 133.3 → 133
    expect(a.avgUnitPrice).toBe(133);
  });

  it('exclut les lignes sans quantité des prix mais les compte', () => {
    const a = buildArticleAnalytics(
      [line('2026-01-01', 1000, 10), line('2026-02-01', 900, null)],
      '2026-07-19'
    );
    expect(a.pricePoints).toHaveLength(1);
    expect(a.missingQtyCount).toBe(1);
    // Le montant sans qté reste compté dans le cumul mensuel.
    expect(a.monthly.find((m) => m.month === '2026-02')?.amount).toBe(900);
  });

  it('agrège montant et quantité par mois', () => {
    const a = buildArticleAnalytics(
      [
        line('2026-01-05', 1000, 5),
        line('2026-01-20', 2000, 10),
        line('2026-02-02', 1500, 7),
      ],
      '2026-07-19'
    );
    expect(a.monthly).toEqual([
      { month: '2026-01', amount: 3000, qty: 15 },
      { month: '2026-02', amount: 1500, qty: 7 },
    ]);
  });

  it('regroupe le prix par fournisseur (trié par nombre d’achats)', () => {
    const a = buildArticleAnalytics(
      [
        line('2026-01-01', 1000, 10, 'Alpha'),
        line('2026-02-01', 1100, 10, 'Alpha'),
        line('2026-03-01', 900, 10, 'Beta'),
      ],
      '2026-07-19'
    );
    expect(a.bySupplier).toEqual([
      { supplier: 'Alpha', avgUnitPrice: 105, count: 2 },
      { supplier: 'Beta', avgUnitPrice: 90, count: 1 },
    ]);
  });

  it('étiquette les fournisseurs vides « Inconnu »', () => {
    const a = buildArticleAnalytics(
      [line('2026-01-01', 1000, 10, null), line('2026-02-01', 1000, 10, '  ')],
      '2026-07-19'
    );
    expect(a.bySupplier).toEqual([
      { supplier: 'Inconnu', avgUnitPrice: 100, count: 2 },
    ]);
  });

  it('calcule cadence, jours écoulés et réappro estimé', () => {
    // 3 achats espacés de 30 j → intervalle moyen 30 j.
    const a = buildArticleAnalytics(
      [
        line('2026-05-01', 1000, 10),
        line('2026-05-31', 1000, 10),
        line('2026-06-30', 1000, 10),
      ],
      '2026-07-10'
    );
    expect(a.avgIntervalDays).toBe(30);
    // du 30/06 au 10/07 = 10 jours.
    expect(a.daysSinceLast).toBe(10);
    // 30 - 10 = 20 jours avant le prochain achat estimé.
    expect(a.dueInDays).toBe(20);
  });

  it('dueInDays négatif quand le réappro est en retard', () => {
    const a = buildArticleAnalytics(
      [line('2026-05-01', 1000, 10), line('2026-05-11', 1000, 10)],
      '2026-07-10'
    );
    // intervalle 10 j, dernier achat il y a 60 j → 10 - 60 = -50 (en retard).
    expect(a.avgIntervalDays).toBe(10);
    expect(a.dueInDays).toBe(-50);
  });

  it('déduplique les dates d’achat pour la cadence', () => {
    // Deux lignes le même jour ne comptent que pour une date.
    const a = buildArticleAnalytics(
      [
        line('2026-06-01', 500, 5),
        line('2026-06-01', 500, 5),
        line('2026-07-01', 1000, 10),
      ],
      '2026-07-05'
    );
    // 2 dates distinctes espacées de 30 j.
    expect(a.avgIntervalDays).toBe(30);
  });
});
