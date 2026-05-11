import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';

vi.mock('@/lib/menu', () => ({
  getMenu: vi.fn(),
}));

import { getMenu } from '@/lib/menu';
import { GET } from './route';

const mockGetMenu = getMenu as MockedFunction<typeof getMenu>;

const mockMenu = [
  {
    id: 'boissons-chaudes',
    name: 'Boissons chaudes',
    products: [
      {
        id: 'prod1',
        name: 'Espresso',
        description: 'Court et intense',
        price: 1500,
        supplements: [],
      },
    ],
  },
];

describe('GET /api/menu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('retourne les catégories avec leurs produits (200)', async () => {
    mockGetMenu.mockResolvedValue(mockMenu as never);
    const response = await GET();
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('Boissons chaudes');
    expect(data[0].products[0].name).toBe('Espresso');
  });

  it('retourne 500 si getMenu lance une erreur', async () => {
    mockGetMenu.mockRejectedValue(new Error('DB error'));
    const response = await GET();
    expect(response.status).toBe(500);
  });
});
