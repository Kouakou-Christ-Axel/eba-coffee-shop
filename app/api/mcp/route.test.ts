// app/api/mcp/route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
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
});

afterEach(() => {
  delete process.env.MCP_API_KEY;
});

describe('authentification', () => {
  it('renvoie 503 si MCP_API_KEY n’est pas configurée', async () => {
    delete process.env.MCP_API_KEY;
    const res = await POST(
      makeRequest({ jsonrpc: '2.0', id: 1, method: 'ping' })
    );
    expect(res.status).toBe(503);
  });

  it('renvoie 401 sans en-tête Authorization', async () => {
    const res = await POST(
      makeRequest({ jsonrpc: '2.0', id: 1, method: 'ping' })
    );
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toContain('Bearer');
  });

  it('renvoie 401 avec un jeton invalide', async () => {
    const res = await POST(
      makeRequest(
        { jsonrpc: '2.0', id: 1, method: 'ping' },
        { authorization: 'Bearer mauvais-jeton' }
      )
    );
    expect(res.status).toBe(401);
  });

  it('accepte un jeton valide', async () => {
    const res = await POST(
      makeRequest({ jsonrpc: '2.0', id: 1, method: 'ping' }, authHeader)
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toEqual({});
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

describe('GET', () => {
  it('renvoie 405 (pas de flux SSE serveur)', async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });
});
