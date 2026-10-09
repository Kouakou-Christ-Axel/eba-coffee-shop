import { describe, it, expect, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth', async () => {
  const { getMcpSession } = await import('./route.test-mocks');
  return {
    auth: {
      options: { baseURL: 'http://localhost', basePath: '/api/auth' },
      api: { getMcpSession },
    },
  };
});

vi.mock('@/lib/prisma', async () => {
  const { userFindUnique } = await import('./route.test-mocks');
  return { default: { user: { findUnique: userFindUnique } } };
});

import { POST, GET } from './route';
import { READ_ONLY_TOOL_NAMES, TOOLSET_TOOL_NAMES } from '@/lib/mcp/tools';
import {
  getMcpSession,
  userFindUnique,
  makeRequest,
  authHeader,
  setupMcpRouteTests,
} from './route.test-mocks';

setupMcpRouteTests();

describe('filtrage par toolset (`?toolset=`)', () => {
  function toolsListRequest(toolset: string, headers: Record<string, string>) {
    return makeRequest(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      headers,
      `http://localhost/api/mcp?toolset=${toolset}`
    );
  }

  it('restreint à un seul domaine (clé statique)', async () => {
    const res = await POST(toolsListRequest('finance', authHeader));
    expect(res.status).toBe(200);
    const json = await res.json();
    const names = (json.result.tools as Array<{ name: string }>).map(
      (t) => t.name
    );
    expect(names).toContain('list_expenses');
    expect(names).not.toContain('get_menu');
    expect(names).not.toContain('create_order');
  });

  it('accepte plusieurs domaines séparés par des virgules (clé statique)', async () => {
    const res = await POST(toolsListRequest('finance,inventaire', authHeader));
    expect(res.status).toBe(200);
    const json = await res.json();
    const names = (json.result.tools as Array<{ name: string }>).map(
      (t) => t.name
    );
    expect(names).toContain('list_expenses');
    expect(names).toContain('list_inventory_items');
    expect(names).not.toContain('list_polls');
  });

  it('applique le filtre même sans restriction de rôle (clé statique = accès total)', async () => {
    const res = await POST(toolsListRequest('sondages', authHeader));
    expect(res.status).toBe(200);
    const json = await res.json();
    const names = (json.result.tools as Array<{ name: string }>).map(
      (t) => t.name
    );
    expect(new Set(names)).toEqual(TOOLSET_TOOL_NAMES.sondages);
  });

  it('renvoie 400 sur un toolset inconnu', async () => {
    const res = await POST(toolsListRequest('inconnu', authHeader));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe(-32602);
    expect(json.error.message).toContain('inconnu');
  });

  it('se compose par intersection avec le rôle COMPTABLE', async () => {
    getMcpSession.mockResolvedValue({ userId: 'u6' });
    userFindUnique.mockResolvedValue({ role: 'COMPTABLE' });
    const res = await POST(
      toolsListRequest('inventaire', {
        authorization: 'Bearer jeton-comptable',
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    const names = (json.result.tools as Array<{ name: string }>).map(
      (t) => t.name
    );
    // `list_inventory_items` est à la fois `scope: 'finance'` (rôle) et
    // `toolset: 'inventaire'` (domaine demandé) : passe l'intersection.
    expect(names).toContain('list_inventory_items');
    // `list_polls` est hors du domaine `inventaire` demandé.
    expect(names).not.toContain('list_polls');
    // `create_product` est hors des outils finance du rôle COMPTABLE.
    expect(names).not.toContain('create_product');
  });

  it('une intersection vide/réduite (rôle ANALYSTE) n’est pas une erreur', async () => {
    getMcpSession.mockResolvedValue({ userId: 'u7' });
    userFindUnique.mockResolvedValue({ role: 'ANALYSTE' });
    const res = await POST(
      toolsListRequest('finance', { authorization: 'Bearer jeton-analyste' })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    const names = (json.result.tools as Array<{ name: string }>).map(
      (t) => t.name
    );
    const expected = [...TOOLSET_TOOL_NAMES.finance].filter((n) =>
      READ_ONLY_TOOL_NAMES.has(n)
    );
    expect(new Set(names)).toEqual(new Set(expected));
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
