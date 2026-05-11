// app/api/upload/route.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { put } from '@vercel/blob';
import { POST } from './route';

const mockGetSession = auth.api.getSession as MockedFunction<
  typeof auth.api.getSession
>;
const mockPut = put as MockedFunction<typeof put>;

const adminSession = {
  user: { role: 'ADMIN', id: 'u1', email: 'admin@eba.ci' },
  session: {},
} as never;

function makeRequest(file: File): Request {
  const fd = new FormData();
  fd.append('file', file);
  return new Request('http://localhost/api/upload', {
    method: 'POST',
    body: fd,
  });
}

describe('POST /api/upload', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 si pas de session', async () => {
    mockGetSession.mockResolvedValue(null);
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'a.jpg', {
      type: 'image/jpeg',
    });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(401);
  });

  it('401 si session USER', async () => {
    mockGetSession.mockResolvedValue({
      user: { role: 'USER', id: 'u1' },
      session: {},
    } as never);
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'a.jpg', {
      type: 'image/jpeg',
    });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(401);
  });

  it('400 si pas de fichier', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    const fd = new FormData();
    const req = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: fd,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('400 si MIME non supporté (PDF)', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    const file = new File(
      [new Uint8Array([0x25, 0x50, 0x44, 0x46])],
      'doc.pdf',
      {
        type: 'application/pdf',
      }
    );
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(400);
  });

  it('400 si fichier > 5 MB', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    const file = new File([big], 'big.jpg', { type: 'image/jpeg' });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(400);
  });

  it('200 + URL pour JPEG valide', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockPut.mockResolvedValue({
      url: 'https://blob.vercel.com/abc.jpg',
    } as never);

    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'pic.jpg', {
      type: 'image/jpeg',
    });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe('https://blob.vercel.com/abc.jpg');
    expect(mockPut).toHaveBeenCalled();
  });

  it('accepte PNG et WebP', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockPut.mockResolvedValue({ url: 'https://blob.vercel.com/x' } as never);

    const png = new File([new Uint8Array([0x89, 0x50])], 'a.png', {
      type: 'image/png',
    });
    expect((await POST(makeRequest(png))).status).toBe(200);

    const webp = new File([new Uint8Array([0x52])], 'a.webp', {
      type: 'image/webp',
    });
    expect((await POST(makeRequest(webp))).status).toBe(200);
  });
});
