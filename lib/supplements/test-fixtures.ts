import type { Product } from '@/config/menu';

export const spongeCake: Product = {
  id: 'sponge-cake',
  name: 'Sponge Cake (x3)',
  description: '3 parts, 3 goûts au choix',
  price: 6000,
  supplements: [
    {
      name: 'Goûts',
      type: 'quantity',
      required: true,
      minSelect: 3,
      maxSelect: 3,
      options: [
        { name: 'Vanille', price: 0 },
        { name: 'Chocolat', price: 0 },
        { name: 'Fraise', price: 0 },
      ],
    },
  ],
};

export const cappuccino: Product = {
  id: 'cappuccino',
  name: 'Cappuccino',
  description: '',
  price: 3500,
  supplements: [
    {
      name: 'Choix du lait',
      type: 'single',
      required: false,
      options: [
        { name: 'Lait classique', price: 0 },
        { name: 'Lait d’avoine', price: 500 },
      ],
    },
    {
      name: 'Extras',
      type: 'multiple',
      required: false,
      maxSelect: 2,
      options: [
        { name: 'Shot espresso', price: 300 },
        { name: 'Sirop vanille', price: 200 },
        { name: 'Chantilly', price: 300 },
      ],
    },
  ],
};
