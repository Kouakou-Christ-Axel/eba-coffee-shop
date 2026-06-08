# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EBA Coffee Shop - a French-language Next.js website for a coffee shop in Abidjan, Cote d'Ivoire. Full-stack TypeScript with PostgreSQL, authentication, and rich animations.

## Commands

```bash
pnpm dev              # Dev server (port 3000)
pnpm build            # Production build
pnpm start            # Start production server
pnpm lint             # ESLint
pnpm format:fix       # Prettier auto-format
pnpm db:generate      # Regenerate Prisma client
pnpm db:push          # Sync Prisma schema to database
pnpm db:studio        # Open Prisma Studio GUI
```

Package manager: **pnpm only** (do not use `bun` or `npm` — the repo relies on pnpm hoist patterns in `.npmrc` for HeroUI/Tailwind v4 to work).

Prisma client is auto-generated on `pnpm install` via the `postinstall` script.

Pre-commit hooks (Husky + lint-staged) run ESLint and Prettier on staged files automatically.

## Architecture

- **Runtime:** Node.js with pnpm + Next.js 16 App Router, React 19
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/postcss`) + HeroUI component library with custom theme in `config/hero.ts`
- **Database:** PostgreSQL with Prisma ORM (`prisma/schema.prisma`), singleton client in `lib/prisma.ts`
- **Auth:** Better Auth (`lib/auth.ts` server, `lib/auth-client.ts` client) with Google OAuth, API routes at `/api/auth/[...all]`
- **Animations:** GSAP (`@gsap/react`) and Framer Motion
- **Environment:** varlock for type-safe env vars; schema in `.env.schema`, types generated to `env.d.ts`

## Key Directories

- `app/(public)/` - Public pages route group with shared layout (navbar + footer)
- `components/(public)/` - Page-specific section components, organized by page name (e.g., `accueil/`, `a-propos/`)
- `components/layouts/` - Navbar, footer
- `components/providers.tsx` - Root providers (HeroUI)
- `config/` - Brand config (menu items), HeroUI theme, Prisma config
- `lib/` - Auth setup, Prisma client, utilities, JSON-LD structured data
- `generated/prisma/` - Auto-generated Prisma client (do not edit)

## Conventions

- **Path alias:** `@/*` maps to project root
- **Client components:** Explicitly marked with `'use client'`; most section components are server components
- **Formatting:** Semicolons, single quotes, 2-space tabs, arrow parens always (see `.prettierrc.json`)
- **Content language:** French (site targets Cote d'Ivoire market)
- **Theme colors:** Primary = deep purple, Secondary = golden orange, Background = cream/dark brown

## UI library policy

- **HeroUI = défaut.** Tout composant interactif (Button, Input, Modal, Tabs, Card, Drawer, Select, Tooltip, Badge, Switch, Skeleton, etc.) utilise HeroUI.
- **shadcn (`components/ui/*`) = uniquement** pour les primitives que HeroUI ne couvre pas : `Sidebar`, `Breadcrumb`, `Table` data-dense, `Sheet` (snap-points spécifiques).
- Ne pas mélanger les deux dans un même composant sauf frontière claire (ex. layout shadcn + contenu HeroUI).
- Le thème HeroUI est dans `config/hero.ts` : `primary` (deep purple), `secondary` (golden orange).

## Animation policy

- **GSAP** : animations scroll-driven, timelines complexes, ScrollTrigger. Utiliser le hook `useScrollAnimation` (`lib/animations/use-scroll-animation.ts`) pour les patterns d'entrée ; GSAP brut pour les chorégraphies sur-mesure.
- **Framer Motion** : animations de présence (mount/unmount), hover/tap, `AnimatePresence`, micro-interactions React.
- **`prefers-reduced-motion`** est obligatoire. GSAP via `gsap.matchMedia()` (déjà géré dans `useScrollAnimation`), Framer via `useReducedMotion()`.

## Centralized schemas & constants

- **Zod schemas** : `lib/schemas/{order,menu,upload}.ts` — utilise-les depuis les routes API ; les routes peuvent durcir via `.extend()` mais ne **redéclarent pas** inline.
- **Types métier partagés** : `lib/types/index.ts` (re-exports les types depuis les schémas).
- **Constantes** : `config/constants.ts` (`MAX_UPLOAD_SIZE_BYTES`, `SLOT_DURATION_MINUTES`, `OTP_TIMEOUT_SECONDS`, `ORDERS_PAGE_SIZE`, `ORDER_*_MAX`, etc.). Pas de magic numbers en doublon dans le code applicatif.

## Serveur MCP (gestion du menu)

- **Endpoint** : `POST /api/mcp` — serveur [MCP](https://modelcontextprotocol.io) distant (transport Streamable HTTP, JSON-RPC 2.0, sans état) qui expose la gestion du menu (lecture + écriture) à un client comme Claude. Doc complète : `app/api/mcp/README.md`.
- **Auth** : jeton statique `MCP_API_KEY` en `Authorization: Bearer <token>` (comparaison à temps constant). Si la clé n'est pas configurée → **503** (jamais d'accès ouvert).
- **Architecture** : `app/api/mcp/route.ts` (transport + auth + revalidation cache) → `lib/mcp/handler.ts` (dispatch JSON-RPC, agnostique du framework) → `lib/mcp/tools.ts` (registre des outils).
- **Règle d'or** : les outils MCP ne dupliquent **aucune** logique métier. Ils branchent `lib/menu.ts` (`getMenuAdmin`) et `lib/menu-mutations.ts`, et réutilisent les schémas Zod existants (`z.toJSONSchema` génère le `inputSchema`). Pour ajouter un outil, étends `tools.ts`.
- **Images** : la persistance (validation MIME/taille + écriture disque) vit dans `lib/uploads.ts`, partagée par la route `/api/upload` (multipart, dashboard) et l'outil MCP `set_product_image` (base64). `imageUrlSchema` (`lib/schemas/upload.ts`) accepte un chemin relatif `/uploads/...` **ou** une URL http(s). `update_product` est une mise à jour **partielle** (champs absents = inchangés).
