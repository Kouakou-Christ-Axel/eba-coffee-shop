# Carte Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/carte` menu page with sticky category navigation (Uber Eats-style), product cards with supplement modals, a floating cart with drawer, and WhatsApp ordering.

**Architecture:** Menu data is hardcoded in `config/menu.ts`. Cart state is managed via Zustand store (`lib/cart-store.ts`). Components are split by responsibility: menu display, product card, supplement modal, cart button, cart drawer, WhatsApp message builder.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, HeroUI (Modal, Button, RadioGroup, Checkbox), Framer Motion, Zustand, lucide-react icons

---

## File Structure

```
config/menu.ts                                     — menu data types + hardcoded menu constant
lib/cart-store.ts                                   — Zustand cart store with useCartStore hook
lib/cart-to-whatsapp.ts                             — builds WhatsApp URL from cart items
app/(public)/carte/page.tsx                         — page with metadata
components/(public)/carte/carte-hero-section.tsx     — short hero (server component)
components/(public)/carte/carte-menu-section.tsx     — sticky nav + category sections + product grid
components/(public)/carte/product-card.tsx           — single product card with "+" button
components/(public)/carte/supplement-modal.tsx       — modal for configuring supplements before adding to cart
components/(public)/carte/cart-floating-button.tsx   — floating badge (bottom-right), opens drawer
components/(public)/carte/cart-drawer.tsx            — slide-in panel with cart items, quantities, WhatsApp button
```

---

### Task 1: Menu Data & Types

**Files:**

- Create: `config/menu.ts`

- [ ] **Step 1: Create the menu data file with types and full content**

```ts
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
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add config/menu.ts
git commit -m "feat(carte): add menu data types and content"
```

---

### Task 2: Cart Store (Zustand)

**Files:**

- Create: `lib/cart-store.ts`

- [ ] **Step 1: Create the Zustand cart store**

```ts
// lib/cart-store.ts
import { create } from 'zustand';

export type CartItemSupplement = {
  groupName: string;
  optionName: string;
  price: number;
};

export type CartItem = {
  cartId: string;
  productId: string;
  productName: string;
  basePrice: number;
  quantity: number;
  supplements: CartItemSupplement[];
};

export function getItemTotal(item: CartItem): number {
  const supplementsTotal = item.supplements.reduce(
    (sum, s) => sum + s.price,
    0
  );
  return (item.basePrice + supplementsTotal) * item.quantity;
}

type CartStore = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'cartId' | 'quantity'>) => void;
  removeItem: (cartId: string) => void;
  updateQuantity: (cartId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
};

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find(
        (i) =>
          i.productId === item.productId &&
          JSON.stringify(i.supplements) === JSON.stringify(item.supplements)
      );
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.cartId === existing.cartId
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        };
      }
      const cartId = Math.random().toString(36).slice(2, 10);
      return { items: [...state.items, { ...item, cartId, quantity: 1 }] };
    }),

  removeItem: (cartId) =>
    set((state) => ({
      items: state.items.filter((i) => i.cartId !== cartId),
    })),

  updateQuantity: (cartId, quantity) =>
    set((state) => ({
      items:
        quantity <= 0
          ? state.items.filter((i) => i.cartId !== cartId)
          : state.items.map((i) =>
              i.cartId === cartId ? { ...i, quantity } : i
            ),
    })),

  clearCart: () => set({ items: [] }),

  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

  totalPrice: () => get().items.reduce((sum, i) => sum + getItemTotal(i), 0),
}));
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add lib/cart-store.ts
git commit -m "feat(carte): add Zustand cart store"
```

---

### Task 3: WhatsApp Message Builder

**Files:**

- Create: `lib/cart-to-whatsapp.ts`

- [ ] **Step 1: Create the WhatsApp URL builder**

```ts
// lib/cart-to-whatsapp.ts
import type { CartItem } from '@/lib/cart-store';
import { brandConfig } from '@/config/brand.config';
import { priceFormatter } from '@/config/menu';

function getItemTotal(item: CartItem): number {
  const supplementsTotal = item.supplements.reduce(
    (sum, s) => sum + s.price,
    0
  );
  return (item.basePrice + supplementsTotal) * item.quantity;
}

export function buildWhatsAppUrl(items: CartItem[]): string {
  const lines = items.map((item) => {
    const supps =
      item.supplements.length > 0
        ? ` (${item.supplements.map((s) => s.optionName).join(', ')})`
        : '';
    const total = priceFormatter.format(getItemTotal(item));
    return `\u2022 ${item.quantity}x ${item.productName}${supps} \u2014 ${total} F`;
  });

  const grandTotal = priceFormatter.format(
    items.reduce((sum, i) => sum + getItemTotal(i), 0)
  );

  const message = [
    'Bonjour, je souhaite commander :',
    '',
    ...lines,
    '',
    `Total : ${grandTotal} F`,
    '',
    'Merci !',
  ].join('\n');

  const encoded = encodeURIComponent(message);
  return `${brandConfig.location.whatsappLink}?text=${encoded}`;
}
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add lib/cart-to-whatsapp.ts
git commit -m "feat(carte): add WhatsApp message builder utility"
```

---

### Task 4: Page Shell + Hero Section

**Files:**

- Create: `app/(public)/carte/page.tsx`
- Create: `components/(public)/carte/carte-hero-section.tsx`

- [ ] **Step 1: Create the hero section**

```tsx
// components/(public)/carte/carte-hero-section.tsx

function CarteHeroSection() {
  return (
    <section
      aria-labelledby="carte-hero-title"
      className="bg-[linear-gradient(180deg,rgba(247,239,232,1)_0%,rgba(255,252,248,1)_100%)] pb-4 pt-32 md:pb-6 md:pt-40"
    >
      <div className="content-container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-600">
            Notre carte
          </p>
          <h1
            id="carte-hero-title"
            className="mt-3 text-balance text-4xl font-semibold leading-snug tracking-tight sm:text-5xl"
          >
            Des saveurs pensées avec soin
          </h1>
          <p className="mt-4 text-base leading-relaxed text-foreground/60 sm:text-lg">
            Chaque boisson et chaque pâtisserie est préparée sur place, chaque
            jour.
          </p>
        </div>
      </div>
    </section>
  );
}

export default CarteHeroSection;
```

- [ ] **Step 2: Create the page with metadata**

```tsx
// app/(public)/carte/page.tsx
import type { Metadata } from 'next';
import CarteHeroSection from '@/components/(public)/carte/carte-hero-section';
import CarteMenuSection from '@/components/(public)/carte/carte-menu-section';
import CartFloatingButton from '@/components/(public)/carte/cart-floating-button';

export const metadata: Metadata = {
  title: 'La carte',
  description:
    'Découvrez la carte EBA Coffee Shop : cafés de spécialité, pâtisseries artisanales, brunch et boissons signatures à Cocody, Abidjan.',
  alternates: { canonical: '/carte' },
};

function CartePage() {
  return (
    <>
      <CarteHeroSection />
      <CarteMenuSection />
      <CartFloatingButton />
    </>
  );
}

export default CartePage;
```

Note: `CarteMenuSection`, `CartFloatingButton`, and `CartDrawer` don't exist yet. Create empty placeholder files so the build doesn't fail:

```tsx
// components/(public)/carte/carte-menu-section.tsx
'use client';
export default function CarteMenuSection() {
  return null;
}
```

```tsx
// components/(public)/carte/cart-floating-button.tsx
'use client';
export default function CartFloatingButton() {
  return null;
}
```

```tsx
// components/(public)/carte/cart-drawer.tsx
'use client';
export default function CartDrawer() {
  return null;
}
```

- [ ] **Step 3: Add /carte to sitemap if not already present**

Check `app/sitemap.ts` — if `/carte` is not listed, add it:

```ts
{
  url: `${siteUrl}/carte`,
  lastModified: now,
  changeFrequency: 'monthly',
  priority: 0.9,
},
```

- [ ] **Step 4: Verify build**

Run: `bun run build`
Expected: Build succeeds, `/carte` is accessible

- [ ] **Step 5: Commit**

```bash
git add app/(public)/carte/ components/(public)/carte/ app/sitemap.ts
git commit -m "feat(carte): add page shell, hero section, and placeholder components"
```

---

### Task 5: Product Card

**Files:**

- Create: `components/(public)/carte/product-card.tsx`

- [ ] **Step 1: Create the product card component**

This component renders a single product. If the product has supplements, clicking "+" opens the supplement modal. If no supplements, it adds directly to cart.

```tsx
// components/(public)/carte/product-card.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@heroui/react';
import { Plus } from 'lucide-react';
import { useCart } from '@/lib/cart-store';
import { priceFormatter, type Product } from '@/config/menu';
import SupplementModal from '@/components/(public)/carte/supplement-modal';

type ProductCardProps = {
  product: Product;
};

function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCartStore();
  const [showModal, setShowModal] = useState(false);
  const hasSups = product.supplements && product.supplements.length > 0;

  function handleAdd() {
    if (hasSups) {
      setShowModal(true);
    } else {
      addItem({
        productId: product.id,
        productName: product.name,
        basePrice: product.price,
        supplements: [],
      });
    }
  }

  return (
    <>
      <div className="group flex items-center gap-4 rounded-2xl border border-foreground/5 bg-white/60 p-3 transition-colors duration-200 hover:border-primary/10 hover:bg-white/80 sm:p-4">
        {/* Image */}
        {product.image ? (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl sm:h-24 sm:w-24">
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="96px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.03] sm:h-24 sm:w-24">
            <span className="text-2xl text-foreground/15">
              {product.name.charAt(0)}
            </span>
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
            {product.name}
          </p>
          <p className="mt-0.5 text-xs text-foreground/50 sm:text-sm">
            {product.description}
          </p>
          <p className="mt-1.5 text-sm font-semibold text-primary">
            {priceFormatter.format(product.price)}&nbsp;F
          </p>
        </div>

        {/* Add button */}
        <Button
          isIconOnly
          size="sm"
          color="primary"
          variant="flat"
          radius="full"
          aria-label={`Ajouter ${product.name}`}
          onPress={handleAdd}
          className="shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {hasSups && (
        <SupplementModal
          product={product}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

export default ProductCard;
```

Note: `SupplementModal` will be built in Task 6. Create a temporary placeholder if it doesn't exist yet:

```tsx
// components/(public)/carte/supplement-modal.tsx (temp)
'use client';
import type { Product } from '@/config/menu';
export default function SupplementModal({
  isOpen,
  onClose,
  product,
}: {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;
  return null;
}
```

- [ ] **Step 2: Verify build**

Run: `bun run build`

- [ ] **Step 3: Commit**

```bash
git add components/(public)/carte/product-card.tsx components/(public)/carte/supplement-modal.tsx
git commit -m "feat(carte): add product card component"
```

---

### Task 6: Supplement Modal

**Files:**

- Modify: `components/(public)/carte/supplement-modal.tsx`

- [ ] **Step 1: Implement the full supplement modal**

Replace the placeholder with the real implementation:

```tsx
// components/(public)/carte/supplement-modal.tsx
'use client';

import { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  RadioGroup,
  Radio,
  Checkbox,
} from '@heroui/react';
import { useCartStore, type CartItemSupplement } from '@/lib/cart-store';
import { priceFormatter, type Product } from '@/config/menu';

type SupplementModalProps = {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
};

function SupplementModal({ product, isOpen, onClose }: SupplementModalProps) {
  const { addItem } = useCartStore();
  const groups = product.supplements ?? [];

  // State: one entry per group. For 'single' = string (option name), for 'multiple' = string[] (option names)
  const [selections, setSelections] = useState<
    Record<string, string | string[]>
  >(() => {
    const initial: Record<string, string | string[]> = {};
    groups.forEach((g) => {
      initial[g.name] = g.type === 'single' ? '' : [];
    });
    return initial;
  });

  function getSelectedSupplements(): CartItemSupplement[] {
    const result: CartItemSupplement[] = [];
    groups.forEach((group) => {
      const sel = selections[group.name];
      if (group.type === 'single' && typeof sel === 'string' && sel) {
        const opt = group.options.find((o) => o.name === sel);
        if (opt && opt.price > 0) {
          result.push({
            groupName: group.name,
            optionName: opt.name,
            price: opt.price,
          });
        }
      } else if (group.type === 'multiple' && Array.isArray(sel)) {
        sel.forEach((name) => {
          const opt = group.options.find((o) => o.name === name);
          if (opt) {
            result.push({
              groupName: group.name,
              optionName: opt.name,
              price: opt.price,
            });
          }
        });
      }
    });
    return result;
  }

  function getRunningTotal(): number {
    const supps = getSelectedSupplements();
    return product.price + supps.reduce((sum, s) => sum + s.price, 0);
  }

  function handleAdd() {
    addItem({
      productId: product.id,
      productName: product.name,
      basePrice: product.price,
      supplements: getSelectedSupplements(),
    });
    // Reset selections
    const reset: Record<string, string | string[]> = {};
    groups.forEach((g) => {
      reset[g.name] = g.type === 'single' ? '' : [];
    });
    setSelections(reset);
    onClose();
  }

  function handleSingleChange(groupName: string, value: string) {
    setSelections((prev) => ({ ...prev, [groupName]: value }));
  }

  function handleMultipleToggle(groupName: string, optionName: string) {
    setSelections((prev) => {
      const current = prev[groupName] as string[];
      const next = current.includes(optionName)
        ? current.filter((n) => n !== optionName)
        : [...current, optionName];
      return { ...prev, [groupName]: next };
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} placement="center" size="md">
      <ModalContent>
        <ModalHeader className="flex-col items-start gap-1">
          <span className="text-lg font-semibold">{product.name}</span>
          <span className="text-sm font-normal text-foreground/50">
            À partir de {priceFormatter.format(product.price)} F
          </span>
        </ModalHeader>

        <ModalBody className="gap-6">
          {groups.map((group) => (
            <fieldset key={group.name}>
              <legend className="mb-2 text-sm font-semibold text-foreground/80">
                {group.name}
                {group.required && (
                  <span className="ml-1 text-xs text-primary">(requis)</span>
                )}
              </legend>

              {group.type === 'single' ? (
                <RadioGroup
                  value={selections[group.name] as string}
                  onValueChange={(v) => handleSingleChange(group.name, v)}
                >
                  {group.options.map((opt) => (
                    <Radio key={opt.name} value={opt.name}>
                      <span className="flex items-center justify-between gap-4">
                        <span className="text-sm">{opt.name}</span>
                        <span className="text-xs text-foreground/50">
                          {opt.price === 0
                            ? 'Inclus'
                            : `+${priceFormatter.format(opt.price)} F`}
                        </span>
                      </span>
                    </Radio>
                  ))}
                </RadioGroup>
              ) : (
                <div className="space-y-2">
                  {group.options.map((opt) => (
                    <Checkbox
                      key={opt.name}
                      isSelected={(selections[group.name] as string[]).includes(
                        opt.name
                      )}
                      onValueChange={() =>
                        handleMultipleToggle(group.name, opt.name)
                      }
                    >
                      <span className="flex items-center justify-between gap-4">
                        <span className="text-sm">{opt.name}</span>
                        <span className="text-xs text-foreground/50">
                          +{priceFormatter.format(opt.price)} F
                        </span>
                      </span>
                    </Checkbox>
                  ))}
                </div>
              )}
            </fieldset>
          ))}
        </ModalBody>

        <ModalFooter>
          <Button
            color="primary"
            className="w-full"
            size="lg"
            onPress={handleAdd}
          >
            Ajouter \u2014 {priceFormatter.format(getRunningTotal())} F
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default SupplementModal;
```

- [ ] **Step 2: Verify build**

Run: `bun run build`

- [ ] **Step 3: Commit**

```bash
git add components/(public)/carte/supplement-modal.tsx
git commit -m "feat(carte): add supplement selection modal"
```

---

### Task 7: Menu Section with Sticky Nav

**Files:**

- Modify: `components/(public)/carte/carte-menu-section.tsx`

- [ ] **Step 1: Implement the full menu section with sticky category navigation**

Replace the placeholder:

```tsx
// components/(public)/carte/carte-menu-section.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { menu } from '@/config/menu';
import ProductCard from '@/components/(public)/carte/product-card';

function CarteMenuSection() {
  const reduceMotion = useReducedMotion();
  const [activeId, setActiveId] = useState(menu[0].id);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const navRef = useRef<HTMLDivElement>(null);
  const isScrollingTo = useRef(false);

  // IntersectionObserver to track active category
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    sectionRefs.current.forEach((el, id) => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !isScrollingTo.current) {
            setActiveId(id);
          }
        },
        { rootMargin: '-120px 0px -60% 0px', threshold: 0 }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  function scrollToCategory(id: string) {
    const el = sectionRefs.current.get(id);
    if (!el) return;

    isScrollingTo.current = true;
    setActiveId(id);

    const navHeight = navRef.current?.offsetHeight ?? 0;
    const top =
      el.getBoundingClientRect().top + window.scrollY - navHeight - 80;
    window.scrollTo({ top, behavior: 'smooth' });

    setTimeout(() => {
      isScrollingTo.current = false;
    }, 800);
  }

  // Scroll active nav button into view
  useEffect(() => {
    if (!navRef.current) return;
    const activeBtn = navRef.current.querySelector('[data-active="true"]');
    if (activeBtn) {
      activeBtn.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeId]);

  return (
    <section
      aria-label="Menu EBA Coffee Shop"
      className="bg-[linear-gradient(180deg,rgba(255,252,248,1)_0%,rgba(247,239,232,1)_100%)] pb-14 md:pb-20"
    >
      {/* Sticky nav */}
      <div
        ref={navRef}
        className="sticky top-16 z-30 border-b border-foreground/5 bg-background/90 backdrop-blur-sm"
      >
        <div className="content-container">
          <nav
            className="flex gap-1 overflow-x-auto py-3 scrollbar-none"
            aria-label="Catégories du menu"
          >
            {menu.map((cat) => (
              <button
                key={cat.id}
                data-active={activeId === cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${
                  activeId === cat.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Category sections */}
      <div className="content-container mt-6 space-y-10 md:mt-8 md:space-y-14">
        {menu.map((category) => (
          <div
            key={category.id}
            id={category.id}
            ref={(el) => {
              if (el) sectionRefs.current.set(category.id, el);
            }}
          >
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {category.name}
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {category.products.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
                  whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={
                    reduceMotion
                      ? undefined
                      : { duration: 0.4, delay: i * 0.05, ease: 'easeOut' }
                  }
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default CarteMenuSection;
```

- [ ] **Step 2: Verify build**

Run: `bun run build`

- [ ] **Step 3: Commit**

```bash
git add components/(public)/carte/carte-menu-section.tsx
git commit -m "feat(carte): add menu section with sticky category navigation"
```

---

### Task 8: Cart Floating Button

**Files:**

- Modify: `components/(public)/carte/cart-floating-button.tsx`

- [ ] **Step 1: Implement the floating cart button**

Replace the placeholder:

```tsx
// components/(public)/carte/cart-floating-button.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/cart-store';
import { priceFormatter } from '@/config/menu';
import CartDrawer from '@/components/(public)/carte/cart-drawer';

function CartFloatingButton() {
  const { totalItems, totalPrice } = useCartStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <AnimatePresence>
        {totalItems > 0 && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={() => setDrawerOpen(true)}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full bg-primary px-5 py-3 text-primary-foreground shadow-xl shadow-primary/25 transition-shadow duration-200 hover:shadow-2xl hover:shadow-primary/30"
            aria-label={`Voir le panier, ${totalItems} article${totalItems > 1 ? 's' : ''}`}
          >
            <ShoppingBag className="h-5 w-5" />
            <span className="text-sm font-semibold">{totalItems}</span>
            <span
              className="h-4 w-px bg-primary-foreground/30"
              aria-hidden="true"
            />
            <span className="text-sm font-semibold">
              {priceFormatter.format(totalPrice)}&nbsp;F
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <CartDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

export default CartFloatingButton;
```

Note: This component now owns the CartDrawer and passes `isOpen`/`onClose`. The page.tsx from Task 4 already has `<CartFloatingButton />` without a separate `<CartDrawer />`, so no page update needed.

- [ ] **Step 2: Verify build**

Run: `bun run build`

- [ ] **Step 3: Commit**

```bash
git add components/(public)/carte/cart-floating-button.tsx app/(public)/carte/page.tsx
git commit -m "feat(carte): add floating cart button with item count and total"
```

---

### Task 9: Cart Drawer

**Files:**

- Modify: `components/(public)/carte/cart-drawer.tsx`

- [ ] **Step 1: Implement the cart drawer**

Replace the placeholder:

```tsx
// components/(public)/carte/cart-drawer.tsx
'use client';

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useCart } from '@/lib/cart-store';
import { priceFormatter } from '@/config/menu';
import { buildWhatsAppUrl } from '@/lib/cart-to-whatsapp';

type CartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
};

function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const {
    items,
    totalPrice,
    updateQuantity,
    removeItem,
    clearCart,
    getItemTotal,
  } = useCartStore();

  function handleOrder() {
    const url = buildWhatsAppUrl(items);
    window.open(url, '_blank');
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="center"
      size="lg"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader>
          <span className="text-lg font-semibold">Votre commande</span>
        </ModalHeader>

        <ModalBody>
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-foreground/50">
              Votre panier est vide
            </p>
          ) : (
            <div className="divide-y divide-foreground/5">
              {items.map((item) => (
                <div
                  key={item.cartId}
                  className="flex items-start gap-3 py-4 first:pt-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {item.productName}
                    </p>
                    {item.supplements.length > 0 && (
                      <p className="mt-0.5 text-xs text-foreground/45">
                        {item.supplements.map((s) => s.optionName).join(', ')}
                      </p>
                    )}
                    <p className="mt-1 text-sm font-medium text-primary">
                      {priceFormatter.format(getItemTotal(item))}&nbsp;F
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="flat"
                      radius="full"
                      aria-label="Retirer un"
                      onPress={() =>
                        updateQuantity(item.cartId, item.quantity - 1)
                      }
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">
                      {item.quantity}
                    </span>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="flat"
                      radius="full"
                      aria-label="Ajouter un"
                      onPress={() =>
                        updateQuantity(item.cartId, item.quantity + 1)
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      radius="full"
                      color="danger"
                      aria-label="Supprimer"
                      onPress={() => removeItem(item.cartId)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ModalBody>

        {items.length > 0 && (
          <ModalFooter className="flex-col gap-3">
            <div className="flex w-full items-center justify-between">
              <span className="text-base font-semibold">Total</span>
              <span className="text-lg font-bold text-primary">
                {priceFormatter.format(totalPrice)}&nbsp;F
              </span>
            </div>

            <Button
              color="primary"
              className="w-full"
              size="lg"
              onPress={handleOrder}
            >
              Commander via WhatsApp
            </Button>

            <button
              onClick={() => {
                clearCart();
                onClose();
              }}
              className="text-xs text-foreground/40 transition-colors hover:text-destructive"
            >
              Vider le panier
            </button>
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
}

export default CartDrawer;
```

- [ ] **Step 2: Verify build**

Run: `bun run build`

- [ ] **Step 3: Commit**

```bash
git add components/(public)/carte/cart-drawer.tsx
git commit -m "feat(carte): add cart drawer with quantity controls and WhatsApp ordering"
```

---

## Execution Order Summary

| Task | Component            | Dependencies                                    |
| ---- | -------------------- | ----------------------------------------------- |
| 1    | Menu data & types    | None                                            |
| 2    | Cart context         | None                                            |
| 3    | WhatsApp builder     | Task 1 (priceFormatter), Task 2 (CartItem type) |
| 4    | Page shell + Hero    | Tasks 1-3 (imports)                             |
| 5    | Product card         | Task 1 (Product type), Task 2 (useCart)         |
| 6    | Supplement modal     | Task 1 (types), Task 2 (useCart)                |
| 7    | Menu section         | Task 1 (menu data), Task 5 (ProductCard)        |
| 8    | Cart floating button | Task 2 (useCart), Task 9 (CartDrawer)           |
| 9    | Cart drawer          | Task 2 (useCart), Task 3 (buildWhatsAppUrl)     |

Tasks 1-2 are independent. Tasks 3+ are sequential.
