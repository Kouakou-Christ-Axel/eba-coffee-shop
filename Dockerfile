# syntax=docker/dockerfile:1.7
#
# Image de production : construite dans GitHub Actions (cf. .github/workflows/cd.yml),
# jamais sur le VPS. Postgres reste sur la machine hôte (réseau « host »).
#
# Les variables du build (NEXT_PUBLIC_*, schéma varlock) arrivent par un secret
# BuildKit monté en `.env` : elles ne sont écrites dans aucune couche de l'image.
# Les vrais secrets serveur ne sont lus qu'à l'exécution (`.env` monté par le compose).

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable \
    && apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── Dépendances ──────────────────────────────────────────────────────────────
FROM base AS deps
# `postinstall` lance `prisma generate` + `varlock typegen` : il leur faut le
# schéma Prisma, sa config et `.env.schema`.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY patches ./patches
COPY prisma ./prisma
COPY prisma.config.ts .env.schema ./
# `prisma generate` exige DATABASE_URL (prisma.config.ts) sans s'y connecter : valeur factice,
# limitée à cette commande (ni ENV, ni couche).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    pnpm install --frozen-lockfile

# ── Build ────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
ARG NEXT_DEPLOYMENT_ID
ENV NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID \
    TZ=UTC
# Le build prérend les pages publiques : `DATABASE_URL` doit pointer sur une base
# jetable au schéma à jour (fournie par le job CI, réseau « host »).
RUN --mount=type=secret,id=buildenv,target=/app/.env \
    pnpm build

# ── Exécution ────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    TZ=UTC \
    PORT=3001
# Pas de `output: 'standalone'` : le CD lance aussi `prisma db push` et `tsx`
# depuis cette image (étape « migrate »), donc on garde l'arbre complet.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/generated ./generated
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/package.json /app/next.config.ts /app/tsconfig.json \
     /app/prisma.config.ts /app/.env.schema /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/lib ./lib
COPY --from=build --chown=node:node /app/config ./config
COPY --from=build --chown=node:node /app/emails ./emails
COPY --from=build --chown=node:node /app/instrumentation.ts /app/sentry.server.config.ts \
     /app/sentry.edge.config.ts /app/sentry.shared.config.ts ./

# Fichiers uploadés (lib/uploads/paths.ts) : volume monté par le compose.
RUN mkdir -p public/uploads && chown -R node:node public/uploads
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=6 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/shop-status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["pnpm", "start"]
