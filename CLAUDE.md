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
