import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath }));

import { POST } from './route';

const call = (auth?: string) =>
  POST(
    new Request('http://localhost/api/cron/revalidate-public', {
      method: 'POST',
      headers: auth ? { authorization: auth } : {},
    })
  );

describe('POST /api/cron/revalidate-public', () => {
  beforeEach(() => revalidatePath.mockClear());
  afterEach(() => vi.unstubAllEnvs());

  it('est inerte (404) sans CRON_SECRET', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await call('Bearer x')).status).toBe(404);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('refuse un secret incorrect (401)', async () => {
    vi.stubEnv('CRON_SECRET', 'bon');
    expect((await call('Bearer mauvais')).status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('invalide les pages publiques avec le bon secret', async () => {
    vi.stubEnv('CRON_SECRET', 'bon');
    expect((await call('Bearer bon')).status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });
});
