import { describe, expect, it, vi } from 'vitest';
import { createJekoPaymentRequest, getJekoPaymentRequest } from './client';
import { config, input, json } from './client.test-utils';

describe('URL de base configurable', () => {
  it('cible le serveur indiqué par la config (serveur factice en local)', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        json({ id: 'pr_1', status: 'pending', redirectUrl: 'http://x/pay' })
      );
    const local = { ...config, baseUrl: 'http://localhost:4010' };

    await createJekoPaymentRequest(local, input, fetchFn);
    await getJekoPaymentRequest(local, 'pr_1', fetchFn);

    expect(fetchFn.mock.calls[0][0]).toBe(
      'http://localhost:4010/partner_api/payment_requests'
    );
    expect(fetchFn.mock.calls[1][0]).toBe(
      'http://localhost:4010/partner_api/payment_requests/pr_1'
    );
  });

  it('ignore un slash final dans la config', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(json({ id: 'pr_1', status: 'pending' }));

    await getJekoPaymentRequest(
      { ...config, baseUrl: 'http://localhost:4010/' },
      'pr_1',
      fetchFn
    );

    expect(fetchFn.mock.calls[0][0]).toBe(
      'http://localhost:4010/partner_api/payment_requests/pr_1'
    );
  });
});

describe('pannes réseau', () => {
  it('convertit un échec réseau en JekoApiError identifiable (création)', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      createJekoPaymentRequest(config, input, fetchFn)
    ).rejects.toMatchObject({
      name: 'JekoApiError',
      status: 503,
      code: 'network_error',
    });
  });

  it('convertit un échec réseau en JekoApiError identifiable (lecture)', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      getJekoPaymentRequest(config, 'pr_1', fetchFn)
    ).rejects.toMatchObject({ name: 'JekoApiError', code: 'network_error' });
  });

  it('convertit un dépassement de délai en JekoApiError « timeout »', async () => {
    const timeout = new DOMException('The operation timed out', 'TimeoutError');
    const fetchFn = vi.fn().mockRejectedValue(timeout);

    await expect(
      createJekoPaymentRequest(config, input, fetchFn)
    ).rejects.toMatchObject({ status: 504, code: 'timeout' });
  });

  it('borne chaque appel par un délai (un Jèko qui ne répond pas ne bloque pas la page)', async () => {
    const fetchFn = vi.fn(async () =>
      json({ id: 'pr_1', status: 'pending', redirectUrl: 'https://x/pay' })
    );

    await createJekoPaymentRequest(config, input, fetchFn);
    await getJekoPaymentRequest(config, 'pr_1', fetchFn);

    for (const [, init] of fetchFn.mock.calls) {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });
});
