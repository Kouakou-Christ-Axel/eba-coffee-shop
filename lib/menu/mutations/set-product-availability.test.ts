import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUnique = vi.fn();
const update = vi.fn();
vi.mock('@/lib/prisma', () => ({
  default: {
    product: {
      findUnique: (a: unknown) => findUnique(a),
      update: (a: unknown) => update(a),
    },
  },
}));

import { setProductAvailability } from './products';

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset();
});

describe('setProductAvailability', () => {
  it('fixe la valeur demandée, quel que soit l’état actuel (idempotent)', async () => {
    findUnique.mockResolvedValue({ id: 'p1', available: false });
    await setProductAvailability('p1', false);
    await setProductAvailability('p1', false);
    expect(update).toHaveBeenCalledTimes(2);
    for (const [arg] of update.mock.calls) {
      expect(arg).toEqual({ where: { id: 'p1' }, data: { available: false } });
    }
  });

  it('refuse un produit inconnu', async () => {
    findUnique.mockResolvedValue(null);
    await expect(setProductAvailability('nope', true)).rejects.toThrow(
      'Produit introuvable'
    );
    expect(update).not.toHaveBeenCalled();
  });
});
