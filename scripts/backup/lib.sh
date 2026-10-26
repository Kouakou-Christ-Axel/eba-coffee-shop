#!/usr/bin/env bash
# Fonctions partagées par db-backup.sh et db-restore.sh (à sourcer, pas à lancer).

# Charge le fichier d'environnement des sauvegardes (secrets, hors dépôt).
load_env() {
  local file="${EBA_BACKUP_ENV:-$HOME/.eba-backup.env}"
  [ -f "$file" ] || { echo "Fichier introuvable : $file" >&2; return 1; }
  set -a
  # shellcheck disable=SC1090
  . "$file"
  set +a
  APP_DIR="${APP_DIR:-/var/www/eba-coffee}"
}

# DATABASE_URL : celle du fichier d'environnement, sinon celle de l'app.
# libpq refuse les paramètres inconnus de Prisma (?schema=public) : on les coupe.
database_url() {
  local url="${DATABASE_URL:-}"
  if [ -z "$url" ] && [ -f "$APP_DIR/.env" ]; then
    url=$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" | head -n1 | cut -d= -f2-)
  fi
  url="${url%\"}"; url="${url#\"}"; url="${url%\'}"; url="${url#\'}"
  [ -n "$url" ] || { echo "DATABASE_URL introuvable" >&2; return 1; }
  printf '%s' "${url%%\?*}"
}

# rclone se configure par variables : pas de fichier de config à protéger.
r2_env() {
  export RCLONE_CONFIG_R2_TYPE=s3
  export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
  export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
  export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
  export RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
  export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
}

# Check-in Sentry Cron Monitor (no-op si SENTRY_CRON_CHECKIN_URL est absente).
# Un échec d'envoi ne doit jamais faire échouer la sauvegarde.
checkin() {
  [ -n "${SENTRY_CRON_CHECKIN_URL:-}" ] || return 0
  curl -fsS -m 10 -o /dev/null "${SENTRY_CRON_CHECKIN_URL}?status=$1" || true
}
