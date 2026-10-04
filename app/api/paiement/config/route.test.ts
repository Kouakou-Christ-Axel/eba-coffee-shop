// app/api/paiement/config/route.test.ts
//
// GET /api/paiement/config — dit au checkout si le paiement en ligne est actif, à
// quel taux de frais et avec quels moyens. Lu côté CLIENT plutôt que passé en prop :
// la page de checkout est prérendue, un drapeau lu côté serveur serait figé au build
// et resterait faux après un simple changement de variable d'environnement.
// Aucun secret n'est exposé.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/jeko/config', () => ({
  jekoConfig: vi.fn(),
  onlineFeePercent: vi.fn(() => 1),
}));

import { jekoConfig, onlineFeePercent } from '@/lib/jeko/config';
import { GET } from './route';

describe('GET /api/paiement/config', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(onlineFeePercent).mockReturnValue(1);
  });

  it('actif : taux de frais et moyens proposés', async () => {
    vi.mocked(jekoConfig).mockReturnValue({
      apiKey: 'k',
      apiKeyId: 'i',
      storeId: 's',
    });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      enabled: true,
      feePercent: 1,
      methods: ['wave', 'orange', 'mtn', 'moov', 'djamo'],
    });
  });

  it('inerte : aucune méthode, aucun frais', async () => {
    vi.mocked(jekoConfig).mockReturnValue(null);

    expect(await (await GET()).json()).toEqual({
      enabled: false,
      feePercent: 0,
      methods: [],
    });
  });

  it('ne se met jamais en cache (la config peut changer sans rebuild)', async () => {
    vi.mocked(jekoConfig).mockReturnValue(null);
    expect((await GET()).headers.get('Cache-Control')).toBe('no-store');
  });

  it("n'expose aucune clé ni aucun identifiant du fournisseur", async () => {
    vi.mocked(jekoConfig).mockReturnValue({
      apiKey: 'SECRET-KEY',
      apiKeyId: 'SECRET-ID',
      storeId: 'SECRET-STORE',
    });

    const text = JSON.stringify(await (await GET()).json());

    expect(text).not.toContain('SECRET');
  });
});
