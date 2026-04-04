# EBA Coffee Shop — Site Improvements Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical gaps (dead links, broken data, missing metadata, lang attribute), build the missing `/carte` page, and polish existing pages for launch readiness.

**Architecture:** Next.js App Router with `app/(public)/` route group. Section components live in `components/(public)/<page-name>/`. Brand data centralized in `config/brand.config.ts`. Animations use GSAP (about page) or Framer Motion (all other pages). Styling via Tailwind CSS v4 + HeroUI.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, HeroUI, GSAP, Framer Motion, Prisma, Bun

---

## Priority 1 — Critical Fixes (broken stuff)

### Task 1: Fix `lang="en"` → `lang="fr"` in root layout

The site is entirely in French but `<html lang="en">` is set in the root layout.

**Files:**

- Modify: `app/layout.tsx:69`

- [ ] **Step 1: Fix the lang attribute**

```tsx
// line 69: change "en" to "fr"
<html lang="fr">
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "fix: set html lang attribute to fr"
```

---

### Task 2: Fix JSON-LD schema (wrong hours, missing Sunday, wrong phone)

`lib/json-ld.ts` says opens 10:00 / closes 18:00 and excludes Sunday. Config says 7h30–21h30 every day. Phone number in JSON-LD doesn't match config either.

**Files:**

- Modify: `lib/json-ld.ts`

- [ ] **Step 1: Fix the schema data**

```ts
import { ENV } from 'varlock/env';
import { brandConfig } from '@/config/brand.config';

const siteUrl = ENV.NEXT_PUBLIC_SITE_URL;

export const homeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CafeOrCoffeeShop',
  name: 'EBA Coffee Shop',
  image: `${siteUrl}/og/home-coffee.jpg`,
  url: siteUrl,
  telephone: brandConfig.location.phone,
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Boulevard Latrille',
    addressLocality: 'Cocody, Abidjan',
    addressCountry: 'CI',
  },
  priceRange: '$$',
  servesCuisine: ['Coffee', 'Brunch', 'Desserts', 'Pastries', 'Snacks'],
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      opens: '07:30',
      closes: '21:30',
    },
  ],
};
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add lib/json-ld.ts
git commit -m "fix: correct JSON-LD hours, phone and add address schema"
```

---

### Task 3: Add missing page metadata (about, le-lieu)

About and Le Lieu pages inherit the generic title template but have no `description` or `title` override. Contact already has one.

**Files:**

- Modify: `app/(public)/a-propos/page.tsx`
- Modify: `app/(public)/le-lieu/page.tsx`

- [ ] **Step 1: Add metadata to about page**

At the top of `app/(public)/a-propos/page.tsx`, before the component:

```ts
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'À propos',
  description:
    "Découvrez l'histoire d'EBA Coffee Shop : le parcours de notre pâtissière formée en France, nos engagements qualité et notre vision à Abidjan.",
};
```

- [ ] **Step 2: Add metadata to le-lieu page**

At the top of `app/(public)/le-lieu/page.tsx`, before the component:

```ts
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Le lieu',
  description:
    'Visitez EBA Coffee Shop à Cocody, Abidjan : un espace chaleureux et soigné pour savourer café, pâtisseries et brunch.',
};
```

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: Build succeeds, pages render correct `<title>` tags

- [ ] **Step 4: Commit**

```bash
git add app/(public)/a-propos/page.tsx app/(public)/le-lieu/page.tsx
git commit -m "feat: add metadata for about and le-lieu pages"
```

---

### Task 4: Add `/le-lieu` to sitemap

Currently only home, about, and contact are in the sitemap. Le Lieu is missing.

**Files:**

- Modify: `app/sitemap.ts`

- [ ] **Step 1: Add le-lieu entry**

Add after the contact entry:

```ts
{
  url: `${siteUrl}/le-lieu`,
  lastModified: now,
  changeFrequency: 'monthly',
  priority: 0.7,
},
```

- [ ] **Step 2: Verify build**

Run: `bun run build`

- [ ] **Step 3: Commit**

```bash
git add app/sitemap.ts
git commit -m "feat: add le-lieu to sitemap"
```

---

### Task 5: Fix home hero accents (missing French characters)

`components/(public)/accueil/hero-section.tsx` has unaccented French text: "cafe d exception", "Decouvrez", "selectionnees", etc.

**Files:**

- Modify: `components/(public)/accueil/hero-section.tsx`
- Modify: `components/(public)/accueil/incontournables-section.tsx`

- [ ] **Step 1: Fix hero text**

```tsx
// h1 (line 26-28):
Un café d&apos;exception dans une ambiance chaleureuse

// p (line 30-32):
Découvrez nos boissons signature, nos douceurs maison et prenez le temps de savourer chaque instant.
```

- [ ] **Step 2: Fix incontournables text**

```tsx
// p subtitle (line 59):
Les pâtisseries et boissons les plus aimées, sélectionnées pour une expérience intense et gourmande.
```

- [ ] **Step 3: Verify build**

Run: `bun run build`

- [ ] **Step 4: Commit**

```bash
git add components/(public)/accueil/hero-section.tsx components/(public)/accueil/incontournables-section.tsx
git commit -m "fix: add missing French accents on home page text"
```

---

## Priority 2 — Page Carte (menu page)

### Task 6: Create the `/carte` page with menu sections

This is the critical missing page. The home hero CTA and navbar both link to `/carte`. Design: header + menu categories (Boissons chaudes, Boissons froides, Pâtisseries, Brunch) each with items + prices. Use FCFA currency. Use the same `content-container` and visual language as the rest of the site.

**Files:**

- Create: `app/(public)/carte/page.tsx`
- Create: `components/(public)/carte/carte-hero-section.tsx`
- Create: `components/(public)/carte/carte-menu-section.tsx`
- Modify: `app/sitemap.ts` (add `/carte`)

- [ ] **Step 1: Create the page file with metadata**

File: `app/(public)/carte/page.tsx`

```tsx
import type { Metadata } from 'next';
import CarteHeroSection from '@/components/(public)/carte/carte-hero-section';
import CarteMenuSection from '@/components/(public)/carte/carte-menu-section';

export const metadata: Metadata = {
  title: 'La carte',
  description:
    'Découvrez la carte EBA Coffee Shop : cafés, boissons signatures, pâtisseries maison et formules brunch à Abidjan.',
};

function CartePage() {
  return (
    <>
      <CarteHeroSection />
      <CarteMenuSection />
    </>
  );
}

export default CartePage;
```

- [ ] **Step 2: Create the hero section**

File: `components/(public)/carte/carte-hero-section.tsx`

Short hero (not full-screen) with a warm background, centered heading. No background image — keep it clean and let the menu content be the star.

```tsx
'use client';

import { motion, useReducedMotion } from 'framer-motion';

function CarteHeroSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      aria-labelledby="carte-hero-title"
      className="bg-[linear-gradient(180deg,rgba(247,239,232,1)_0%,rgba(255,252,248,1)_100%)] pb-8 pt-32 md:pb-12 md:pt-40"
    >
      <div className="content-container">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
          }
        >
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
        </motion.div>
      </div>
    </section>
  );
}

export default CarteHeroSection;
```

- [ ] **Step 3: Create the menu section with categories and items**

File: `components/(public)/carte/carte-menu-section.tsx`

Menu data inline. 4 categories, each with 4–6 items. Layout: categories stacked vertically, each with a heading + grid of items. Items show name + short description + price.

```tsx
'use client';

import { motion, useReducedMotion } from 'framer-motion';

type MenuItem = {
  name: string;
  description: string;
  price: number;
};

type MenuCategory = {
  title: string;
  items: MenuItem[];
};

const menuCategories: MenuCategory[] = [
  {
    title: 'Boissons chaudes',
    items: [
      { name: 'Espresso', description: 'Court et intense', price: 1500 },
      {
        name: 'Cappuccino Signature',
        description: 'Crema onctueuse, lait moussé',
        price: 3500,
      },
      {
        name: 'Latte Vanille',
        description: 'Espresso, lait chaud, vanille naturelle',
        price: 4000,
      },
      {
        name: 'Chocolat Chaud',
        description: 'Chocolat de couverture, lait entier',
        price: 3000,
      },
      {
        name: 'Thé Infusion',
        description: 'Sélection de thés et infusions',
        price: 2000,
      },
    ],
  },
  {
    title: 'Boissons fraîches',
    items: [
      {
        name: 'Café Glacé',
        description: 'Espresso sur glace, lait froid',
        price: 3500,
      },
      {
        name: 'Jus Frais du Jour',
        description: 'Fruits frais pressés sur place',
        price: 3000,
      },
      {
        name: 'Smoothie Mangue',
        description: 'Mangue, banane, lait de coco',
        price: 4000,
      },
      {
        name: 'Limonade Maison',
        description: 'Citron frais, menthe, sucre de canne',
        price: 2500,
      },
    ],
  },
  {
    title: 'Pâtisseries',
    items: [
      {
        name: 'Croissant Amande',
        description: 'Beurre français, pâte feuilletée maison',
        price: 2500,
      },
      {
        name: 'Pain au Chocolat',
        description: 'Chocolat noir, beurre AOP',
        price: 2000,
      },
      {
        name: 'Tarte aux Fruits',
        description: 'Fruits de saison, crème pâtissière',
        price: 3500,
      },
      {
        name: 'Cookie Chocolat',
        description: 'Pépites de chocolat, fleur de sel',
        price: 1500,
      },
      {
        name: 'Éclair Café',
        description: 'Crème café, glaçage fondant',
        price: 3000,
      },
    ],
  },
  {
    title: 'Brunch & Salé',
    items: [
      {
        name: 'Formule Brunch',
        description: 'Boisson chaude, viennoiserie, œufs, jus',
        price: 8500,
      },
      {
        name: 'Toast Avocat',
        description: 'Pain complet, avocat, œuf poché',
        price: 5000,
      },
      {
        name: 'Croque EBA',
        description: 'Jambon, fromage gratiné, salade',
        price: 4500,
      },
      {
        name: 'Salade du Marché',
        description: 'Légumes frais, vinaigrette maison',
        price: 4000,
      },
    ],
  },
];

const priceFormatter = new Intl.NumberFormat('fr-FR');

function CarteMenuSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      aria-label="Menu EBA Coffee Shop"
      className="bg-[linear-gradient(180deg,rgba(255,252,248,1)_0%,rgba(247,239,232,1)_100%)] py-10 md:py-14"
    >
      <div className="content-container">
        <div className="mx-auto max-w-3xl space-y-12 md:space-y-16">
          {menuCategories.map((category, catIndex) => (
            <motion.div
              key={category.title}
              initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={
                reduceMotion
                  ? undefined
                  : { duration: 0.6, delay: catIndex * 0.05, ease: 'easeOut' }
              }
            >
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {category.title}
              </h2>

              <div className="mt-5 divide-y divide-foreground/6">
                {category.items.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-baseline justify-between gap-4 py-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground sm:text-base">
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-xs text-foreground/50 sm:text-sm">
                        {item.description}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-primary sm:text-base">
                      {priceFormatter.format(item.price)}&nbsp;F
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default CarteMenuSection;
```

- [ ] **Step 4: Add `/carte` to sitemap**

In `app/sitemap.ts`, add:

```ts
{
  url: `${siteUrl}/carte`,
  lastModified: now,
  changeFrequency: 'monthly',
  priority: 0.9,
},
```

- [ ] **Step 5: Verify build and navigation**

Run: `bun run build`
Expected: Build succeeds, `/carte` resolves, home hero CTA links correctly

- [ ] **Step 6: Commit**

```bash
git add app/(public)/carte/ components/(public)/carte/ app/sitemap.ts
git commit -m "feat(carte): add menu page with categories and pricing"
```

---

## Priority 3 — Home Page Polish

### Task 7: Add entrance animations to home hero

The home hero is the only hero with zero animation. All other pages animate in. Add Framer Motion fade+slide consistent with the rest of the site.

**Files:**

- Modify: `components/(public)/accueil/hero-section.tsx`

- [ ] **Step 1: Add Framer Motion animation**

Wrap the inner content `div` with `motion.div`, same pattern as about-hero:

```tsx
'use client';

import Image from 'next/image';
import React from 'react';
import { Button, Link } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';

function HeroSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative min-h-svh w-full overflow-hidden">
      <Image
        src="/assets/examples/accueil/eba-hero-2.png"
        alt="Ambiance EBA Coffee Shop"
        fill
        priority
        className="object-cover"
      />

      <div className="absolute inset-0 bg-black/55" aria-hidden="true" />

      <motion.div
        className="relative z-10 flex min-h-svh items-center justify-center px-6"
        initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={
          reduceMotion
            ? undefined
            : { duration: 0.8, delay: 0.08, ease: [0.22, 1, 0.36, 1] }
        }
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-5 text-center text-white">
          <h3 className="rounded-full border border-white/40 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.2em]">
            EBA Coffee Shop
          </h3>

          <h1 className="text-balance text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
            Un café d&apos;exception dans une ambiance chaleureuse
          </h1>

          <p className="max-w-2xl text-pretty text-base text-white/90 sm:text-lg">
            Découvrez nos boissons signature, nos douceurs maison et prenez le
            temps de savourer chaque instant.
          </p>

          <Button
            as={Link}
            href="/carte"
            color="primary"
            size="lg"
            radius="full"
            className="mt-2 px-8"
          >
            Voir la carte
          </Button>
        </div>
      </motion.div>
    </section>
  );
}

export default HeroSection;
```

Note: This also includes the accent fixes from Task 5 — if Task 5 was already done, the text will already be correct.

- [ ] **Step 2: Verify build**

Run: `bun run build`

- [ ] **Step 3: Commit**

```bash
git add components/(public)/accueil/hero-section.tsx
git commit -m "feat(accueil): add entrance animation to home hero"
```

---

### Task 8: Re-enable QuickTrustSection on home page

Currently commented out. This section shows 4 trust signals (fait maison, ingrédients frais, etc.). Worth having on the home page.

**Files:**

- Modify: `app/(public)/page.tsx`
- Modify: `components/(public)/accueil/quick-trust-section.tsx` (review and polish if needed)

- [ ] **Step 1: Read the current QuickTrustSection component**

Read `components/(public)/accueil/quick-trust-section.tsx` and evaluate if it matches the site's current visual language. Adjust if needed (ensure `content-container`, proper spacing, Framer Motion animations).

- [ ] **Step 2: Uncomment in page.tsx**

```tsx
import QuickTrustSection from '@/components/(public)/accueil/quick-trust-section';

// In the JSX, uncomment:
<QuickTrustSection />;
```

- [ ] **Step 3: Verify build and visual**

Run: `bun run build`

- [ ] **Step 4: Commit**

```bash
git add app/(public)/page.tsx components/(public)/accueil/quick-trust-section.tsx
git commit -m "feat(accueil): re-enable quick trust section"
```

---

## Priority 4 — Cross-Site Polish

### Task 9: Add Framer Motion entrance animations to home sections that lack them

`incontournables-section.tsx` and `social-section.tsx` should have `whileInView` entrance animations consistent with other sections (fade + slide up, stagger on cards).

**Files:**

- Modify: `components/(public)/accueil/incontournables-section.tsx`

- [ ] **Step 1: Add staggered animations to incontournables cards**

Import `motion` and `useReducedMotion`. Wrap the heading area and each card with `motion.div` using `whileInView` and stagger pattern:

```tsx
// Heading area:
<motion.div
  initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
  whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={reduceMotion ? undefined : { duration: 0.6, ease: 'easeOut' }}
>
  {/* existing heading content */}
</motion.div>

// Each card (wrap the Card):
<motion.div
  key={item.name}
  initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
  whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.2 }}
  transition={reduceMotion ? undefined : { duration: 0.5, delay: index * 0.1, ease: 'easeOut' }}
>
  <Card>...</Card>
</motion.div>
```

- [ ] **Step 2: Verify build**

Run: `bun run build`

- [ ] **Step 3: Commit**

```bash
git add components/(public)/accueil/incontournables-section.tsx
git commit -m "feat(accueil): add scroll animations to incontournables section"
```

---

## Execution Order Summary

| Priority | Task | Description                | Impact                |
| -------- | ---- | -------------------------- | --------------------- |
| P1       | 1    | Fix `lang="fr"`            | SEO/accessibility     |
| P1       | 2    | Fix JSON-LD schema         | SEO                   |
| P1       | 3    | Add page metadata          | SEO                   |
| P1       | 4    | Add le-lieu to sitemap     | SEO                   |
| P1       | 5    | Fix French accents         | Content quality       |
| P2       | 6    | Build `/carte` page        | Critical missing page |
| P3       | 7    | Home hero animation        | Visual polish         |
| P3       | 8    | Re-enable QuickTrust       | Content value         |
| P4       | 9    | Incontournables animations | Visual consistency    |

Tasks 1–5 are independent and can be parallelized.
Task 6 is the largest and most impactful.
Tasks 7–9 are independent polish tasks.
