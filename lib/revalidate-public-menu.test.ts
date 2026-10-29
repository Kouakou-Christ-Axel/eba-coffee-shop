// lib/revalidate-public-menu.test.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (p: string) => revalidatePath(p),
}));
vi.mock('next/server', () => ({ after: (cb: () => void) => cb() }));

import { OrderMutationError } from '@/lib/orders/mutations/errors';
import { revalidatesPublicMenu } from './revalidate-public-menu';

const paths = () => revalidatePath.mock.calls.map((c) => c[0]);

beforeEach(() => revalidatePath.mockClear());

describe('revalidatesPublicMenu', () => {
  it('invalide la carte après un succès et renvoie le résultat', async () => {
    const fn = revalidatesPublicMenu(async (n: number) => n * 2);
    expect(await fn(4)).toBe(8);
    expect(paths()).toEqual(['/api/menu', '/carte', '/']);
  });

  it("n'invalide pas quand `when` refuse", async () => {
    const fn = revalidatesPublicMenu(
      async (n: number) => n,
      (_args, r) => r > 1
    );
    await fn(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("n'invalide pas sur une erreur métier (rien n'a été écrit)", async () => {
    const fn = revalidatesPublicMenu(async () => {
      throw new OrderMutationError('Stock insuffisant', 409);
    });
    await expect(fn()).rejects.toBeInstanceOf(OrderMutationError);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('invalide par prudence sur une erreur inattendue (écriture partielle)', async () => {
    const fn = revalidatesPublicMenu(async () => {
      throw new Error('boom');
    });
    await expect(fn()).rejects.toThrow('boom');
    expect(paths()).toContain('/carte');
  });
});
