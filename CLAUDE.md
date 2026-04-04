# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EBA Coffee Shop - a French-language Next.js website for a coffee shop in Abidjan, Cote d'Ivoire. Full-stack TypeScript with PostgreSQL, authentication, and rich animations.

## Commands

```bash
bun dev              # Dev server (port 3000)
bun build            # Production build
bun start            # Start production server
bun run lint         # ESLint
bun run format:fix   # Prettier auto-format
bun run db:generate  # Regenerate Prisma client
bun run db:push      # Sync Prisma schema to database
bun run db:studio    # Open Prisma Studio GUI
```

Prisma client is auto-generated on `bun install` via the `postinstall` script.

Pre-commit hooks (Husky + lint-staged) run ESLint and Prettier on staged files automatically.

## Architecture

- **Runtime:** Bun with Next.js 16 App Router, React 19
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
