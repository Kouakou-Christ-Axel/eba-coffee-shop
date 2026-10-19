import { describe, expect, it, vi } from 'vitest';
import { JekoApiError } from './client';
import { config, json } from './client.test-utils';
import {
  createJekoContact,
  createJekoTransfer,
  minTransferFcfa,
  toTransferMethod,
} from './transfers';

describe('createJekoContact', () => {
  it('crée un contact Mobile Money avec la méthode Jèko du contact', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ id: 'c1' }));

    await expect(
      createJekoContact(
        config,
        { name: 'Awa', method: 'orange', phoneE164: '+2250707070707' },
        fetchFn
      )
    ).resolves.toEqual({ id: 'c1' });

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.jeko.africa/partner_api/contacts');
    expect(init.headers).toMatchObject({
      'X-API-KEY': 'key',
      'X-API-KEY-ID': 'key-id',
    });
    expect(JSON.parse(init.body)).toEqual({
      name: 'Awa',
      paymentMethod: 'orange_money',
      identifier: { number: '+2250707070707' },
    });
  });
});

describe('createJekoTransfer', () => {
  const input = {
    contactId: 'c1',
    amountFcfa: 3450,
    reference: 'REMB-EBA-20261003-AB12-xyz',
    description: 'Remboursement',
  };

  it('envoie le montant en centimes et lit statut et frais', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      json({
        id: 'wth_1',
        status: 'pending',
        fees: { amount: 1200, currency: 'XOF' },
      })
    );

    await expect(createJekoTransfer(config, input, fetchFn)).resolves.toEqual({
      id: 'wth_1',
      status: 'pending',
      feeFcfa: 12,
    });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.jeko.africa/partner_api/transfers');
    expect(JSON.parse(init.body)).toEqual({
      storeId: config.storeId,
      contactId: 'c1',
      amountCents: 345_000,
      currency: 'XOF',
      reference: input.reference,
      description: 'Remboursement',
    });
  });

  it('remonte un 409 (référence déjà utilisée) en JekoApiError', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(json({ id: 'conflict', message: 'Existe' }, 409));

    await expect(createJekoTransfer(config, input, fetchFn)).rejects.toSatisfy(
      (e) => e instanceof JekoApiError && e.status === 409
    );
  });

  it('refuse un montant ou une référence invalides avant tout appel', async () => {
    const fetchFn = vi.fn();
    await expect(
      createJekoTransfer(config, { ...input, amountFcfa: 0 }, fetchFn)
    ).rejects.toThrow('Montant');
    await expect(
      createJekoTransfer(config, { ...input, reference: 'abc' }, fetchFn)
    ).rejects.toThrow('Référence');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('moyens de transfert', () => {
  it('minimum de 100 F chez Moov, 5 F ailleurs', () => {
    expect(minTransferFcfa('moov')).toBe(100);
    expect(minTransferFcfa('wave')).toBe(5);
  });

  it('refuse les moyens non remboursables (bank, jeko, inconnu)', () => {
    expect(toTransferMethod('wave')).toBe('wave');
    expect(toTransferMethod('bank')).toBeNull();
    expect(toTransferMethod(null)).toBeNull();
  });
});
