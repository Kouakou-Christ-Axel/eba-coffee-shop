import { afterEach, beforeEach, vi } from 'vitest';

export const getMcpSession = vi.fn();
export const userFindUnique = vi.fn();

export const TOKEN = 'test-secret-token';

export function makeRequest(
  body: unknown,
  headers: Record<string, string> = {},
  url = 'http://localhost/api/mcp'
) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

export const authHeader = { authorization: `Bearer ${TOKEN}` };

export function setupMcpRouteTests() {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.MCP_API_KEY = TOKEN;
    // Par défaut : aucun jeton OAuth reconnu (chemin OAuth → 401).
    getMcpSession.mockResolvedValue(null);
  });

  afterEach(() => {
    delete process.env.MCP_API_KEY;
  });
}
