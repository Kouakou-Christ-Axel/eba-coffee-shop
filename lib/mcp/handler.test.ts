// lib/mcp/handler.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';

vi.mock('@/lib/menu', () => ({
  getMenuAdmin: vi.fn(),
}));

vi.mock('@/lib/menu-mutations', async () => {
  // On garde les vrais schémas Zod (validation) et on ne mocke que les mutations
  // (effets de bord en base).
  const actual = await vi.importActual<typeof import('@/lib/menu-mutations')>(
    '@/lib/menu-mutations'
  );
  return {
    ...actual,
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    toggleCategoryAvailability: vi.fn(),
    moveCategory: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn(),
    toggleProductAvailability: vi.fn(),
    toggleProductFeatured: vi.fn(),
  };
});

import { getMenuAdmin } from '@/lib/menu';
import { createCategory, createProduct } from '@/lib/menu-mutations';
import { handleRpc, SERVER_INFO } from './handler';
import { FINANCE_TOOL_NAMES } from './tools';

const mockGetMenuAdmin = getMenuAdmin as MockedFunction<typeof getMenuAdmin>;
const mockCreateCategory = createCategory as MockedFunction<
  typeof createCategory
>;
const mockCreateProduct = createProduct as MockedFunction<typeof createProduct>;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('initialize', () => {
  it('renvoie serverInfo et les capacités tools', async () => {
    const res = await handleRpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {} },
    });
    expect(res).not.toBeNull();
    const result = res!.result as {
      protocolVersion: string;
      serverInfo: { name: string };
      capabilities: { tools: unknown };
    };
    expect(result.protocolVersion).toBe('2025-06-18');
    expect(result.serverInfo.name).toBe(SERVER_INFO.name);
    expect(result.capabilities.tools).toBeDefined();
  });

  it('retombe sur la version par défaut si le client en demande une inconnue', async () => {
    const res = await handleRpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '1999-01-01' },
    });
    const result = res!.result as { protocolVersion: string };
    expect(result.protocolVersion).toBe('2025-06-18');
  });
});

describe('notifications', () => {
  it('notifications/initialized ne renvoie aucune réponse', async () => {
    const res = await handleRpc({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    expect(res).toBeNull();
  });
});

describe('ping', () => {
  it('répond un résultat vide', async () => {
    const res = await handleRpc({ jsonrpc: '2.0', id: 7, method: 'ping' });
    expect(res!.result).toEqual({});
  });
});

describe('tools/list', () => {
  it('liste tous les outils avec un inputSchema JSON Schema', async () => {
    const res = await handleRpc({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    });
    const { tools } = res!.result as {
      tools: Array<{
        name: string;
        inputSchema: { type?: string };
        annotations: { readOnlyHint: boolean };
      }>;
    };
    const names = tools.map((t) => t.name);
    expect(names).toContain('get_menu');
    expect(names).toContain('create_product');
    expect(names).toContain('delete_category');
    // get_menu est en lecture seule
    const getMenu = tools.find((t) => t.name === 'get_menu')!;
    expect(getMenu.annotations.readOnlyHint).toBe(true);
    expect(getMenu.inputSchema.type).toBe('object');
  });

  it('restreint la liste aux `allowedTools` (rôle COMPTABLE)', async () => {
    const res = await handleRpc(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { allowedTools: FINANCE_TOOL_NAMES }
    );
    const { tools } = res!.result as { tools: Array<{ name: string }> };
    const names = tools.map((t) => t.name);
    expect(names).toContain('list_expenses');
    expect(names).toContain('get_daily_stats');
    expect(names).not.toContain('get_menu');
    expect(names).not.toContain('create_product');
  });
});

describe('tools/call — lecture', () => {
  it('get_menu renvoie le menu en contenu texte', async () => {
    mockGetMenuAdmin.mockResolvedValue([
      { id: 'c1', slug: 'cafes', name: 'Cafés' },
    ] as never);
    const res = await handleRpc({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'get_menu', arguments: {} },
    });
    const result = res!.result as {
      content: Array<{ type: string; text: string }>;
      isError: boolean;
    };
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Cafés');
    expect(mockGetMenuAdmin).toHaveBeenCalledOnce();
  });

  it('refuse un outil hors `allowedTools` (rôle COMPTABLE sur get_menu)', async () => {
    const res = await handleRpc(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'get_menu', arguments: {} },
      },
      { allowedTools: FINANCE_TOOL_NAMES }
    );
    const result = res!.result as {
      content: Array<{ type: string; text: string }>;
      isError: boolean;
    };
    expect(result.isError).toBe(true);
    expect(mockGetMenuAdmin).not.toHaveBeenCalled();
  });
});

describe('tools/call — écriture', () => {
  it('create_category appelle la mutation et déclenche onWriteSuccess', async () => {
    mockCreateCategory.mockResolvedValue({ id: 'new' } as never);
    const onWriteSuccess = vi.fn();
    const res = await handleRpc(
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'create_category', arguments: { name: 'Pâtisseries' } },
      },
      { onWriteSuccess }
    );
    expect(mockCreateCategory).toHaveBeenCalledWith({ name: 'Pâtisseries' });
    expect(onWriteSuccess).toHaveBeenCalledWith('create_category');
    expect((res!.result as { isError: boolean }).isError).toBe(false);
  });

  it('ne déclenche pas onWriteSuccess pour un outil en lecture', async () => {
    mockGetMenuAdmin.mockResolvedValue([] as never);
    const onWriteSuccess = vi.fn();
    await handleRpc(
      {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'get_menu', arguments: {} },
      },
      { onWriteSuccess }
    );
    expect(onWriteSuccess).not.toHaveBeenCalled();
  });

  it('renvoie isError (pas une erreur protocolaire) si les arguments sont invalides', async () => {
    const res = await handleRpc({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      // price négatif → rejeté par productInputSchema
      params: {
        name: 'create_product',
        arguments: {
          categoryId: 'c1',
          name: 'X',
          description: 'd',
          price: -5,
          supplementGroups: [],
        },
      },
    });
    expect(res!.error).toBeUndefined();
    const result = res!.result as {
      isError: boolean;
      content: { text: string }[];
    };
    expect(result.isError).toBe(true);
    expect(mockCreateProduct).not.toHaveBeenCalled();
  });

  it('reporte les erreurs d’exécution en isError', async () => {
    mockCreateCategory.mockRejectedValue(new Error('DB indisponible'));
    const res = await handleRpc({
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: { name: 'create_category', arguments: { name: 'X' } },
    });
    const result = res!.result as {
      isError: boolean;
      content: { text: string }[];
    };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('DB indisponible');
  });
});

describe('erreurs protocolaires', () => {
  it('outil inconnu → erreur -32602', async () => {
    const res = await handleRpc({
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: { name: 'inexistant', arguments: {} },
    });
    expect(res!.error?.code).toBe(-32602);
  });

  it('méthode inconnue → erreur -32601', async () => {
    const res = await handleRpc({
      jsonrpc: '2.0',
      id: 10,
      method: 'methode/bidon',
    });
    expect(res!.error?.code).toBe(-32601);
  });

  it('message non-objet → erreur -32600', async () => {
    const res = await handleRpc('pas un objet');
    expect(res!.error?.code).toBe(-32600);
  });
});
