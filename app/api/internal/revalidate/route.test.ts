// app/api/internal/revalidate/route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath }));

import { POST, WARMUP_PATHS } from './route';

const call = (auth?: string) =>
  POST(
    new Request('http://localhost/api/internal/revalidate', {
      method: 'POST',
      headers: auth ? { authorization: auth } : {},
    })
  );

beforeEach(() => revalidatePath.mockReset());
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/internal/revalidate', () => {
  it('est inerte (404) sans CRON_SECRET', async () => {
    const res = await call('Bearer x');
    expect(res.status).toBe(404);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('refuse un secret absent ou erroné (401)', async () => {
    vi.stubEnv('CRON_SECRET', 'secret-ok');
    expect((await call()).status).toBe(401);
    expect((await call('Bearer autre')).status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('invalide chaque page de réchauffage avec le bon secret', async () => {
    vi.stubEnv('CRON_SECRET', 'secret-ok');
    const res = await call('Bearer secret-ok');
    expect(res.status).toBe(200);
    expect(revalidatePath.mock.calls.map((c) => c[0])).toEqual([
      ...WARMUP_PATHS,
    ]);
  });
});
