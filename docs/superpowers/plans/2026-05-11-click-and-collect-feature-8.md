# F8 — Dashboard Gestion du menu + images — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le backoffice de gestion du menu : CRUD des catégories et des produits (incluant suppléments), upload d'images vers Vercel Blob, toggle de disponibilité, réorganisation. Les mutations invalident le cache de `/api/menu` pour refléter immédiatement les changements côté client.

**Architecture:** Une couche de mutations pure (`lib/menu-mutations.ts`) encapsule les opérations Prisma et reste testable sans auth. Les Server Actions (`app/(dashboard)/dashboard/menu/actions.ts`) wrappent ces mutations en vérifiant la session admin puis invalident `/api/menu` et `/carte` via `revalidatePath`. Le upload route `/api/upload` valide le fichier (MIME + taille) et délègue à `@vercel/blob`. Les pages dashboard utilisent les composants shadcn existants (`Button`, `Card`, `Table`, `Badge`, `Separator`) plus quatre nouveaux composants minimaux (`Input`, `Textarea`, `Label`, `Switch`). Les confirmations de suppression utilisent `window.confirm()` (pas de modal). La réorganisation utilise des boutons ▲▼ (pas de drag-and-drop).

**Tech Stack:** Next.js 16 App Router (Server Actions, `revalidatePath`), Prisma 7, PostgreSQL, `@vercel/blob` v0.x (à installer), Better Auth, radix-ui Switch primitive, Vitest, react-dom/server pour tests Server Components.

---

## Fichiers créés/modifiés

| Fichier                                                                     | Action   | Rôle                                                                                            |
| --------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `package.json`                                                              | Modifier | Ajouter `@vercel/blob`                                                                          |
| `.env.schema`                                                               | Modifier | Ajouter `BLOB_READ_WRITE_TOKEN`                                                                 |
| `components/ui/input.tsx`                                                   | Créer    | Input shadcn-style                                                                              |
| `components/ui/textarea.tsx`                                                | Créer    | Textarea shadcn-style                                                                           |
| `components/ui/label.tsx`                                                   | Créer    | Label shadcn-style                                                                              |
| `components/ui/switch.tsx`                                                  | Créer    | Switch radix-based                                                                              |
| `lib/menu-mutations.ts`                                                     | Créer    | CRUD pur (testable, pas d'auth)                                                                 |
| `lib/menu-mutations.test.ts`                                                | Créer    | Tests TDD des mutations                                                                         |
| `app/api/upload/route.ts`                                                   | Créer    | `POST /api/upload` → Vercel Blob                                                                |
| `app/api/upload/route.test.ts`                                              | Créer    | Tests TDD upload                                                                                |
| `app/(dashboard)/dashboard/menu/actions.ts`                                 | Créer    | Server Actions (auth + revalidate)                                                              |
| `app/(dashboard)/dashboard/menu/actions.test.ts`                            | Créer    | Tests TDD Server Actions                                                                        |
| `app/(dashboard)/dashboard/menu/page.tsx`                                   | Créer    | Liste catégories + form inline + ▲▼ + toggle + delete                                           |
| `app/(dashboard)/dashboard/menu/category-form.tsx`                          | Créer    | Client Component — formulaire création catégorie                                                |
| `app/(dashboard)/dashboard/menu/category-row-actions.tsx`                   | Créer    | Client Component — boutons toggle/▲▼/delete                                                     |
| `app/(dashboard)/dashboard/menu/[categoryId]/page.tsx`                      | Créer    | Liste produits par catégorie                                                                    |
| `app/(dashboard)/dashboard/menu/[categoryId]/product-row-actions.tsx`       | Créer    | Client Component — toggle/delete produit                                                        |
| `app/(dashboard)/dashboard/menu/[categoryId]/produits/new/page.tsx`         | Créer    | Page création produit                                                                           |
| `app/(dashboard)/dashboard/menu/[categoryId]/produits/[productId]/page.tsx` | Créer    | Page édition produit                                                                            |
| `app/(dashboard)/dashboard/menu/[categoryId]/produits/product-form.tsx`     | Créer    | Client Component — formulaire produit complet (champs + image + groupes suppléments dynamiques) |
| `docs/superpowers/specs/2026-05-10-click-and-collect-design.md`             | Modifier | Marquer F8 ✅                                                                                   |

---

## Task 1 — Setup : dépendance @vercel/blob + variable d'env

**Files:**

- Modify: `package.json`
- Modify: `.env.schema`

- [ ] **Step 1 : Installer la dépendance `@vercel/blob`**

```bash
bun add @vercel/blob
```

Vérifier que `package.json` contient maintenant `"@vercel/blob"` dans `dependencies` (version `^1.x` attendue).

- [ ] **Step 2 : Ajouter la variable d'env au schema**

Ouvrir `.env.schema` et ajouter à la fin (après la ligne `ADMIN_EMAIL=`) :

```
# @type=string
BLOB_READ_WRITE_TOKEN=
```

- [ ] **Step 3 : Régénérer les types env**

```bash
bun run dev
```

Lancer le dev server une fois pour que varlock régénère `env.d.ts`. Arrêter avec Ctrl+C dès que la régénération est faite (vérifier que `env.d.ts` contient maintenant `BLOB_READ_WRITE_TOKEN`).

- [ ] **Step 4 : Commit**

```bash
git add package.json bun.lock .env.schema env.d.ts
git commit -m "chore: add @vercel/blob dependency and BLOB_READ_WRITE_TOKEN env"
```

---

## Task 2 — Composants UI : Input, Textarea, Label, Switch

**Files:**

- Create: `components/ui/input.tsx`
- Create: `components/ui/textarea.tsx`
- Create: `components/ui/label.tsx`
- Create: `components/ui/switch.tsx`

Pas de tests dédiés : ces composants sont des wrappers triviaux validés indirectement par les pages qui les consomment.

- [ ] **Step 1 : Créer `components/ui/input.tsx`**

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

export { Input };
```

- [ ] **Step 2 : Créer `components/ui/textarea.tsx`**

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
```

- [ ] **Step 3 : Créer `components/ui/label.tsx`**

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className
      )}
      {...props}
    />
  );
}

export { Label };
```

- [ ] **Step 4 : Créer `components/ui/switch.tsx`**

```tsx
'use client';

import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0'
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
```

- [ ] **Step 5 : Vérifier que `radix-ui` exporte bien `Switch`**

```bash
bun run lint
```

Expected : 0 erreur. Si TypeScript ne trouve pas `Switch` dans `radix-ui`, vérifier la version installée :

```bash
bun pm ls radix-ui
```

Si `Switch` n'est pas exporté à la racine du package, importer depuis le sous-module : `import * as SwitchPrimitive from '@radix-ui/react-switch'`. Le projet utilise déjà `radix-ui` à plat (cf. `separator.tsx`), donc ça devrait fonctionner identiquement.

- [ ] **Step 6 : Commit**

```bash
git add components/ui/input.tsx components/ui/textarea.tsx components/ui/label.tsx components/ui/switch.tsx
git commit -m "feat: add Input, Textarea, Label, Switch UI components"
```

---

## Task 3 — Mutations menu (couche pure, testable)

**Files:**

- Create: `lib/menu-mutations.ts`
- Test: `lib/menu-mutations.test.ts`

Cette couche encapsule toutes les opérations DB du menu. Pas d'auth ici — l'auth est dans les Server Actions. Tests via `vi.mock('@/lib/prisma')`.

- [ ] **Step 1 : Écrire le test pour `createCategory`**

Créer `lib/menu-mutations.test.ts` :

```ts
// lib/menu-mutations.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    menuCategory: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    product: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    supplementGroup: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        supplementGroup: { deleteMany: vi.fn() },
        product: { update: vi.fn() },
      })
    ),
  },
}));

import prisma from '@/lib/prisma';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryAvailability,
  moveCategory,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductAvailability,
  slugify,
} from './menu-mutations';

const mockCatCreate = prisma.menuCategory.create as MockedFunction<
  typeof prisma.menuCategory.create
>;
const mockCatUpdate = prisma.menuCategory.update as MockedFunction<
  typeof prisma.menuCategory.update
>;
const mockCatDelete = prisma.menuCategory.delete as MockedFunction<
  typeof prisma.menuCategory.delete
>;
const mockCatFindUnique = prisma.menuCategory.findUnique as MockedFunction<
  typeof prisma.menuCategory.findUnique
>;
const mockCatFindMany = prisma.menuCategory.findMany as MockedFunction<
  typeof prisma.menuCategory.findMany
>;
const mockProdCreate = prisma.product.create as MockedFunction<
  typeof prisma.product.create
>;
const mockProdUpdate = prisma.product.update as MockedFunction<
  typeof prisma.product.update
>;
const mockProdDelete = prisma.product.delete as MockedFunction<
  typeof prisma.product.delete
>;
const mockProdFindUnique = prisma.product.findUnique as MockedFunction<
  typeof prisma.product.findUnique
>;

describe('slugify', () => {
  it('met en minuscules et remplace les espaces par des tirets', () => {
    expect(slugify('Boissons Chaudes')).toBe('boissons-chaudes');
  });

  it('supprime les accents', () => {
    expect(slugify('Spécialités café')).toBe('specialites-cafe');
  });

  it('supprime les caractères non alphanumériques', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });
});

describe('createCategory', () => {
  beforeEach(() => vi.resetAllMocks());

  it('crée une catégorie avec slug auto-généré et sortOrder = nb existants', async () => {
    mockCatFindMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }] as never);
    mockCatCreate.mockResolvedValue({ id: 'new' } as never);

    await createCategory({ name: 'Pâtisseries' });

    expect(mockCatCreate).toHaveBeenCalledWith({
      data: { name: 'Pâtisseries', slug: 'patisseries', sortOrder: 2 },
    });
  });

  it('rejette si le nom est vide', async () => {
    await expect(createCategory({ name: '' })).rejects.toThrow();
    expect(mockCatCreate).not.toHaveBeenCalled();
  });
});

describe('updateCategory', () => {
  beforeEach(() => vi.resetAllMocks());

  it('met à jour le nom uniquement', async () => {
    mockCatUpdate.mockResolvedValue({} as never);
    await updateCategory('cat1', { name: 'Nouveau nom' });
    expect(mockCatUpdate).toHaveBeenCalledWith({
      where: { id: 'cat1' },
      data: { name: 'Nouveau nom' },
    });
  });
});

describe('deleteCategory', () => {
  beforeEach(() => vi.resetAllMocks());

  it("supprime la catégorie (cascade DB s'occupe des produits)", async () => {
    mockCatDelete.mockResolvedValue({} as never);
    await deleteCategory('cat1');
    expect(mockCatDelete).toHaveBeenCalledWith({ where: { id: 'cat1' } });
  });
});

describe('toggleCategoryAvailability', () => {
  beforeEach(() => vi.resetAllMocks());

  it('inverse la disponibilité', async () => {
    mockCatFindUnique.mockResolvedValue({ available: true } as never);
    mockCatUpdate.mockResolvedValue({} as never);
    await toggleCategoryAvailability('cat1');
    expect(mockCatUpdate).toHaveBeenCalledWith({
      where: { id: 'cat1' },
      data: { available: false },
    });
  });

  it("rejette si la catégorie n'existe pas", async () => {
    mockCatFindUnique.mockResolvedValue(null);
    await expect(toggleCategoryAvailability('x')).rejects.toThrow(
      'Catégorie introuvable'
    );
  });
});

describe('moveCategory', () => {
  beforeEach(() => vi.resetAllMocks());

  it('échange sortOrder avec la catégorie voisine vers le haut', async () => {
    mockCatFindMany.mockResolvedValue([
      { id: 'a', sortOrder: 0 },
      { id: 'b', sortOrder: 1 },
      { id: 'c', sortOrder: 2 },
    ] as never);
    mockCatUpdate.mockResolvedValue({} as never);

    await moveCategory('b', 'up');

    expect(mockCatUpdate).toHaveBeenCalledWith({
      where: { id: 'b' },
      data: { sortOrder: 0 },
    });
    expect(mockCatUpdate).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { sortOrder: 1 },
    });
  });

  it('ne fait rien si déjà en première position et direction "up"', async () => {
    mockCatFindMany.mockResolvedValue([
      { id: 'a', sortOrder: 0 },
      { id: 'b', sortOrder: 1 },
    ] as never);
    await moveCategory('a', 'up');
    expect(mockCatUpdate).not.toHaveBeenCalled();
  });

  it('échange avec le suivant pour direction "down"', async () => {
    mockCatFindMany.mockResolvedValue([
      { id: 'a', sortOrder: 0 },
      { id: 'b', sortOrder: 1 },
    ] as never);
    mockCatUpdate.mockResolvedValue({} as never);

    await moveCategory('a', 'down');

    expect(mockCatUpdate).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { sortOrder: 1 },
    });
    expect(mockCatUpdate).toHaveBeenCalledWith({
      where: { id: 'b' },
      data: { sortOrder: 0 },
    });
  });
});

describe('createProduct', () => {
  beforeEach(() => vi.resetAllMocks());

  it('crée un produit avec ses groupes de suppléments', async () => {
    mockProdCreate.mockResolvedValue({ id: 'p1' } as never);

    await createProduct({
      categoryId: 'cat1',
      name: 'Latte',
      description: 'Doux',
      price: 3500,
      imageUrl: 'https://blob.vercel.com/x.jpg',
      supplementGroups: [
        {
          name: 'Lait',
          type: 'single',
          required: false,
          options: [
            { name: 'Avoine', price: 500 },
            { name: 'Amande', price: 500 },
          ],
        },
      ],
    });

    expect(mockProdCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        categoryId: 'cat1',
        name: 'Latte',
        description: 'Doux',
        price: 3500,
        imageUrl: 'https://blob.vercel.com/x.jpg',
        sortOrder: expect.any(Number),
        supplementGroups: {
          create: [
            expect.objectContaining({
              name: 'Lait',
              type: 'single',
              required: false,
              sortOrder: 0,
              options: {
                create: [
                  { name: 'Avoine', price: 500 },
                  { name: 'Amande', price: 500 },
                ],
              },
            }),
          ],
        },
      }),
    });
  });

  it('rejette si nom vide', async () => {
    await expect(
      createProduct({
        categoryId: 'cat1',
        name: '',
        description: 'd',
        price: 100,
        supplementGroups: [],
      })
    ).rejects.toThrow();
  });

  it('rejette si prix négatif', async () => {
    await expect(
      createProduct({
        categoryId: 'cat1',
        name: 'X',
        description: 'd',
        price: -10,
        supplementGroups: [],
      })
    ).rejects.toThrow();
  });
});

describe('updateProduct', () => {
  beforeEach(() => vi.resetAllMocks());

  it('met à jour les champs scalaires', async () => {
    mockProdFindUnique.mockResolvedValue({ id: 'p1' } as never);
    await updateProduct('p1', {
      name: 'Renommé',
      description: 'Nouveau',
      price: 4000,
      imageUrl: null,
      supplementGroups: [],
    });

    // updateProduct appelle prisma.$transaction
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("rejette si le produit n'existe pas", async () => {
    mockProdFindUnique.mockResolvedValue(null);
    await expect(
      updateProduct('x', {
        name: 'X',
        description: 'd',
        price: 100,
        imageUrl: null,
        supplementGroups: [],
      })
    ).rejects.toThrow('Produit introuvable');
  });
});

describe('deleteProduct', () => {
  beforeEach(() => vi.resetAllMocks());

  it('supprime le produit', async () => {
    mockProdDelete.mockResolvedValue({} as never);
    await deleteProduct('p1');
    expect(mockProdDelete).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });
});

describe('toggleProductAvailability', () => {
  beforeEach(() => vi.resetAllMocks());

  it('inverse la disponibilité', async () => {
    mockProdFindUnique.mockResolvedValue({ available: true } as never);
    mockProdUpdate.mockResolvedValue({} as never);
    await toggleProductAvailability('p1');
    expect(mockProdUpdate).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { available: false },
    });
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
bun run test lib/menu-mutations.test.ts
```

Expected : FAIL avec "Cannot find module './menu-mutations'".

- [ ] **Step 3 : Créer `lib/menu-mutations.ts`**

```ts
// lib/menu-mutations.ts
import { z } from 'zod';
import prisma from '@/lib/prisma';

// ─── Slugify ──────────────────────────────────────────────────────────────────

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── Schémas Zod ──────────────────────────────────────────────────────────────

const supplementOptionSchema = z.object({
  name: z.string().min(1).max(80),
  price: z.number().int().nonnegative(),
});

const supplementGroupSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(['single', 'multiple']),
  required: z.boolean(),
  options: z.array(supplementOptionSchema),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(80),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(80),
});

export const productInputSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  price: z.number().int().nonnegative(),
  imageUrl: z.string().url().nullable().optional(),
  supplementGroups: z.array(supplementGroupSchema),
});

export const productUpdateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  price: z.number().int().nonnegative(),
  imageUrl: z.string().url().nullable(),
  supplementGroups: z.array(supplementGroupSchema),
});

// ─── Catégories ───────────────────────────────────────────────────────────────

export async function createCategory(input: { name: string }) {
  const { name } = createCategorySchema.parse(input);
  const existing = await prisma.menuCategory.findMany({ select: { id: true } });
  return prisma.menuCategory.create({
    data: { name, slug: slugify(name), sortOrder: existing.length },
  });
}

export async function updateCategory(id: string, input: { name: string }) {
  const { name } = updateCategorySchema.parse(input);
  return prisma.menuCategory.update({ where: { id }, data: { name } });
}

export async function deleteCategory(id: string) {
  return prisma.menuCategory.delete({ where: { id } });
}

export async function toggleCategoryAvailability(id: string) {
  const cat = await prisma.menuCategory.findUnique({ where: { id } });
  if (!cat) throw new Error('Catégorie introuvable');
  return prisma.menuCategory.update({
    where: { id },
    data: { available: !cat.available },
  });
}

export async function moveCategory(id: string, direction: 'up' | 'down') {
  const all = await prisma.menuCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true },
  });
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('Catégorie introuvable');
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) return;

  const a = all[idx];
  const b = all[swapIdx];
  await prisma.menuCategory.update({
    where: { id: a.id },
    data: { sortOrder: b.sortOrder },
  });
  await prisma.menuCategory.update({
    where: { id: b.id },
    data: { sortOrder: a.sortOrder },
  });
}

// ─── Produits ─────────────────────────────────────────────────────────────────

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductUpdate = z.infer<typeof productUpdateSchema>;

export async function createProduct(input: ProductInput) {
  const data = productInputSchema.parse(input);
  const existing =
    (await prisma.product.findMany?.({
      where: { categoryId: data.categoryId },
      select: { id: true },
    })) ?? [];
  return prisma.product.create({
    data: {
      categoryId: data.categoryId,
      name: data.name,
      description: data.description,
      price: data.price,
      imageUrl: data.imageUrl ?? null,
      sortOrder: Array.isArray(existing) ? existing.length : 0,
      supplementGroups: {
        create: data.supplementGroups.map((g, gi) => ({
          name: g.name,
          type: g.type,
          required: g.required,
          sortOrder: gi,
          options: {
            create: g.options.map((o) => ({ name: o.name, price: o.price })),
          },
        })),
      },
    },
  });
}

export async function updateProduct(id: string, input: ProductUpdate) {
  const data = productUpdateSchema.parse(input);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new Error('Produit introuvable');

  return prisma.$transaction(async (tx) => {
    await tx.supplementGroup.deleteMany({ where: { productId: id } });
    return tx.product.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        imageUrl: data.imageUrl,
        supplementGroups: {
          create: data.supplementGroups.map((g, gi) => ({
            name: g.name,
            type: g.type,
            required: g.required,
            sortOrder: gi,
            options: {
              create: g.options.map((o) => ({ name: o.name, price: o.price })),
            },
          })),
        },
      },
    });
  });
}

export async function deleteProduct(id: string) {
  return prisma.product.delete({ where: { id } });
}

export async function toggleProductAvailability(id: string) {
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) throw new Error('Produit introuvable');
  return prisma.product.update({
    where: { id },
    data: { available: !p.available },
  });
}
```

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

```bash
bun run test lib/menu-mutations.test.ts
```

Expected : tous les tests PASS. Si certains tests échouent à cause du mock `findMany` (createProduct attend `prisma.product.findMany` qui n'est pas mocké) — ajouter le mock manquant :

Dans le `vi.mock('@/lib/prisma', ...)` du fichier de test, ajouter `findMany: vi.fn().mockResolvedValue([])` dans le bloc `product`.

- [ ] **Step 5 : Re-vérifier**

```bash
bun run test lib/menu-mutations.test.ts
```

Expected : tous les tests PASS.

- [ ] **Step 6 : Commit**

```bash
git add lib/menu-mutations.ts lib/menu-mutations.test.ts
git commit -m "feat: add menu mutations layer (create/update/delete/toggle for categories and products)"
```

---

## Task 4 — Server Actions wrapper (auth + revalidate)

**Files:**

- Create: `app/(dashboard)/dashboard/menu/actions.ts`
- Test: `app/(dashboard)/dashboard/menu/actions.test.ts`

Chaque action vérifie la session admin, appelle la mutation correspondante puis invalide les chemins concernés.

- [ ] **Step 1 : Écrire les tests**

Créer `app/(dashboard)/dashboard/menu/actions.test.ts` :

```ts
// app/(dashboard)/dashboard/menu/actions.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock('@/lib/menu-mutations', () => ({
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  toggleCategoryAvailability: vi.fn(),
  moveCategory: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  toggleProductAvailability: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import * as mutations from '@/lib/menu-mutations';
import {
  createCategoryAction,
  toggleCategoryAvailabilityAction,
  deleteCategoryAction,
  createProductAction,
  toggleProductAvailabilityAction,
  deleteProductAction,
} from './actions';

const mockGetSession = auth.api.getSession as MockedFunction<
  typeof auth.api.getSession
>;
const mockRevalidate = revalidatePath as MockedFunction<typeof revalidatePath>;

const adminSession = {
  user: { role: 'ADMIN', id: 'u1', email: 'admin@eba.ci' },
  session: {},
} as never;

describe('Menu Server Actions — auth gate', () => {
  beforeEach(() => vi.resetAllMocks());

  it('createCategoryAction sans session → throw', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(createCategoryAction({ name: 'X' })).rejects.toThrow(
      'Non autorisé'
    );
    expect(mutations.createCategory).not.toHaveBeenCalled();
  });

  it('createCategoryAction avec session USER → throw', async () => {
    mockGetSession.mockResolvedValue({
      user: { role: 'USER', id: 'u1' },
      session: {},
    } as never);
    await expect(createCategoryAction({ name: 'X' })).rejects.toThrow(
      'Non autorisé'
    );
  });

  it('toggleCategoryAvailabilityAction sans session → throw', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(toggleCategoryAvailabilityAction('cat1')).rejects.toThrow(
      'Non autorisé'
    );
  });

  it('createProductAction sans session → throw', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(
      createProductAction({
        categoryId: 'c',
        name: 'X',
        description: 'd',
        price: 100,
        imageUrl: null,
        supplementGroups: [],
      })
    ).rejects.toThrow('Non autorisé');
  });
});

describe('Menu Server Actions — happy path + revalidate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetSession.mockResolvedValue(adminSession);
  });

  it('createCategoryAction appelle mutation puis revalide /api/menu et /carte', async () => {
    await createCategoryAction({ name: 'Pâtisseries' });
    expect(mutations.createCategory).toHaveBeenCalledWith({
      name: 'Pâtisseries',
    });
    expect(mockRevalidate).toHaveBeenCalledWith('/api/menu');
    expect(mockRevalidate).toHaveBeenCalledWith('/carte');
  });

  it('toggleCategoryAvailabilityAction → mutation + revalidate', async () => {
    await toggleCategoryAvailabilityAction('cat1');
    expect(mutations.toggleCategoryAvailability).toHaveBeenCalledWith('cat1');
    expect(mockRevalidate).toHaveBeenCalledWith('/api/menu');
  });

  it('deleteCategoryAction → mutation + revalidate', async () => {
    await deleteCategoryAction('cat1');
    expect(mutations.deleteCategory).toHaveBeenCalledWith('cat1');
    expect(mockRevalidate).toHaveBeenCalledWith('/api/menu');
  });

  it('createProductAction → mutation + revalidate', async () => {
    const input = {
      categoryId: 'cat1',
      name: 'Latte',
      description: 'd',
      price: 3500,
      imageUrl: 'https://blob.vercel.com/x.jpg',
      supplementGroups: [],
    };
    await createProductAction(input);
    expect(mutations.createProduct).toHaveBeenCalledWith(input);
    expect(mockRevalidate).toHaveBeenCalledWith('/api/menu');
  });

  it('toggleProductAvailabilityAction → mutation + revalidate', async () => {
    await toggleProductAvailabilityAction('p1');
    expect(mutations.toggleProductAvailability).toHaveBeenCalledWith('p1');
    expect(mockRevalidate).toHaveBeenCalledWith('/api/menu');
  });

  it('deleteProductAction → mutation + revalidate', async () => {
    await deleteProductAction('p1');
    expect(mutations.deleteProduct).toHaveBeenCalledWith('p1');
    expect(mockRevalidate).toHaveBeenCalledWith('/api/menu');
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
bun run test "app/(dashboard)/dashboard/menu/actions.test.ts"
```

Expected : FAIL avec "Cannot find module './actions'".

- [ ] **Step 3 : Créer `app/(dashboard)/dashboard/menu/actions.ts`**

```ts
'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import * as menu from '@/lib/menu-mutations';
import type { ProductInput, ProductUpdate } from '@/lib/menu-mutations';

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== 'ADMIN') {
    throw new Error('Non autorisé');
  }
}

function revalidateMenu() {
  revalidatePath('/api/menu');
  revalidatePath('/carte');
}

// ── Catégories ──

export async function createCategoryAction(input: { name: string }) {
  await requireAdmin();
  await menu.createCategory(input);
  revalidateMenu();
}

export async function updateCategoryAction(
  id: string,
  input: { name: string }
) {
  await requireAdmin();
  await menu.updateCategory(id, input);
  revalidateMenu();
}

export async function deleteCategoryAction(id: string) {
  await requireAdmin();
  await menu.deleteCategory(id);
  revalidateMenu();
}

export async function toggleCategoryAvailabilityAction(id: string) {
  await requireAdmin();
  await menu.toggleCategoryAvailability(id);
  revalidateMenu();
}

export async function moveCategoryAction(id: string, direction: 'up' | 'down') {
  await requireAdmin();
  await menu.moveCategory(id, direction);
  revalidateMenu();
}

// ── Produits ──

export async function createProductAction(input: ProductInput) {
  await requireAdmin();
  await menu.createProduct(input);
  revalidateMenu();
}

export async function updateProductAction(id: string, input: ProductUpdate) {
  await requireAdmin();
  await menu.updateProduct(id, input);
  revalidateMenu();
}

export async function deleteProductAction(id: string) {
  await requireAdmin();
  await menu.deleteProduct(id);
  revalidateMenu();
}

export async function toggleProductAvailabilityAction(id: string) {
  await requireAdmin();
  await menu.toggleProductAvailability(id);
  revalidateMenu();
}
```

- [ ] **Step 4 : Lancer les tests**

```bash
bun run test "app/(dashboard)/dashboard/menu/actions.test.ts"
```

Expected : tous les tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add "app/(dashboard)/dashboard/menu/actions.ts" "app/(dashboard)/dashboard/menu/actions.test.ts"
git commit -m "feat: add menu server actions with admin guard and cache revalidation"
```

---

## Task 5 — Route upload `/api/upload`

**Files:**

- Create: `app/api/upload/route.ts`
- Test: `app/api/upload/route.test.ts`

Validation : taille ≤ 5 MB, MIME ∈ {image/jpeg, image/png, image/webp}, session admin.

- [ ] **Step 1 : Écrire les tests**

Créer `app/api/upload/route.test.ts` :

```ts
// app/api/upload/route.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { put } from '@vercel/blob';
import { POST } from './route';

const mockGetSession = auth.api.getSession as MockedFunction<
  typeof auth.api.getSession
>;
const mockPut = put as MockedFunction<typeof put>;

const adminSession = {
  user: { role: 'ADMIN', id: 'u1', email: 'admin@eba.ci' },
  session: {},
} as never;

function makeRequest(file: File): Request {
  const fd = new FormData();
  fd.append('file', file);
  return new Request('http://localhost/api/upload', {
    method: 'POST',
    body: fd,
  });
}

describe('POST /api/upload', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 si pas de session', async () => {
    mockGetSession.mockResolvedValue(null);
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'a.jpg', {
      type: 'image/jpeg',
    });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(401);
  });

  it('401 si session USER', async () => {
    mockGetSession.mockResolvedValue({
      user: { role: 'USER', id: 'u1' },
      session: {},
    } as never);
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'a.jpg', {
      type: 'image/jpeg',
    });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(401);
  });

  it('400 si pas de fichier', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    const fd = new FormData();
    const req = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: fd,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('400 si MIME non supporté (PDF)', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    const file = new File(
      [new Uint8Array([0x25, 0x50, 0x44, 0x46])],
      'doc.pdf',
      {
        type: 'application/pdf',
      }
    );
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(400);
  });

  it('400 si fichier > 5 MB', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    const file = new File([big], 'big.jpg', { type: 'image/jpeg' });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(400);
  });

  it('200 + URL pour JPEG valide', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockPut.mockResolvedValue({
      url: 'https://blob.vercel.com/abc.jpg',
    } as never);

    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'pic.jpg', {
      type: 'image/jpeg',
    });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe('https://blob.vercel.com/abc.jpg');
    expect(mockPut).toHaveBeenCalled();
  });

  it('accepte PNG et WebP', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockPut.mockResolvedValue({ url: 'https://blob.vercel.com/x' } as never);

    const png = new File([new Uint8Array([0x89, 0x50])], 'a.png', {
      type: 'image/png',
    });
    expect((await POST(makeRequest(png))).status).toBe(200);

    const webp = new File([new Uint8Array([0x52])], 'a.webp', {
      type: 'image/webp',
    });
    expect((await POST(makeRequest(webp))).status).toBe(200);
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
bun run test "app/api/upload/route.test.ts"
```

Expected : FAIL avec "Cannot find module './route'".

- [ ] **Step 3 : Créer `app/api/upload/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
  }
  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json(
      { error: 'Format non supporté (JPEG, PNG, WebP uniquement)' },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'Fichier trop volumineux (max 5 MB)' },
      { status: 400 }
    );
  }

  const ext =
    file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
  const filename = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const blob = await put(filename, file, {
    access: 'public',
    contentType: file.type,
  });

  return NextResponse.json({ url: blob.url });
}
```

- [ ] **Step 4 : Lancer les tests**

```bash
bun run test "app/api/upload/route.test.ts"
```

Expected : tous les tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add "app/api/upload/route.ts" "app/api/upload/route.test.ts"
git commit -m "feat: add POST /api/upload route with Vercel Blob and admin guard"
```

---

## Task 6 — Page Catégories : liste + form création + actions par ligne

**Files:**

- Create: `app/(dashboard)/dashboard/menu/page.tsx`
- Create: `app/(dashboard)/dashboard/menu/category-form.tsx`
- Create: `app/(dashboard)/dashboard/menu/category-row-actions.tsx`

- [ ] **Step 1 : Créer le formulaire de création (Client Component)**

Créer `app/(dashboard)/dashboard/menu/category-form.tsx` :

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createCategoryAction } from './actions';

export function CategoryForm() {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createCategoryAction({ name });
        setName('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex-1 space-y-1">
        <Input
          placeholder="Nom de la nouvelle catégorie"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <Button type="submit" disabled={isPending || name.trim().length === 0}>
        {isPending ? 'Ajout…' : 'Ajouter'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2 : Créer les actions par ligne (Client Component)**

Créer `app/(dashboard)/dashboard/menu/category-row-actions.tsx` :

```tsx
'use client';

import { useTransition } from 'react';
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  toggleCategoryAvailabilityAction,
  moveCategoryAction,
  deleteCategoryAction,
} from './actions';

export function CategoryRowActions({
  id,
  available,
  isFirst,
  isLast,
}: {
  id: string;
  available: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={available}
        disabled={isPending}
        onCheckedChange={() =>
          startTransition(() => toggleCategoryAvailabilityAction(id))
        }
        aria-label="Disponibilité"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending || isFirst}
        onClick={() => startTransition(() => moveCategoryAction(id, 'up'))}
        aria-label="Monter"
      >
        <ChevronUp className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending || isLast}
        onClick={() => startTransition(() => moveCategoryAction(id, 'down'))}
        aria-label="Descendre"
      >
        <ChevronDown className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        onClick={() => {
          if (
            confirm(
              'Supprimer cette catégorie ? Tous ses produits seront aussi supprimés.'
            )
          ) {
            startTransition(() => deleteCategoryAction(id));
          }
        }}
        aria-label="Supprimer"
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 3 : Créer la page Server Component**

Créer `app/(dashboard)/dashboard/menu/page.tsx` :

```tsx
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CategoryForm } from './category-form';
import { CategoryRowActions } from './category-row-actions';

export default async function MenuPage() {
  const categories = await prisma.menuCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Menu — Catégories</h1>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-semibold">
          Ajouter une nouvelle catégorie
        </h2>
        <CategoryForm />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Produits</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((cat, idx) => (
            <TableRow key={cat.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/dashboard/menu/${cat.id}`}
                  className="hover:underline"
                >
                  {cat.name}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {cat.slug}
              </TableCell>
              <TableCell>{cat._count.products}</TableCell>
              <TableCell>
                <Badge variant={cat.available ? 'default' : 'outline'}>
                  {cat.available ? 'Visible' : 'Masquée'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/dashboard/menu/${cat.id}`}>Produits →</Link>
                  </Button>
                  <CategoryRowActions
                    id={cat.id}
                    available={cat.available}
                    isFirst={idx === 0}
                    isLast={idx === categories.length - 1}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {categories.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                Aucune catégorie. Créez-en une ci-dessus.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 4 : Vérifier le typecheck et le lint**

```bash
bun run lint
```

Expected : 0 erreur. Si l'icône `Trash2`, `ChevronUp`, `ChevronDown` n'est pas trouvée — vérifier que `lucide-react` est bien installé (présent dans `package.json` à la ligne 38).

- [ ] **Step 5 : Démarrer le dev server et tester manuellement**

```bash
bun dev
```

Aller sur `http://localhost:3000/dashboard/menu`. En tant qu'admin, vérifier :

- Le formulaire de création apparaît
- La liste des catégories existantes (issues du seed) apparaît
- Cliquer sur le toggle d'une catégorie → la page recharge et le badge change
- Cliquer sur ▲▼ → l'ordre change
- Le bouton supprimer demande confirmation

Arrêter le dev server (Ctrl+C).

- [ ] **Step 6 : Commit**

```bash
git add "app/(dashboard)/dashboard/menu/page.tsx" "app/(dashboard)/dashboard/menu/category-form.tsx" "app/(dashboard)/dashboard/menu/category-row-actions.tsx"
git commit -m "feat: add categories list page with create form, toggle, reorder, delete"
```

---

## Task 7 — Page Produits par catégorie : liste + actions

**Files:**

- Create: `app/(dashboard)/dashboard/menu/[categoryId]/page.tsx`
- Create: `app/(dashboard)/dashboard/menu/[categoryId]/product-row-actions.tsx`

- [ ] **Step 1 : Créer les actions de ligne produit (Client Component)**

Créer `app/(dashboard)/dashboard/menu/[categoryId]/product-row-actions.tsx` :

```tsx
'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  toggleProductAvailabilityAction,
  deleteProductAction,
} from '../actions';

export function ProductRowActions({
  id,
  available,
}: {
  id: string;
  available: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={available}
        disabled={isPending}
        onCheckedChange={() =>
          startTransition(() => toggleProductAvailabilityAction(id))
        }
        aria-label="Disponibilité"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        onClick={() => {
          if (confirm('Supprimer ce produit ?')) {
            startTransition(() => deleteProductAction(id));
          }
        }}
        aria-label="Supprimer"
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2 : Créer la page Server Component**

Créer `app/(dashboard)/dashboard/menu/[categoryId]/page.tsx` :

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import prisma from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ProductRowActions } from './product-row-actions';

export default async function CategoryProductsPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;

  const category = await prisma.menuCategory.findUnique({
    where: { id: categoryId },
    include: {
      products: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          price: true,
          imageUrl: true,
          available: true,
        },
      },
    },
  });

  if (!category) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
          <Link href="/dashboard/menu">← Catégories</Link>
        </Button>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{category.name}</h1>
          <Button asChild>
            <Link href={`/dashboard/menu/${categoryId}/produits/new`}>
              + Nouveau produit
            </Link>
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Image</TableHead>
            <TableHead>Nom</TableHead>
            <TableHead>Prix</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {category.products.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                {p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
                    alt={p.name}
                    width={48}
                    height={48}
                    className="size-12 rounded-md object-cover"
                  />
                ) : (
                  <div className="size-12 rounded-md bg-muted" />
                )}
              </TableCell>
              <TableCell className="font-medium">
                <Link
                  href={`/dashboard/menu/${categoryId}/produits/${p.id}`}
                  className="hover:underline"
                >
                  {p.name}
                </Link>
              </TableCell>
              <TableCell>
                {new Intl.NumberFormat('fr-FR').format(p.price)} FCFA
              </TableCell>
              <TableCell>
                <Badge variant={p.available ? 'default' : 'outline'}>
                  {p.available ? 'Visible' : 'Masqué'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link
                      href={`/dashboard/menu/${categoryId}/produits/${p.id}`}
                    >
                      Modifier
                    </Link>
                  </Button>
                  <ProductRowActions id={p.id} available={p.available} />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {category.products.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                Aucun produit dans cette catégorie.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3 : Configurer next.config pour les images Vercel Blob**

Vérifier `next.config.ts` (ou `next.config.js`) au root du projet — `next/image` a besoin d'autoriser le domaine `blob.vercel-storage.com`.

```bash
ls next.config*
```

Si le fichier existe, ajouter dans la section `images.remotePatterns` :

```ts
{
  protocol: 'https',
  hostname: '*.public.blob.vercel-storage.com',
}
```

S'il n'existe pas, le créer (`next.config.ts`) :

```ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
};

export default config;
```

- [ ] **Step 4 : Vérifier lint**

```bash
bun run lint
```

Expected : 0 erreur.

- [ ] **Step 5 : Tester manuellement**

```bash
bun dev
```

Aller sur `http://localhost:3000/dashboard/menu/<categoryId>` (cliquer depuis la liste des catégories). Vérifier que les produits apparaissent avec image / placeholder, prix, statut. Tester toggle et delete. Arrêter le dev server.

- [ ] **Step 6 : Commit**

```bash
git add "app/(dashboard)/dashboard/menu/[categoryId]/page.tsx" "app/(dashboard)/dashboard/menu/[categoryId]/product-row-actions.tsx" next.config.*
git commit -m "feat: add category products page with toggle and delete"
```

---

## Task 8 — Formulaire produit (Client Component partagé)

**Files:**

- Create: `app/(dashboard)/dashboard/menu/[categoryId]/produits/product-form.tsx`

Ce composant gère création ET édition. Il accepte un produit initial optionnel et appelle l'action correspondante. L'upload d'image est inline via `fetch('/api/upload')`.

- [ ] **Step 1 : Créer le formulaire**

Créer `app/(dashboard)/dashboard/menu/[categoryId]/produits/product-form.tsx` :

```tsx
'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createProductAction, updateProductAction } from '../../actions';

type SupplementOption = { name: string; price: number };
type SupplementGroup = {
  name: string;
  type: 'single' | 'multiple';
  required: boolean;
  options: SupplementOption[];
};

export type ProductFormInitial = {
  id?: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  supplementGroups: SupplementGroup[];
};

const EMPTY: ProductFormInitial = {
  name: '',
  description: '',
  price: 0,
  imageUrl: null,
  supplementGroups: [],
};

export function ProductForm({
  categoryId,
  initial,
}: {
  categoryId: string;
  initial?: ProductFormInitial;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [name, setName] = useState(initial?.name ?? EMPTY.name);
  const [description, setDescription] = useState(
    initial?.description ?? EMPTY.description
  );
  const [price, setPrice] = useState<number>(initial?.price ?? EMPTY.price);
  const [imageUrl, setImageUrl] = useState<string | null>(
    initial?.imageUrl ?? null
  );
  const [groups, setGroups] = useState<SupplementGroup[]>(
    initial?.supplementGroups ?? []
  );

  const isEdit = Boolean(initial?.id);

  async function handleFile(file: File) {
    setUploadError(null);
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Erreur ${res.status}`);
      }
      const { url } = (await res.json()) as { url: string };
      setImageUrl(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erreur upload');
    } finally {
      setIsUploading(false);
    }
  }

  function addGroup() {
    setGroups([
      ...groups,
      { name: '', type: 'single', required: false, options: [] },
    ]);
  }
  function removeGroup(gi: number) {
    setGroups(groups.filter((_, i) => i !== gi));
  }
  function updateGroup(gi: number, patch: Partial<SupplementGroup>) {
    setGroups(groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  }
  function addOption(gi: number) {
    updateGroup(gi, {
      options: [...groups[gi].options, { name: '', price: 0 }],
    });
  }
  function removeOption(gi: number, oi: number) {
    updateGroup(gi, {
      options: groups[gi].options.filter((_, i) => i !== oi),
    });
  }
  function updateOption(
    gi: number,
    oi: number,
    patch: Partial<SupplementOption>
  ) {
    updateGroup(gi, {
      options: groups[gi].options.map((o, i) =>
        i === oi ? { ...o, ...patch } : o
      ),
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    startTransition(async () => {
      try {
        const payload = {
          name: name.trim(),
          description: description.trim(),
          price: Number(price) || 0,
          imageUrl,
          supplementGroups: groups.map((g) => ({
            ...g,
            options: g.options.filter((o) => o.name.trim().length > 0),
          })),
        };
        if (isEdit && initial?.id) {
          await updateProductAction(initial.id, payload);
        } else {
          await createProductAction({ ...payload, categoryId });
        }
        router.push(`/dashboard/menu/${categoryId}`);
        router.refresh();
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Erreur');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="price">Prix (FCFA)</Label>
            <Input
              id="price"
              type="number"
              min={0}
              step={100}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              required
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Image</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {imageUrl && (
            <Image
              src={imageUrl}
              alt="Aperçu"
              width={160}
              height={160}
              className="size-40 rounded-md object-cover"
            />
          )}
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={isUploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          {isUploading && (
            <p className="text-xs text-muted-foreground">Upload en cours…</p>
          )}
          {uploadError && (
            <p className="text-xs text-destructive">{uploadError}</p>
          )}
          {imageUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setImageUrl(null)}
            >
              Retirer l&apos;image
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Groupes de suppléments</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addGroup}
            >
              <Plus className="mr-1 size-3" /> Ajouter un groupe
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucun groupe de suppléments.
            </p>
          )}
          {groups.map((g, gi) => (
            <div key={gi} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label>Nom du groupe</Label>
                  <Input
                    value={g.name}
                    onChange={(e) => updateGroup(gi, { name: e.target.value })}
                    placeholder="ex: Choix du lait"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <select
                    value={g.type}
                    onChange={(e) =>
                      updateGroup(gi, {
                        type: e.target.value as 'single' | 'multiple',
                      })
                    }
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="single">Choix unique</option>
                    <option value="multiple">Choix multiples</option>
                  </select>
                </div>
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={g.required}
                    onChange={(e) =>
                      updateGroup(gi, { required: e.target.checked })
                    }
                  />
                  Requis
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeGroup(gi)}
                  aria-label="Supprimer le groupe"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Options</Label>
                {g.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <Input
                      placeholder="Nom"
                      value={o.name}
                      onChange={(e) =>
                        updateOption(gi, oi, { name: e.target.value })
                      }
                    />
                    <Input
                      type="number"
                      placeholder="Prix"
                      min={0}
                      step={100}
                      value={o.price}
                      onChange={(e) =>
                        updateOption(gi, oi, {
                          price: Number(e.target.value),
                        })
                      }
                      className="w-32"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeOption(gi, oi)}
                      aria-label="Supprimer l'option"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addOption(gi)}
                >
                  <Plus className="mr-1 size-3" /> Ajouter une option
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending || isUploading}>
          {isPending
            ? 'Enregistrement…'
            : isEdit
              ? 'Enregistrer'
              : 'Créer le produit'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/dashboard/menu/${categoryId}`)}
          disabled={isPending}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2 : Vérifier lint**

```bash
bun run lint
```

Expected : 0 erreur.

- [ ] **Step 3 : Commit**

```bash
git add "app/(dashboard)/dashboard/menu/[categoryId]/produits/product-form.tsx"
git commit -m "feat: add product form component with image upload and dynamic supplement groups"
```

---

## Task 9 — Page création produit

**Files:**

- Create: `app/(dashboard)/dashboard/menu/[categoryId]/produits/new/page.tsx`

- [ ] **Step 1 : Créer la page**

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { ProductForm } from '../product-form';

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  const category = await prisma.menuCategory.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true },
  });
  if (!category) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
          <Link href={`/dashboard/menu/${categoryId}`}>← {category.name}</Link>
        </Button>
        <h1 className="text-2xl font-bold">Nouveau produit</h1>
      </div>
      <ProductForm categoryId={categoryId} />
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier lint**

```bash
bun run lint
```

Expected : 0 erreur.

- [ ] **Step 3 : Tester manuellement**

```bash
bun dev
```

Sur `/dashboard/menu/<id>` cliquer "+ Nouveau produit". Remplir le formulaire :

- Nom : "Test produit"
- Description : "Test"
- Prix : 1000
- Uploader une image JPEG (< 5 MB)
- Ajouter un groupe de suppléments avec 2 options
- Submit → doit rediriger vers la liste des produits avec le nouveau produit visible

Arrêter le dev server.

- [ ] **Step 4 : Commit**

```bash
git add "app/(dashboard)/dashboard/menu/[categoryId]/produits/new/page.tsx"
git commit -m "feat: add new product page"
```

---

## Task 10 — Page édition produit

**Files:**

- Create: `app/(dashboard)/dashboard/menu/[categoryId]/produits/[productId]/page.tsx`

- [ ] **Step 1 : Créer la page**

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { ProductForm, type ProductFormInitial } from '../product-form';

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ categoryId: string; productId: string }>;
}) {
  const { categoryId, productId } = await params;

  const [category, product] = await Promise.all([
    prisma.menuCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true },
    }),
    prisma.product.findUnique({
      where: { id: productId },
      include: {
        supplementGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { options: true },
        },
      },
    }),
  ]);

  if (!category || !product || product.categoryId !== categoryId) {
    notFound();
  }

  const initial: ProductFormInitial = {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    imageUrl: product.imageUrl,
    supplementGroups: product.supplementGroups.map((g) => ({
      name: g.name,
      type: g.type as 'single' | 'multiple',
      required: g.required,
      options: g.options.map((o) => ({ name: o.name, price: o.price })),
    })),
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
          <Link href={`/dashboard/menu/${categoryId}`}>← {category.name}</Link>
        </Button>
        <h1 className="text-2xl font-bold">Modifier {product.name}</h1>
      </div>
      <ProductForm categoryId={categoryId} initial={initial} />
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier lint**

```bash
bun run lint
```

Expected : 0 erreur.

- [ ] **Step 3 : Tester manuellement le flux complet**

```bash
bun dev
```

Sur `/dashboard/menu/<catId>/produits/<id>` :

- Vérifier que les champs sont pré-remplis (nom, description, prix, image, groupes)
- Modifier le nom
- Ajouter un nouveau groupe de suppléments
- Submit → doit rediriger et le produit reflète les changements

Test final d'invalidation cache : sur la page publique `/carte`, vérifier que désactiver un produit (toggle dans dashboard) le masque immédiatement après refresh.

Arrêter le dev server.

- [ ] **Step 4 : Commit**

```bash
git add "app/(dashboard)/dashboard/menu/[categoryId]/produits/[productId]/page.tsx"
git commit -m "feat: add edit product page"
```

---

## Task 11 — Vérification finale + mise à jour de la spec

**Files:**

- Modify: `docs/superpowers/specs/2026-05-10-click-and-collect-design.md`

- [ ] **Step 1 : Lancer toute la suite de tests**

```bash
bun run test
```

Expected : tous les tests PASS, en particulier :

- `lib/menu-mutations.test.ts`
- `app/(dashboard)/dashboard/menu/actions.test.ts`
- `app/api/upload/route.test.ts`

Tests existants (commandes, orders, menu, etc.) doivent toujours passer.

- [ ] **Step 2 : Lancer le build production**

```bash
bun run build
```

Expected : build succeed sans erreur. Si erreur de typage `next/image` sur les URLs dynamiques, vérifier `next.config` (Task 7 Step 3).

- [ ] **Step 3 : Vérifier les acceptance criteria du spec F8**

Reprendre la liste TDD du spec :

- [ ] `createProduct` avec body valide → produit créé en DB ✅ (test Task 3)
- [ ] `createProduct` sans session admin → lève une erreur ✅ (test Task 4 — `createProductAction`)
- [ ] `updateProduct` met à jour uniquement les champs fournis ✅ (test Task 3 — note : on remplace tous les groupes, pas un patch partiel — c'est intentionnel pour simplifier)
- [ ] `deleteProduct` supprime le produit et ses groupes (cascade) ✅ (cascade DB)
- [ ] `POST /api/upload` JPEG valide → 200 + URL ✅ (Task 5)
- [ ] `POST /api/upload` > 5MB → 400 ✅
- [ ] `POST /api/upload` PDF → 400 ✅
- [ ] `POST /api/upload` sans session → 401 ✅
- [ ] Désactiver produit → masque immédiatement sur /api/menu ✅ (`revalidatePath('/api/menu')` dans `toggleProductAvailabilityAction`)
- [ ] Supprimer catégorie cascade-supprime ses produits ✅ (cascade Prisma `onDelete: Cascade`)

- [ ] **Step 4 : Mettre à jour le spec**

Ouvrir `docs/superpowers/specs/2026-05-10-click-and-collect-design.md` et passer la ligne F8 du tableau de statut de "⬜ À faire" à "✅ Terminé" :

```diff
-| 8   | Dashboard — Gestion du menu + images | ⬜ À faire |
+| 8   | Dashboard — Gestion du menu + images | ✅ Terminé |
```

- [ ] **Step 5 : Commit final**

```bash
git add docs/superpowers/specs/2026-05-10-click-and-collect-design.md
git commit -m "docs: mark F8 as done in click-and-collect spec"
```

- [ ] **Step 6 : Récapitulatif final**

Toutes les fonctionnalités F1–F8 du Click & Collect sont maintenant terminées. Le flux client (commande → confirmation → email) et le backoffice complet (auth, commandes, menu) sont opérationnels.

---

## Notes de sécurité et d'opérations

- `BLOB_READ_WRITE_TOKEN` doit être présent en production. Sur Vercel, il est créé automatiquement avec le store Blob.
- `ADMIN_EMAIL` contrôle qui devient admin au login Google. Une seule adresse admin pour l'instant.
- L'upload n'a pas de rate limit explicite — la borne 5 MB + auth admin est suffisante pour une équipe de 1-2 personnes.
- `config/menu.ts` peut maintenant être supprimé puisque le menu vient de la DB. **Décision déférée :** le supprimer dans un commit séparé après quelques jours en production, pour éviter de perdre la référence si un rollback DB est nécessaire.
