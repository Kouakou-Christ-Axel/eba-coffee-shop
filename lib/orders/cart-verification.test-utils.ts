import type { CartItem } from '@/lib/cart-store';
import type { CartMismatchError } from './cart-verification';

export const menu = [
  {
    products: [
      {
        id: 'p1',
        price: 1500,
        supplements: [
          {
            name: 'Taille',
            options: [
              { name: 'Grand', price: 500, available: true },
              { name: 'Petit', price: 0, available: true },
            ],
          },
          {
            // Doublon de nom : option désactivée conservée à côté de l'active.
            name: 'Goût',
            options: [
              { name: 'Vanille', price: 300, available: false },
              { name: 'Vanille', price: 400, available: true },
            ],
          },
        ],
      },
      { id: 'p2', price: 2000, supplements: [] },
      {
        id: 'p3',
        price: 1000,
        supplements: [
          {
            name: 'Lait',
            type: 'single',
            required: true,
            options: [
              { name: 'Vache', price: 0, available: true },
              { name: 'Avoine', price: 200, available: true },
              { name: 'Coco', price: 300, available: false },
            ],
          },
          {
            name: 'Sirop',
            type: 'multiple',
            maxSelect: 2,
            options: [
              { name: 'Caramel', price: 100, available: true },
              { name: 'Noisette', price: 100, available: true },
              { name: 'Menthe', price: 100, available: true },
            ],
          },
          {
            name: 'Parts',
            type: 'quantity',
            minSelect: 4,
            maxSelect: 4,
            options: [
              { name: 'Vanille', price: 0, available: true },
              { name: 'Chocolat', price: 0, available: true },
            ],
          },
        ],
      },
    ],
  },
] as never;

export const lait = { groupName: 'Lait', optionName: 'Vache', price: 0 };
export const parts = (n: number) => ({
  groupName: 'Parts',
  optionName: 'Vanille',
  price: 0,
  quantity: n,
});
export const sirop = (optionName: string) => ({
  groupName: 'Sirop',
  optionName,
  price: 100,
  quantity: 1,
});
export const p3 = (supplements: CartItem['supplements']) =>
  item({ productId: 'p3', basePrice: 1000, supplements });
export const reasonOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    return (err as CartMismatchError).reason;
  }
};

export function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    cartId: 'c1',
    productId: 'p1',
    productName: 'Café',
    basePrice: 1500,
    quantity: 1,
    supplements: [],
    discount: 0,
    ...overrides,
  } as CartItem;
}
