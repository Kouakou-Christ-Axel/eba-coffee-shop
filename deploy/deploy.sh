#!/usr/bin/env bash
# Déploiement blue/green d'un environnement Docker (staging pour l'instant).
#
#   deploy.sh deploy   <env> <tag>   # pull, schéma BDD, démarre l'autre couleur, bascule
#   deploy.sh rollback <env>         # rebascule sur la couleur précédente (arrêtée, conservée)
#
# Lancé par la CI (appleboy/ssh-action, script_path) : arguments ou variables
# EBA_ACTION / EBA_ENV / EBA_TAG. À la main : `bash deploy.sh rollback staging`.
# Prérequis serveur : docs/deploiement.md.
set -euo pipefail

ACTION="${1:-${EBA_ACTION:-deploy}}"
ENV_NAME="${2:-${EBA_ENV:-}}"
TAG="${3:-${EBA_TAG:-}}"
IMAGE="${EBA_IMAGE:-ghcr.io/kouakou-christ-axel/eba-coffee-shop}"

log() { printf '[deploy:%s] %s\n' "${ENV_NAME:-?}" "$*"; }
die() { log "ERREUR : $*" >&2; exit 1; }

case "$ENV_NAME" in
  staging)
    PORT_BLUE=2001; PORT_GREEN=2002; NAME=eba-staging
    ENV_FILE=/etc/eba/staging.env
    UPSTREAM_CONF=/etc/nginx/conf.d/eba-staging-upstream.conf
    UPSTREAM_NAME=eba_staging
    STATE_DIR=/var/lib/eba/staging
    MEMORY=768m; CPUS=1.0
    ;;
  *) die "environnement « ${ENV_NAME} » non branché (seul « staging » l'est pour l'instant)" ;;
esac
STATIC_DIR="$STATE_DIR/next-static"
ACTIVE_FILE="$STATE_DIR/active"

# Pages ISR à régénérer avec la vraie base avant la bascule (cf. app/api/internal/revalidate).
WARMUP_PATHS=(/ /carte /sondages /sitemap.xml /llms.txt /api/menu)

mkdir -p "$STATIC_DIR"
exec 9>"$STATE_DIR/deploy.lock"
flock -n 9 || die "un autre déploiement est en cours"

[ -r "$ENV_FILE" ] || die "$ENV_FILE introuvable"
# Garde-fou : un staging ne doit jamais tourner avec la config d'un autre environnement.
grep -q '^APP_ENV=staging$' "$ENV_FILE" || die "$ENV_FILE doit contenir APP_ENV=staging"
env_value() { grep -m1 "^$1=" "$ENV_FILE" | cut -d= -f2- || true; }

port_of() { [ "$1" = blue ] && echo "$PORT_BLUE" || echo "$PORT_GREEN"; }
other_of() { [ "$1" = blue ] && echo green || echo blue; }
active="$(cat "$ACTIVE_FILE" 2>/dev/null || true)"

wait_healthy() { # <port>
  for _ in $(seq 1 60); do
    curl -fsS --max-time 4 "http://127.0.0.1:$1/api/health" >/dev/null 2>&1 && return 0
    sleep 2
  done
  return 1
}

switch_to() { # <color>
  local port conf_new backup
  port="$(port_of "$1")"
  conf_new="$(mktemp)"
  printf 'upstream %s { server 127.0.0.1:%s; }\n' "$UPSTREAM_NAME" "$port" >"$conf_new"
  backup="$(mktemp)"; cp -f "$UPSTREAM_CONF" "$backup" 2>/dev/null || : >"$backup"
  install -m 644 "$conf_new" "$UPSTREAM_CONF"
  if ! sudo -n nginx -t 2>/dev/null; then
    install -m 644 "$backup" "$UPSTREAM_CONF"
    die "nginx -t a échoué, upstream restauré"
  fi
  sudo -n nginx -s reload
  echo "$1" >"$ACTIVE_FILE"
  log "trafic basculé sur $1 (port $port)"
}

drain_old() { # <color>
  if docker inspect "$NAME-$1" >/dev/null 2>&1; then
    log "arrêt de $1 (les flux SSE sont coupés, les clients se reconnectent)"
    docker stop -t 30 "$NAME-$1" >/dev/null
  fi
}

if [ "$ACTION" = rollback ]; then
  [ -n "$active" ] || die "aucune couleur active enregistrée"
  target="$(other_of "$active")"
  docker inspect "$NAME-$target" >/dev/null 2>&1 || die "conteneur $NAME-$target absent, rollback impossible"
  log "rollback : $active -> $target (rappel : le schéma BDD n'est pas annulé)"
  docker start "$NAME-$target" >/dev/null
  wait_healthy "$(port_of "$target")" || die "$target ne répond pas sur /api/health"
  switch_to "$target"
  drain_old "$active"
  exit 0
fi

[ "$ACTION" = deploy ] || die "action inconnue « $ACTION »"
[ -n "$TAG" ] || die "tag d'image manquant"

if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-eba-deploy}" --password-stdin >/dev/null
fi
log "pull $IMAGE:$TAG"
docker pull -q "$IMAGE:$TAG" >/dev/null
docker pull -q "$IMAGE-tools:$TAG" >/dev/null

# Schéma BDD : AVANT de démarrer la nouvelle couleur, pendant que l'ancienne sert encore
# (changements additifs uniquement, cf. docs/deploiement.md). Même ordre que l'ancien cd.yml.
run_tool() {
  docker run --rm --add-host=host.docker.internal:host-gateway --env-file "$ENV_FILE" \
    "$IMAGE-tools:$TAG" pnpm "$@"
}
log "schéma BDD"
run_tool db:merge-duplicate-emails
run_tool db:push
run_tool db:trigger
run_tool db:indexes

if [ "$active" = blue ]; then new=green; else new=blue; fi
new_port="$(port_of "$new")"
log "démarrage de $new sur 127.0.0.1:$new_port"
docker rm -f "$NAME-$new" >/dev/null 2>&1 || true
docker run -d --name "$NAME-$new" --restart unless-stopped \
  --memory "$MEMORY" --cpus "$CPUS" \
  --add-host=host.docker.internal:host-gateway \
  --env-file "$ENV_FILE" \
  -p "127.0.0.1:$new_port:3000" \
  "$IMAGE:$TAG" >/dev/null

if ! wait_healthy "$new_port"; then
  docker logs --tail 60 "$NAME-$new" >&2 || true
  docker rm -f "$NAME-$new" >/dev/null 2>&1 || true
  die "$new n'est pas sain : abandon, la couleur active ($active) n'a pas été touchée"
fi

# Réchauffage : le HTML prérendu au build vient d'une base vide.
secret="$(env_value CRON_SECRET)"
if [ -n "$secret" ]; then
  curl -fsS -X POST -H "Authorization: Bearer $secret" \
    "http://127.0.0.1:$new_port/api/internal/revalidate" >/dev/null \
    || die "réchauffage refusé (CRON_SECRET), abandon avant bascule"
  for p in "${WARMUP_PATHS[@]}"; do
    curl -fsS --max-time 30 -o /dev/null "http://127.0.0.1:$new_port$p" || log "avertissement : $p n'a pas répondu"
  done
else
  log "avertissement : CRON_SECRET absent, pages ISR non réchauffées (HTML de build, base vide)"
fi

# Assets versionnés : dossier cumulatif servi par nginx (cf. deploy/nginx/staging.conf).
docker cp "$NAME-$new:/app/.next/static/." "$STATIC_DIR/"
find "$STATIC_DIR" -type f -mtime +14 -delete

switch_to "$new"

site="$(env_value NEXT_PUBLIC_SITE_URL)"
if [ -n "$site" ] && ! curl -fsS --max-time 10 "${site%/}/api/health" >/dev/null; then
  log "avertissement : la sonde publique ${site%/}/api/health échoue (DNS, TLS ou nginx)"
fi

[ -n "$active" ] && drain_old "$active"
docker image prune -f >/dev/null
log "terminé : $new actif sur l'image $TAG"
