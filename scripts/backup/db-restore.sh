#!/usr/bin/env bash
# Restaure une sauvegarde dans une base CIBLE explicite (jamais la prod par défaut).
#   db-restore.sh <nom-objet|latest> <url-base-cible> <fichier-clé-privée-age>
# Ex. : db-restore.sh latest postgresql://postgres:postgres@localhost:5433/eba_restore ~/age-key.txt
# La base cible doit exister et être vide (createdb eba_restore).
set -euo pipefail
umask 077

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$HERE/lib.sh"

[ "$#" -eq 3 ] || { sed -n 2,6p "$0" >&2; exit 2; }
OBJECT="$1"; TARGET="$2"; IDENTITY="$3"

load_env
: "${R2_ACCOUNT_ID:?}" "${R2_ACCESS_KEY_ID:?}" "${R2_SECRET_ACCESS_KEY:?}" "${R2_BUCKET:?}"
r2_env

# Garde-fou : on ne restaure jamais par-dessus la base de production.
if [ "${TARGET%%\?*}" = "$(database_url 2>/dev/null || true)" ]; then
  echo "Refus : la cible est la base de l'application." >&2
  exit 1
fi

if [ "$OBJECT" = "latest" ]; then
  OBJECT="$(rclone lsf "r2:$R2_BUCKET/db/" | sort | tail -n1)"
fi
[ -n "$OBJECT" ] || { echo "Aucune sauvegarde trouvée." >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
echo "Téléchargement de $OBJECT…"
rclone copyto "r2:$R2_BUCKET/db/$OBJECT" "$WORK/in.age"
age --decrypt --identity "$IDENTITY" --output "$WORK/db.dump" "$WORK/in.age"

echo "Restauration vers la cible…"
pg_restore --no-owner --exit-on-error --dbname="$TARGET" "$WORK/db.dump"
echo "Restauration terminée. Vérifier : psql \"\$TARGET\" -c 'select count(*) from \"order\"'"
