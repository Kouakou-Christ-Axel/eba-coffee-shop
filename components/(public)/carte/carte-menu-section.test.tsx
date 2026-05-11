// components/(public)/carte/carte-menu-section.test.tsx
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/lib/menu', () => ({
  getMenu: vi.fn(),
}));

vi.mock('./carte-menu-section-client', () => ({
  default: ({
    menuData,
  }: {
    menuData: { id: string; name: string; products: unknown[] }[];
  }) =>
    React.createElement(
      'div',
      null,
      menuData.map((cat) =>
        React.createElement('span', { key: cat.id }, cat.name)
      )
    ),
}));

import { getMenu } from '@/lib/menu';
import CarteMenuSection from './carte-menu-section';

const mockGetMenu = getMenu as MockedFunction<typeof getMenu>;

describe('CarteMenuSection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('passe les catégories DB au Client Component', async () => {
    mockGetMenu.mockResolvedValue([
      { id: 'boissons-chaudes', name: 'Boissons chaudes', products: [] },
      { id: 'patisseries', name: 'Pâtisseries', products: [] },
    ] as never);

    const element = await CarteMenuSection();
    const html = renderToStaticMarkup(element);

    expect(html).toContain('Boissons chaudes');
    expect(html).toContain('Pâtisseries');
  });
});
