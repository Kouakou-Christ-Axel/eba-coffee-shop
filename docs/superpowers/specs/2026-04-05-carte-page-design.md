# Page Carte — Design Spec

**Goal:** Build the menu page (`/carte`) with category navigation, product cards with supplement modals, a floating cart with drawer, and WhatsApp ordering.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, HeroUI components, Framer Motion, TypeScript

---

## 1. Data Structure

File: `config/menu.ts`

```ts
type SupplementOption = {
  name: string;
  price: number; // in FCFA, 0 = included
};

type SupplementGroup = {
  name: string; // e.g. "Choix du lait", "Extras"
  type: 'single' | 'multiple'; // radio vs checkbox
  required: boolean;
  options: SupplementOption[];
};

type Product = {
  id: string;
  name: string;
  description: string;
  price: number; // in FCFA
  image?: string; // optional path, placeholder if missing
  supplements?: SupplementGroup[];
};

type MenuCategory = {
  id: string;
  name: string;
  products: Product[];
};

type Menu = MenuCategory[];
```

4 categories, each with 4-6 products. Some products have supplement groups. All data hardcoded for now.

Example:

```ts
{
  id: 'boissons-chaudes',
  name: 'Boissons chaudes',
  products: [
    {
      id: 'cappuccino',
      name: 'Cappuccino Signature',
      description: 'Crema onctueuse, lait moussé',
      price: 3500,
      supplements: [
        {
          name: 'Choix du lait',
          type: 'single',
          required: false,
          options: [
            { name: 'Lait classique', price: 0 },
            { name: 'Lait d\'avoine', price: 500 },
            { name: 'Lait d\'amande', price: 500 },
          ],
        },
        {
          name: 'Extras',
          type: 'multiple',
          required: false,
          options: [
            { name: 'Shot espresso', price: 300 },
            { name: 'Sirop vanille', price: 200 },
            { name: 'Chantilly', price: 300 },
          ],
        },
      ],
    },
    // ...
  ],
}
```

---

## 2. Cart State

File: `lib/use-cart.ts` — a Zustand store (or React context if Zustand not available).

```ts
type CartItemSupplement = {
  groupName: string;
  optionName: string;
  price: number;
};

type CartItem = {
  cartId: string; // unique per cart entry (same product with different supplements = different entry)
  productId: string;
  productName: string;
  basePrice: number;
  quantity: number;
  supplements: CartItemSupplement[];
  totalPrice: number; // (basePrice + sum of supplement prices) * quantity
};
```

Store exposes: `items`, `addItem`, `removeItem`, `updateQuantity`, `clearCart`, `totalItems`, `totalPrice`.

Check if Zustand is already a dependency. If not, use React Context + useReducer instead (no new dependencies).

---

## 3. Page Layout

File: `app/(public)/carte/page.tsx`

```
<CarteHeroSection />       — short hero, no image, centered heading
<CarteMenuSection />       — sticky nav + all categories + products
<CartFloatingButton />     — fixed bottom-right badge
<CartDrawer />             — slide-in panel from right
```

Metadata:

```ts
export const metadata: Metadata = {
  title: 'La carte',
  description:
    'Découvrez la carte EBA Coffee Shop : cafés de spécialité, pâtisseries artisanales, brunch et boissons signatures à Cocody, Abidjan.',
  alternates: { canonical: '/carte' },
};
```

---

## 4. Components

### 4.1 CarteHeroSection

File: `components/(public)/carte/carte-hero-section.tsx`

- Server component (no interactivity)
- Fond cream gradient (same as other pages)
- `pt-32 md:pt-40 pb-4 md:pb-6` — short, just text
- Centered: subtitle "Notre carte" + H1 "Des saveurs pensées avec soin" + short paragraph
- No image, no animation (above the fold, instant render)

### 4.2 CarteMenuSection

File: `components/(public)/carte/carte-menu-section.tsx`

Client component. Contains:

**Sticky category nav:**

- Horizontal scrollable bar of category buttons
- `position: sticky; top: navbar-height` (64px or similar)
- Active category highlighted (underline or background accent)
- Uses IntersectionObserver to detect which category section is in view → update active state
- Click on category → `scrollIntoView({ behavior: 'smooth' })` to that section
- Background `bg-background/90 backdrop-blur-sm` when stuck

**Category sections:**

- Each category: `<section id={category.id}>` with H2 heading
- Products in a responsive grid: 1 col mobile, 2 cols tablet, 3 cols desktop
- Framer Motion stagger on cards (whileInView)

### 4.3 ProductCard

File: `components/(public)/carte/product-card.tsx`

Client component. For each product:

- Optional image (rounded top, aspect 4/3, placeholder gradient if no image)
- Product name (font-semibold)
- Short description (text-sm, foreground/55)
- Price in FCFA (font-semibold, text-primary)
- "+" button (circular, primary color)
  - If product has NO supplements → directly add 1 unit to cart, show brief toast/feedback
  - If product HAS supplements → open SupplementModal

### 4.4 SupplementModal

File: `components/(public)/carte/supplement-modal.tsx`

Client component. Uses HeroUI Modal.

- Product name + base price at top
- Each supplement group rendered as a fieldset:
  - Group name as legend
  - `type: 'single'` → radio buttons (HeroUI RadioGroup)
  - `type: 'multiple'` → checkboxes (HeroUI Checkbox)
  - Each option shows name + price (or "inclus" if price is 0)
- Running total displayed at bottom (base + selected supplements)
- "Ajouter au panier" button (primary, full width)
- Close on add or on dismiss

### 4.5 CartFloatingButton

File: `components/(public)/carte/cart-floating-button.tsx`

Client component.

- Fixed `bottom-6 right-6` (or within content-container on desktop)
- Circular button, primary color, shopping bag icon
- Badge with item count (secondary color)
- Only visible when cart has items (animate in/out)
- Click → open CartDrawer
- Framer Motion: scale spring on item count change

### 4.6 CartDrawer

File: `components/(public)/carte/cart-drawer.tsx`

Client component. Slide-in panel from right (HeroUI Drawer or custom).

- Header: "Votre commande" + close button
- List of cart items:
  - Product name + supplements listed below (text-xs, foreground/50)
  - Quantity controls (- / count / +)
  - Item total price on right
  - Swipe or button to remove
- Separator
- Total line (font-semibold, larger text)
- "Commander via WhatsApp" button (primary, full width)
- "Vider le panier" link (text-sm, destructive color)

### 4.7 WhatsApp Message Generation

Utility function in `lib/cart-to-whatsapp.ts`.

Takes the cart items + total and generates a URL-encoded WhatsApp message:

```
Bonjour, je souhaite commander :

• 2x Cappuccino Signature (Lait d'avoine, Shot espresso) — 8 600 F
• 1x Croissant Amande — 2 500 F

Total : 11 100 F

Merci !
```

Opens `https://wa.me/{whatsappNumber}?text={encodedMessage}`.

---

## 5. Interactions Flow

1. User lands on `/carte` → sees hero + sticky nav + all categories
2. Scrolls → nav updates active category
3. Clicks "+" on a simple product → item added to cart, floating button appears with count
4. Clicks "+" on a product with supplements → modal opens, user configures, clicks "Ajouter"
5. Clicks floating button → drawer slides in with full recap
6. Adjusts quantities or removes items in drawer
7. Clicks "Commander via WhatsApp" → WhatsApp opens with pre-filled message
8. Clicks "Vider le panier" → confirmation, cart cleared

---

## 6. SEO

- Page metadata with local keywords (cafés abidjan, pâtisseries cocody)
- Canonical `/carte`
- H1 in hero, H2 per category
- Product names in semantic HTML
- Add `/carte` to sitemap.ts (already done in earlier tasks)
- sr-only labels on interactive elements

---

## 7. File Structure Summary

```
config/menu.ts                                    — menu data + types
lib/use-cart.ts                                   — cart state (context or zustand)
lib/cart-to-whatsapp.ts                           — WhatsApp message builder
app/(public)/carte/page.tsx                       — page with metadata
components/(public)/carte/carte-hero-section.tsx   — short hero
components/(public)/carte/carte-menu-section.tsx   — sticky nav + category sections
components/(public)/carte/product-card.tsx         — individual product card
components/(public)/carte/supplement-modal.tsx     — supplement selection modal
components/(public)/carte/cart-floating-button.tsx — floating cart badge
components/(public)/carte/cart-drawer.tsx          — cart slide-in panel
```

---

## 8. Future: Backoffice Migration Path

This section documents how to migrate from hardcoded menu data to a database-backed backoffice.

### Current state (hardcoded)

- All menu data lives in `config/menu.ts` as a typed constant
- Cart state is client-side only (no persistence)
- Orders go via WhatsApp (no server-side record)

### Step 1: Database schema (Prisma)

Add to `prisma/schema.prisma`:

```prisma
model MenuCategory {
  id        String    @id @default(cuid())
  name      String
  slug      String    @unique
  sortOrder Int       @default(0)
  products  Product[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Product {
  id          String             @id @default(cuid())
  name        String
  description String
  price       Int                // in FCFA
  image       String?
  available   Boolean            @default(true)
  sortOrder   Int                @default(0)
  categoryId  String
  category    MenuCategory       @relation(fields: [categoryId], references: [id])
  supplements SupplementGroup[]
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
}

model SupplementGroup {
  id        String             @id @default(cuid())
  name      String
  type      String             // 'single' | 'multiple'
  required  Boolean            @default(false)
  productId String
  product   Product            @relation(fields: [productId], references: [id])
  options   SupplementOption[]
}

model SupplementOption {
  id      String          @id @default(cuid())
  name    String
  price   Int             // in FCFA, 0 = included
  groupId String
  group   SupplementGroup @relation(fields: [groupId], references: [id])
}

model Order {
  id        String      @id @default(cuid())
  items     Json        // serialized cart items
  total     Int         // in FCFA
  status    String      @default("pending") // pending, confirmed, done, cancelled
  phone     String?
  note      String?
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
}
```

### Step 2: API routes

- `GET /api/menu` — returns full menu (categories + products + supplements). Replace the import from `config/menu.ts` with a fetch to this endpoint.
- `POST /api/orders` — saves order to database. Called when user clicks "Commander", before opening WhatsApp.

### Step 3: Backoffice pages

Under `app/(dashboard)/` (behind auth):

- `/dashboard/menu` — CRUD for categories, products, supplements
- `/dashboard/orders` — list of orders with status management
- `/dashboard/orders/[id]` — order detail

### Step 4: Migration steps

1. Add Prisma models, run `bun run db:push`
2. Create seed script that copies data from `config/menu.ts` into database
3. Create `GET /api/menu` route that queries Prisma
4. Change `CarteMenuSection` to fetch from `/api/menu` instead of importing `config/menu.ts`
5. Create `POST /api/orders` route
6. Update WhatsApp button to also POST order to API before opening WhatsApp
7. Build backoffice CRUD pages
8. Remove `config/menu.ts` once backoffice is live

Each step is independently deployable. The menu page keeps working at every step.
