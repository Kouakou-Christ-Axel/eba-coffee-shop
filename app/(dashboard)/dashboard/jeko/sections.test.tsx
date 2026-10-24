// Rendu des sections de la page Jèko (composants purs) : garde-fou contre une
// erreur d'exécution et vérification des textes clés.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildJekoStats } from '@/lib/jeko/stats';
import { ConversionCard } from './conversion-card';
import { FeesTable } from './fees-table';
import { LimitBars } from './limit-bars';
import { PeriodKpis } from './period-kpis';

const stats = buildJekoStats({
  paid: [
    {
      paidAt: new Date('2026-10-02T09:00:00Z'),
      jekoAccount: 'A',
      total: 1000,
      onlineFee: 10,
      gatewayFee: 15,
      paymentAmountDue: 1010,
    },
  ],
  created: [
    { status: 'NEW', paymentTransactionId: 'tx' },
    { status: 'CANCELLED', paymentTransactionId: null },
  ],
  withdrawals: [],
  refunded: 0,
  from: '2026-10-01',
  to: '2026-10-31',
});

describe('LimitBars', () => {
  it('une barre par compte, alerte à partir de 90 % sur le compte actif', () => {
    const html = renderToStaticMarkup(
      <LimitBars
        active="A"
        rows={[
          { account: 'A', monthCollected: 1_900_000 },
          { account: 'B', monthCollected: 100_000 },
        ]}
      />
    );
    expect(html).toContain('Compte A');
    expect(html).toContain('Compte B');
    expect(html).toContain('95 %');
    expect(html).toContain('passez sur l’autre compte');
    expect(html).not.toContain('Proche du plafond : ne basculez pas');
  });

  it('plafond atteint', () => {
    const html = renderToStaticMarkup(
      <LimitBars
        active="B"
        rows={[{ account: 'A', monthCollected: 2_000_000 }]}
      />
    );
    expect(html).toContain('Plafond atteint');
    expect(html).toContain('100 %');
  });
});

describe('PeriodKpis / FeesTable / ConversionCard', () => {
  it('affichent les chiffres de la période', () => {
    const kpis = renderToStaticMarkup(<PeriodKpis totals={stats.totals} />);
    expect(kpis).toContain('Encaissé');
    expect(kpis).toMatch(/1[\s\u202f\u00a0]010 F/);

    const fees = renderToStaticMarkup(<FeesTable stats={stats} />);
    expect(fees).toContain('octobre 2026');

    const conversion = renderToStaticMarkup(
      <ConversionCard
        conversion={stats.conversion}
        averageBasket={stats.totals.averageBasket}
      />
    );
    expect(conversion).toContain('50 %');
  });

  it('plage vide : pas de tableau de frais, message de conversion', () => {
    const empty = buildJekoStats({
      paid: [],
      created: [],
      withdrawals: [],
      refunded: 0,
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(renderToStaticMarkup(<FeesTable stats={empty} />)).toBe('');
    expect(
      renderToStaticMarkup(
        <ConversionCard conversion={empty.conversion} averageBasket={0} />
      )
    ).toContain('Aucune commande en ligne');
  });
});
