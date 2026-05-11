# Feature 3 — Page de confirmation — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer la page Server Component `/commande/[id]` qui affiche la confirmation de commande avec référence, prénom client, créneau de retrait formaté, articles (nom + suppléments + quantité + prix) et total en FCFA.

**Architecture:** La page est un Server Component async qui appelle `getOrder(id)` depuis `lib/orders.ts` (déjà implémentée et testée). Si l'ordre n'existe pas → `notFound()`. Une fonction utilitaire `formatPickupTime` dans `lib/format-order.ts` formate la date en français ("Dimanche 10 mai · 14h30"). La page exporte `metadata` statique avec `robots: noindex`.

**Tech Stack:** Vitest (globals: false — tous imports explicites), Next.js 16 App Router, React 19, Tailwind CSS v4, HeroUI, lucide-react, react-dom/server (pour les tests de rendu), Prisma mocké avec vi.mock

---

## Structure des fichiers

| Action | Fichier | Responsabilité |
| ------ | ------- | -------------- |
| Create | `lib/format-order.ts` | `formatPickupTime(date: Date): string` |
| Create | `lib/format-order.test.ts` | Tests unitaires du formatage de date |
| Create | `app/(public)/commande/[id]/page.tsx` | Server Component confirmation |
| Create | `app/(public)/commande/[id]/page.test.tsx` | Tests rendu + 404 + metadata |

---

## Task 1 — TDD : `lib/format-order.ts`

**Files:**
- Create: `lib/format-order.ts`
- Create: `lib/format-order.test.ts`

- [ ] **Step 1 : Créer le fichier de test**

```ts
// lib/format-order.test.ts
import { describe, it, expect } from 'vitest';
import { formatPickupTime } from './format-order';

describe('formatPickupTime', () => {
  it('formate en "Jour JJ mois · HHhMM" en français', () => {
    const date = new Date('2026-05-10T14:30:00');
    const result = formatPickupTime(date);
    // Doit correspondre au pattern : "Dimanche 10 mai · 14h30"
    expect(result).toMatch(/^[A-Z][a-z]+ \d{1,2} [a-z]+ · \d{2}h\d{2}$/);
  });

  it('capitalise la première lettre du nom du jour', () => {
    const date = new Date('2026-05-10T08:00:00');
    const result = formatPickupTime(date);
    expect(result[0]).toBe(result[0].toUpperCase());
    expect(result[1]).toBe(result[1].toLowerCase());
  });

  it('inclut le bon jour du mois', () => {
    const date = new Date('2026-05-10T14:30:00');
    const result = formatPickupTime(date);
    expect(result).toMatch(/ 10 /);
  });

  it('inclut "mai" pour le mois 5', () => {
    const date = new Date('2026-05-10T14:30:00');
    const result = formatPickupTime(date);
    expect(result).toContain('mai');
  });

  it('formate les heures et minutes à 2 chiffres', () => {
    const date = new Date('2026-05-10T09:00:00');
    const result = formatPickupTime(date);
    expect(result).toContain('09h00');
  });

  it('inclut le séparateur "·"', () => {
    const date = new Date('2026-05-10T14:30:00');
    const result = formatPickupTime(date);
    expect(result).toContain('·');
  });
});
```

- [ ] **Step 2 : Lancer les tests (ils doivent échouer)**

```bash
bun test lib/format-order.test.ts
```

Résultat attendu : `Cannot find module './format-order'`

- [ ] **Step 3 : Créer `lib/format-order.ts`**

```ts
// lib/format-order.ts
export function formatPickupTime(date: Date): string {
  const dayName = date.toLocaleDateString('fr-FR', { weekday: 'long' });
  const day = date.getDate();
  const monthName = date.toLocaleDateString('fr-FR', { month: 'long' });
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  return `${capitalizedDay} ${day} ${monthName} · ${hours}h${minutes}`;
}
```

- [ ] **Step 4 : Lancer les tests (ils doivent passer)**

```bash
bun test lib/format-order.test.ts
```

Résultat attendu :

```
✓ lib/format-order.test.ts (6)
  ✓ formatPickupTime > formate en "Jour JJ mois · HHhMM" en français
  ✓ formatPickupTime > capitalise la première lettre du nom du jour
  ✓ formatPickupTime > inclut le bon jour du mois
  ✓ formatPickupTime > inclut "mai" pour le mois 5
  ✓ formatPickupTime > formate les heures et minutes à 2 chiffres
  ✓ formatPickupTime > inclut le séparateur "·"

Test Files  1 passed (1)
Tests       6 passed (6)
```

- [ ] **Step 5 : Commit**

```bash
rtk git add lib/format-order.ts lib/format-order.test.ts && rtk git commit -m "feat: add formatPickupTime with TDD"
```

---

## Task 2 — TDD : `app/(public)/commande/[id]/page.tsx`

**Files:**
- Create: `app/(public)/commande/[id]/page.tsx`
- Create: `app/(public)/commande/[id]/page.test.tsx`

- [ ] **Step 1 : Créer le fichier de test**

```tsx
// app/(public)/commande/[id]/page.test.tsx
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

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => React.createElement('a', { href, ...props }, children),
}));

import prisma from '@/lib/prisma';
import Page, { metadata } from './page';

const mockFindUnique = prisma.order.findUnique as MockedFunction<
  typeof prisma.order.findUnique
>;

const mockOrder = {
  id: 'clorder123',
  reference: 'EBA-20260510-AB12',
  customerName: 'Kofi',
  customerPhone: '07001234',
  pickupTime: new Date('2026-05-10T14:30:00'),
  items: [
    {
      cartId: 'abc',
      productId: 'prod-1',
      productName: 'Cappuccino',
      basePrice: 3500,
      quantity: 2,
      supplements: [
        { groupName: 'Lait', optionName: 'Lait de soja', price: 500 },
      ],
    },
  ],
  total: 8000,
  status: 'PENDING' as const,
  note: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CommandePage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('affiche la référence correcte pour un id valide', async () => {
    mockFindUnique.mockResolvedValue(mockOrder);
    const element = await Page({ params: Promise.resolve({ id: 'clorder123' }) });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('EBA-20260510-AB12');
  });

  it('affiche le prénom et le téléphone du client', async () => {
    mockFindUnique.mockResolvedValue(mockOrder);
    const element = await Page({ params: Promise.resolve({ id: 'clorder123' }) });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('Kofi');
    expect(html).toContain('07001234');
  });

  it("affiche l'heure de retrait formatée", async () => {
    mockFindUnique.mockResolvedValue(mockOrder);
    const element = await Page({ params: Promise.resolve({ id: 'clorder123' }) });
    const html = renderToStaticMarkup(element);
    expect(html).toMatch(/[A-Z][a-z]+ 10 mai · 14h30/);
  });

  it('affiche la liste des articles avec suppléments', async () => {
    mockFindUnique.mockResolvedValue(mockOrder);
    const element = await Page({ params: Promise.resolve({ id: 'clorder123' }) });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('Cappuccino');
    expect(html).toContain('Lait de soja');
    expect(html).toContain('x2');
  });

  it('affiche le total formaté en FCFA', async () => {
    mockFindUnique.mockResolvedValue(mockOrder);
    const element = await Page({ params: Promise.resolve({ id: 'clorder123' }) });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('FCFA');
    // Intl.NumberFormat('fr-FR').format(8000) → "8 000" (espace fine ou espace insécable)
    expect(html).toMatch(/8.000/);
  });

  it("retourne 404 pour un id inexistant", async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(
      Page({ params: Promise.resolve({ id: 'inexistant' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('metadata', () => {
  it('a le titre "Commande confirmée — EBA Coffee Shop"', () => {
    expect(metadata.title).toBe('Commande confirmée — EBA Coffee Shop');
  });

  it('a les meta robots noindex', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
```

- [ ] **Step 2 : Lancer les tests (ils doivent échouer)**

```bash
bun test "app/(public)/commande/[id]/page.test.tsx"
```

Résultat attendu : `Cannot find module './page'`

- [ ] **Step 3 : Créer `app/(public)/commande/[id]/page.tsx`**

```tsx
// app/(public)/commande/[id]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { getOrder } from '@/lib/orders';
import { formatPickupTime } from '@/lib/format-order';
import { priceFormatter } from '@/config/menu';
import type { CartItem } from '@/lib/cart-store';

export const metadata: Metadata = {
  title: 'Commande confirmée — EBA Coffee Shop',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function CommandePage({ params }: Props) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) notFound();

  const items = order.items as CartItem[];
  const pickupFormatted = formatPickupTime(order.pickupTime);

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="flex flex-col items-center gap-6">
        <CheckCircle className="h-16 w-16 text-success" strokeWidth={1.5} />

        <div className="text-center">
          <h1 className="text-2xl font-bold">Commande confirmée&nbsp;!</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Bonjour {order.customerName}, votre commande a bien été enregistrée.
          </p>
        </div>

        <div className="w-full rounded-xl border border-foreground/10 bg-default-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/40">
            Référence
          </p>
          <p className="mt-1 font-mono text-lg font-bold tracking-wider text-primary">
            {order.reference}
          </p>

          <div className="mt-4 flex flex-col gap-1 text-sm">
            <p>
              <span className="text-foreground/50">Retrait&nbsp;:</span>{' '}
              {pickupFormatted}
            </p>
            <p>
              <span className="text-foreground/50">Téléphone&nbsp;:</span>{' '}
              {order.customerPhone}
            </p>
          </div>
        </div>

        <div className="w-full">
          <h2 className="mb-3 text-sm font-semibold">Articles</h2>
          <div className="flex flex-col gap-2">
            {items.map((item, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {item.productName}{' '}
                    <span className="text-foreground/50">x{item.quantity}</span>
                  </p>
                  {item.supplements.length > 0 && (
                    <p className="text-xs text-foreground/50">
                      {item.supplements.map((s) => s.optionName).join(', ')}
                    </p>
                  )}
                </div>
                <p className="shrink-0 font-medium">
                  {priceFormatter.format(
                    (item.basePrice +
                      item.supplements.reduce((s, sup) => s + sup.price, 0)) *
                      item.quantity
                  )}
                  &nbsp;F
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-between border-t border-foreground/10 pt-4 font-semibold">
            <span>Total</span>
            <span className="text-primary">
              {priceFormatter.format(order.total)}&nbsp;FCFA
            </span>
          </div>
        </div>

        <p className="text-center text-sm text-foreground/60">
          Présentez-vous au comptoir EBA Coffee Shop à l&apos;heure choisie.
          Paiement sur place en espèces ou mobile money.
        </p>

        <Link
          href="/carte"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          ← Retour à la carte
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 4 : Lancer les tests (ils doivent passer)**

```bash
bun test "app/(public)/commande/[id]/page.test.tsx"
```

Résultat attendu :

```
✓ app/(public)/commande/[id]/page.test.tsx (8)
  ✓ CommandePage > affiche la référence correcte pour un id valide
  ✓ CommandePage > affiche le prénom et le téléphone du client
  ✓ CommandePage > affiche l'heure de retrait formatée
  ✓ CommandePage > affiche la liste des articles avec suppléments
  ✓ CommandePage > affiche le total formaté en FCFA
  ✓ CommandePage > retourne 404 pour un id inexistant
  ✓ metadata > a le titre "Commande confirmée — EBA Coffee Shop"
  ✓ metadata > a les meta robots noindex

Test Files  1 passed (1)
Tests       8 passed (8)
```

- [ ] **Step 5 : Lancer tous les tests pour vérifier aucune régression**

```bash
bun test
```

Résultat attendu : tous les tests passent.

- [ ] **Step 6 : Vérifier le build TypeScript**

```bash
rtk tsc
```

Résultat attendu : aucune erreur TypeScript.

- [ ] **Step 7 : Commit**

```bash
rtk git add "app/(public)/commande/[id]/page.tsx" "app/(public)/commande/[id]/page.test.tsx" && rtk git commit -m "feat: add confirmation page /commande/[id] with TDD"
```

---

## Task 3 — Mettre à jour le statut dans la spec

**Files:**
- Modify: `docs/superpowers/specs/2026-05-10-click-and-collect-design.md`

- [ ] **Step 1 : Mettre à jour la table des statuts**

Dans `docs/superpowers/specs/2026-05-10-click-and-collect-design.md`, remplacer les 3 lignes de statut F1/F2/F3 par :

```
| 1   | Schéma & persistance commandes       | ✅ Terminé |
| 2   | Formulaire de retrait                | ✅ Terminé |
| 3   | Page de confirmation                 | ✅ Terminé |
```

- [ ] **Step 2 : Commit**

```bash
rtk git add docs/superpowers/specs/2026-05-10-click-and-collect-design.md && rtk git commit -m "docs: mark F1, F2, F3 as done in click-and-collect spec"
```

---

## Vérification manuelle (après implémentation)

Lancer le serveur de dev :

```bash
bun dev
```

**Scénario 1 — Flux complet depuis le panier :**

1. Aller sur `http://localhost:3000/carte`
2. Ajouter un article au panier → ouvrir CartDrawer → step 1
3. "Passer la commande" → step 2 → remplir prénom, téléphone, créneau
4. "Confirmer la commande" → redirect automatique vers `/commande/[id]`
5. Vérifier : référence visible, prénom, heure de retrait formatée en français, liste d'articles, total FCFA, message paiement

**Scénario 2 — 404 pour id inexistant :**

Naviguer vers `http://localhost:3000/commande/id-inexistant` → la page Not Found doit s'afficher.

**Scénario 3 — Bouton retour :**

Depuis `/commande/[id]`, cliquer "← Retour à la carte" → redirect vers `/carte`.

---

## Checklist spec (auto-review)

- [x] Route `app/(public)/commande/[id]/page.tsx` ✓ Task 2
- [x] Server Component, requête Prisma directe via `getOrder` ✓ Task 2
- [x] `id` inexistant → `notFound()` ✓ Task 2 + test
- [x] Icône succès (CheckCircle) ✓ Task 2
- [x] Titre "Commande confirmée !" ✓ Task 2
- [x] Référence `EBA-YYYYMMDD-XXXX` visible ✓ Task 2 + test
- [x] Prénom du client + heure de retrait formatée en français ✓ Task 1 + Task 2 + test
- [x] Récapitulatif articles (nom + suppléments + quantité + prix) ✓ Task 2 + test
- [x] Total formaté en FCFA ✓ Task 2 + test
- [x] Message paiement sur place (espèces ou mobile money) ✓ Task 2
- [x] Bouton retour vers `/carte` ✓ Task 2
- [x] `metadata.title` = "Commande confirmée — EBA Coffee Shop" ✓ Task 2 + test
- [x] `metadata.robots` = `{ index: false, follow: false }` ✓ Task 2 + test
