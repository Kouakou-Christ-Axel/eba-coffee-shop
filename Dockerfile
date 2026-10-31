# syntax=docker/dockerfile:1.7
#
# Deux cibles, construites par la CI (.github/workflows/cd-staging.yml) :
#
#   runner (défaut) : image d'exécution. Le `next build` (BUILD_STANDALONE=1) tourne
#     DANS LE JOB CI, contre une base Postgres de service (le prérendu lit la base),
#     puis ce Dockerfile n'empaquette que `.next/standalone`, `.next/static`, `public`.
#   tools : sources + prisma + tsx, pour les étapes de schéma (db push, trigger,
#     index, backfills) lancées en `docker run --rm` avant la bascule.
#
# Les secrets ne sont JAMAIS dans l'image : le build utilise des valeurs factices,
# les vraies variables sont résolues au démarrage (deploy/docker-entrypoint.sh).

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS runner
ARG VARLOCK_VERSION
RUN test -n "$VARLOCK_VERSION" \
 && apt-get update \
 && apt-get install -y --no-install-recommends tini curl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g "varlock@${VARLOCK_VERSION}" \
 && npm cache clean --force
ENV NODE_ENV=production \
    TZ=UTC \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --chown=node:node .next/standalone ./
COPY --chown=node:node .next/static ./.next/static
COPY --chown=node:node public ./public
COPY --chown=node:node .env.schema ./.env.schema
COPY --chown=node:node deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1
ENTRYPOINT ["tini", "--", "/usr/local/bin/docker-entrypoint.sh"]

FROM node:${NODE_VERSION}-bookworm-slim AS tools
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable
ENV TZ=UTC \
    DATABASE_URL=postgresql://build:build@localhost:5432/build
WORKDIR /app
COPY . .
# `tsx --env-file=.env` (db:merge-duplicate-emails, backfills) exige que le fichier existe.
RUN touch .env
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
CMD ["pnpm", "--version"]
