// app/api/upload/route.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';
import sharp from 'sharp';

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

import { auth } from '@/lib/auth';
import { mkdir, writeFile } from 'node:fs/promises';
import { POST } from './route';

const mockGetSession = auth.api.getSession as MockedFunction<
  typeof auth.api.getSession
>;
const mockMkdir = mkdir as unknown as MockedFunction<typeof mkdir>;
const mockWriteFile = writeFile as unknown as MockedFunction<typeof writeFile>;

const adminSession = {
  user: { role: 'ADMIN', id: 'u1', email: 'admin@eba.ci' },
  session: {},
} as never;

/** Génère une vraie image décodable par sharp dans le format demandé. */
async function makeImage(
  format: 'jpeg' | 'png' | 'webp',
  size = 10
): Promise<Uint8Array> {
  const img = sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 120, g: 80, b: 200 },
    },
  });
  const buf =
    format === 'jpeg'
      ? await img.jpeg().toBuffer()
      : format === 'png'
        ? await img.png().toBuffer()
        : await img.webp().toBuffer();
  return new Uint8Array(buf);
}

function fileFrom(bytes: Uint8Array, name: string, type: string): File {
  return new File([bytes], name, { type });
}

function makeRequest(file: File): Request {
  const fd = new FormData();
  fd.append('file', file);
  return new Request('http://localhost/api/upload', {
    method: 'POST',
    body: fd,
  });
}

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  it('401 si pas de session', async () => {
    mockGetSession.mockResolvedValue(null);
    const file = fileFrom(
      new Uint8Array([0xff, 0xd8, 0xff]),
      'a.jpg',
      'image/jpeg'
    );
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(401);
  });

  it('401 si session USER', async () => {
    mockGetSession.mockResolvedValue({
      user: { role: 'USER', id: 'u1' },
      session: {},
    } as never);
    const file = fileFrom(
      new Uint8Array([0xff, 0xd8, 0xff]),
      'a.jpg',
      'image/jpeg'
    );
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
    const file = fileFrom(
      new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      'doc.pdf',
      'application/pdf'
    );
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(400);
  });

  it('400 si fichier > limite de taille', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    // 25 Mo + 1 octet : le contrôle de taille rejette avant tout décodage.
    const big = new Uint8Array(25 * 1024 * 1024 + 1);
    const file = fileFrom(big, 'big.jpg', 'image/jpeg');
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(400);
  });

  it('400 si contenu illisible (octets non décodables)', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    // MIME déclaré valide mais contenu non décodable par sharp.
    const file = fileFrom(
      new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01]),
      'fake.jpg',
      'image/jpeg'
    );
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(400);
  });

  it('200 + URL .webp pour un JPEG valide', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    const file = fileFrom(await makeImage('jpeg'), 'pic.jpg', 'image/jpeg');
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toMatch(
      /^\/uploads\/products\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/
    );
    expect(mockMkdir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('accepte PNG et WebP, toujours stockés en .webp', async () => {
    mockGetSession.mockResolvedValue(adminSession);

    const png = fileFrom(await makeImage('png'), 'a.png', 'image/png');
    const pngRes = await POST(makeRequest(png));
    expect(pngRes.status).toBe(200);
    expect((await pngRes.json()).url).toMatch(/\.webp$/);

    const webp = fileFrom(await makeImage('webp'), 'a.webp', 'image/webp');
    const webpRes = await POST(makeRequest(webp));
    expect(webpRes.status).toBe(200);
    expect((await webpRes.json()).url).toMatch(/\.webp$/);
  });

  it('redimensionne les grandes images et écrit du WebP', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    const file = fileFrom(
      await makeImage('jpeg', 4000),
      'large.jpg',
      'image/jpeg'
    );
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(200);

    // Le buffer réellement écrit est un WebP borné à 2200 px.
    const written = mockWriteFile.mock.calls[0][1] as Buffer;
    const meta = await sharp(written).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBeLessThanOrEqual(2200);
    expect(meta.height).toBeLessThanOrEqual(2200);
  });
});
