// config/menu.ts

export type SupplementOption = {
  name: string;
  price: number;
};

export type SupplementGroup = {
  name: string;
  type: 'single' | 'multiple';
  required: boolean;
  options: SupplementOption[];
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  supplements?: SupplementGroup[];
};

export type MenuCategory = {
  id: string;
  name: string;
  products: Product[];
};

const milkChoice: SupplementGroup = {
  name: 'Choix du lait',
  type: 'single',
  required: false,
  options: [
    { name: 'Lait classique', price: 0 },
    { name: 'Lait d\u2019avoine', price: 500 },
    { name: 'Lait d\u2019amande', price: 500 },
  ],
};

const coffeeExtras: SupplementGroup = {
  name: 'Extras',
  type: 'multiple',
  required: false,
  options: [
    { name: 'Shot espresso', price: 300 },
    { name: 'Sirop vanille', price: 200 },
    { name: 'Sirop caramel', price: 200 },
    { name: 'Chantilly', price: 300 },
  ],
};

export const menu: MenuCategory[] = [
  {
    id: 'boissons-chaudes',
    name: 'Boissons chaudes',
    products: [
      {
        id: 'espresso',
        name: 'Espresso',
        description: 'Court et intense',
        price: 1500,
        supplements: [coffeeExtras],
      },
      {
        id: 'cappuccino',
        name: 'Cappuccino Signature',
        description: 'Crema onctueuse, lait moussé',
        price: 3500,
        supplements: [milkChoice, coffeeExtras],
      },
      {
        id: 'latte-vanille',
        name: 'Latte Vanille',
        description: 'Espresso, lait chaud, vanille naturelle',
        price: 4000,
        supplements: [milkChoice, coffeeExtras],
      },
      {
        id: 'chocolat-chaud',
        name: 'Chocolat Chaud',
        description: 'Chocolat de couverture, lait entier',
        price: 3000,
        supplements: [milkChoice],
      },
      {
        id: 'the-infusion',
        name: 'Thé & Infusion',
        description: 'Sélection de thés et infusions',
        price: 2000,
      },
    ],
  },
  {
    id: 'boissons-fraiches',
    name: 'Boissons fraîches',
    products: [
      {
        id: 'cafe-glace',
        name: 'Café Glacé',
        description: 'Espresso sur glace, lait froid',
        price: 3500,
        supplements: [milkChoice],
      },
      {
        id: 'jus-frais',
        name: 'Jus Frais du Jour',
        description: 'Fruits frais pressés sur place',
        price: 3000,
      },
      {
        id: 'smoothie-mangue',
        name: 'Smoothie Mangue',
        description: 'Mangue, banane, lait de coco',
        price: 4000,
      },
      {
        id: 'limonade',
        name: 'Limonade Maison',
        description: 'Citron frais, menthe, sucre de canne',
        price: 2500,
      },
    ],
  },
  {
    id: 'patisseries',
    name: 'Pâtisseries',
    products: [
      {
        id: 'croissant-amande',
        name: 'Croissant Amande',
        description: 'Beurre français, pâte feuilletée maison',
        price: 2500,
      },
      {
        id: 'pain-chocolat',
        name: 'Pain au Chocolat',
        description: 'Chocolat noir, beurre AOP',
        price: 2000,
      },
      {
        id: 'tarte-fruits',
        name: 'Tarte aux Fruits',
        description: 'Fruits de saison, crème pâtissière',
        price: 3500,
      },
      {
        id: 'cookie-chocolat',
        name: 'Cookie Chocolat',
        description: 'Pépites de chocolat, fleur de sel',
        price: 1500,
      },
      {
        id: 'eclair-cafe',
        name: 'Éclair Café',
        description: 'Crème café, glaçage fondant',
        price: 3000,
      },
    ],
  },
  {
    id: 'brunch-sale',
    name: 'Brunch & Salé',
    products: [
      {
        id: 'formule-brunch',
        name: 'Formule Brunch',
        description: 'Boisson chaude, viennoiserie, œufs, jus',
        price: 8500,
      },
      {
        id: 'toast-avocat',
        name: 'Toast Avocat',
        description: 'Pain complet, avocat, œuf poché',
        price: 5000,
      },
      {
        id: 'croque-eba',
        name: 'Croque EBA',
        description: 'Jambon, fromage gratiné, salade',
        price: 4500,
      },
      {
        id: 'salade-marche',
        name: 'Salade du Marché',
        description: 'Légumes frais, vinaigrette maison',
        price: 4000,
      },
    ],
  },
];

export const priceFormatter = new Intl.NumberFormat('fr-FR');
