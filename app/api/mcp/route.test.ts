// app/api/mcp/route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// On mocke `auth` (provider OAuth) et `prisma` pour piloter le chemin OAuth
// sans base de données. `getMcpSession` décide si un jeton OAuth est valide,
// `user.findUnique` fournit le rôle de l'utilisateur derrière ce jeton.
// `vi.hoisted` : les mocks sont remontés au-dessus des imports avec leurs refs.
const { getMcpSession, userFindUnique } = vi.hoisted(() => ({
  getMcpSession: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: {
    options: { baseURL: 'http://localhost', basePath: '/api/auth' },
    api: { getMcpSession },
  },
}));

vi.mock('@/lib/prisma', () => ({
  default: { user: { findUnique: userFindUnique } },
}));

import { POST, GET } from './route';

const TOKEN = 'test-secret-token';

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const authHeader = { authorization: `Bearer ${TOKEN}` };

beforeEach(() => {
  vi.resetAllMocks();
  process.env.MCP_API_KEY = TOKEN;
  // Par défaut : aucun jeton OAuth reconnu (chemin OAuth → 401).
  getMcpSession.mockResolvedValue(null);
});

afterEach(() => {
  delete process.env.MCP_API_KEY;
});

describe('authentification — clé statique', () => {
  it('accepte la clé statique MCP_API_KEY (chemin propriétaire)', async () => {
    const res = await POST(
      makeRequest({ jsonrpc: '2.0', id: 1, method: 'ping' }, authHeader)
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toEqual({});
    // La clé statique court-circuite OAuth : pas d'appel à getMcpSession.
    expect(getMcpSession).not.toHaveBeenCalled();
  });
});

describe('authentification — OAuth', () => {
  it('renvoie 401 sans en-tête Authorization', async () => {
    const res = await POST(
      makeRequest({ jsonrpc: '2.0', id: 1, method: 'ping' })
    );
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toContain('Bearer');
  });

  it('renvoie 401 avec un jeton OAuth invalide', async () => {
    getMcpSession.mockResolvedValue(null);
    const res = await POST(
      makeRequest(
        { jsonrpc: '2.0', id: 1, method: 'ping' },
        { authorization: 'Bearer mauvais-jeton' }
      )
    );
    expect(res.status).toBe(401);
  });

  it('renvoie 401 même sans MCP_API_KEY configurée (plus de 503)', async () => {
    delete process.env.MCP_API_KEY;
    const res = await POST(
      makeRequest({ jsonrpc: '2.0', id: 1, method: 'ping' })
    );
    expect(res.status).toBe(401);
  });

  it('accepte un jeton OAuth d’un ADMIN', async () => {
    getMcpSession.mockResolvedValue({ userId: 'u1' });
    userFindUnique.mockResolvedValue({ role: 'ADMIN' });
    const res = await POST(
      makeRequest(
        { jsonrpc: '2.0', id: 1, method: 'ping' },
        { authorization: 'Bearer jeton-oauth-valide' }
      )
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toEqual({});
  });

  it('refuse (403) un jeton OAuth d’un non-ADMIN', async () => {
    getMcpSession.mockResolvedValue({ userId: 'u2' });
    userFindUnique.mockResolvedValue({ role: 'USER' });
    const res = await POST(
      makeRequest(
        { jsonrpc: '2.0', id: 1, method: 'ping' },
        { authorization: 'Bearer jeton-oauth-non-admin' }
      )
    );
    expect(res.status).toBe(403);
  });
});

describe('transport', () => {
  it('renvoie 400 sur un corps JSON invalide', async () => {
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader },
      body: 'pas du json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe(-32700);
  });

  it('renvoie 202 sans corps pour une notification', async () => {
    const res = await POST(
      makeRequest(
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        authHeader
      )
    );
    expect(res.status).toBe(202);
  });

  it('répond à initialize avec serverInfo', async () => {
    const res = await POST(
      makeRequest(
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
        authHeader
      )
    );
    const json = await res.json();
    expect(json.result.serverInfo.name).toBe('eba-coffee-menu');
  });

  it('traite un lot JSON-RPC et filtre les notifications', async () => {
    const res = await POST(
      makeRequest(
        [
          { jsonrpc: '2.0', id: 1, method: 'ping' },
          { jsonrpc: '2.0', method: 'notifications/initialized' },
          { jsonrpc: '2.0', id: 2, method: 'ping' },
        ],
        authHeader
      )
    );
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json).toHaveLength(2);
  });
});

describe('GET (flux SSE Streamable HTTP)', () => {
  function makeGet(headers: Record<string, string> = {}) {
    return new Request('http://localhost/api/mcp', { method: 'GET', headers });
  }

  it('ouvre un flux SSE avec la clé statique', async () => {
    const res = await GET(makeGet(authHeader));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    await res.body?.cancel();
  });

  it('renvoie 401 sans jeton (amorce la découverte OAuth)', async () => {
    getMcpSession.mockResolvedValue(null);
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toContain('Bearer');
  });

  it('ouvre un flux SSE pour un jeton OAuth ADMIN', async () => {
    getMcpSession.mockResolvedValue({ userId: 'u1' });
    userFindUnique.mockResolvedValue({ role: 'ADMIN' });
    const res = await GET(makeGet({ authorization: 'Bearer jeton-oauth' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    await res.body?.cancel();
  });

  it('refuse (403) un jeton OAuth non-ADMIN', async () => {
    getMcpSession.mockResolvedValue({ userId: 'u2' });
    userFindUnique.mockResolvedValue({ role: 'USER' });
    const res = await GET(makeGet({ authorization: 'Bearer jeton-oauth' }));
    expect(res.status).toBe(403);
  });
});
