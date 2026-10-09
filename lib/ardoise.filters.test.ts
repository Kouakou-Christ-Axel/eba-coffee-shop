import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: { order: { findMany: vi.fn() } },
}));

import { fetchArdoise } from './ardoise';
import { mockFindMany, lastWhere, lastBranches } from './ardoise.test-utils';

describe('fetchArdoise — filtres envoyés à Prisma', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([] as never);
  });

  it('ne remonte que des commandes impayées', async () => {
    await fetchArdoise();

    expect(lastWhere().isPaid).toBe(false);
  });

  it('la dette ne retient que les commandes récupérées (COMPLETED)', async () => {
    // Une commande encore en cours n'est pas une dette : le client n'a rien
    // emporté, il ne doit rien.
    await fetchArdoise();

    const [debt] = lastBranches();
    expect(debt.status).toBe('COMPLETED');
  });

  it('la dette n’est bornée par aucune date (ni createdAt, ni dailyDate)', async () => {
    // Toute la raison d'être du module : `fetchCashierQueue` perdrait la dette
    // d'hier. Et une commande récupérée impayée du jour est une dette tout de
    // suite, pas demain — d'où l'absence totale de borne.
    await fetchArdoise();

    const [debt] = lastBranches();
    expect(debt).not.toHaveProperty('createdAt');
    expect(debt).not.toHaveProperty('dailyDate');
    expect(lastWhere()).not.toHaveProperty('createdAt');
    expect(lastWhere()).not.toHaveProperty('dailyDate');
  });

  it('n’accepte plus de borne « before » : une seule requête, aucun filtre de date racine', async () => {
    await fetchArdoise();

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(Object.keys(lastWhere()).sort()).toEqual(['OR', 'isPaid']);
  });

  it('les commandes annulées ne sont dans aucune des deux branches', async () => {
    await fetchArdoise();

    const [debt, toCheck] = lastBranches();
    expect(debt.status).toBe('COMPLETED');
    expect(toCheck.status).toEqual({ in: ['NEW', 'PREPARING', 'READY'] });
  });

  it('la branche « à vérifier » cible NEW/PREPARING/READY d’avant aujourd’hui', async () => {
    const before = new Date();
    await fetchArdoise();
    const after = new Date();

    const [, toCheck] = lastBranches();
    expect(toCheck.status).toEqual({ in: ['NEW', 'PREPARING', 'READY'] });

    const cutoff = (toCheck.createdAt as { lt: Date }).lt;
    // Minuit du jour courant : antérieur (ou égal) à maintenant, et pas plus
    // vieux que 24 h.
    expect(cutoff.getTime()).toBeLessThanOrEqual(before.getTime());
    expect(after.getTime() - cutoff.getTime()).toBeLessThan(
      25 * 60 * 60 * 1000
    );
  });

  it('ne filtre PAS sur isOnAccount par défaut, mais le fait sur demande', async () => {
    await fetchArdoise();
    expect(lastBranches()[0]).not.toHaveProperty('isOnAccount');

    await fetchArdoise({ onlyOnAccount: true });
    expect(lastBranches()[0].isOnAccount).toBe(true);
  });

  it('onlyOnAccount ne filtre QUE la dette, jamais les anomalies à vérifier', async () => {
    // Un retrait non pointé n'est par définition pas consenti : le masquer
    // viderait le garde-fou de son sens.
    await fetchArdoise({ onlyOnAccount: true });

    const [debt, toCheck] = lastBranches();
    expect(debt.isOnAccount).toBe(true);
    expect(toCheck).not.toHaveProperty('isOnAccount');
    expect(lastWhere()).not.toHaveProperty('isOnAccount');
  });
});
