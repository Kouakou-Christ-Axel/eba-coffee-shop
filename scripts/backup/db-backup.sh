#!/usr/bin/env bash
# Sauvegarde quotidienne : pg_dump → vérification → chiffrement age → Cloudflare R2.
# Voir docs/sauvegardes.md. Lancé par cron (cf. crontab.example).
set -euo pipefail
umask 077

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$HERE/lib.sh"
load_env

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/eba}"
LOCAL_KEEP_DAYS="${LOCAL_KEEP_DAYS:-3}"
MIN_DUMP_BYTES="${MIN_DUMP_BYTES:-10240}"
mkdir -p "$BACKUP_DIR"

# Jamais deux sauvegardes en même temps.
exec 9>"$BACKUP_DIR/.lock"
flock -n 9 || { echo "Une sauvegarde est déjà en cours." >&2; exit 0; }

checkin in_progress
trap 'checkin error' ERR

: "${R2_ACCOUNT_ID:?}" "${R2_ACCESS_KEY_ID:?}" "${R2_SECRET_ACCESS_KEY:?}"
: "${R2_BUCKET:?}" "${AGE_RECIPIENT:?}"
r2_env

STAMP="$(date -u +%Y-%m-%d-%H%M)"
DUMP="$BACKUP_DIR/eba-$STAMP.dump"
trap 'rm -f "$DUMP"; checkin error' ERR

# Format custom : restauration sélective, extensions et déclencheur inclus.
pg_dump --format=custom --no-owner --dbname="$(database_url)" --file="$DUMP"

# Un dump vide ou illisible ne doit jamais partir pour « une sauvegarde ».
[ "$(stat -c %s "$DUMP")" -ge "$MIN_DUMP_BYTES" ] || { echo "Dump trop petit" >&2; exit 1; }
pg_restore --list "$DUMP" >/dev/null

# Les dumps contiennent noms et téléphones : jamais en clair hors du serveur.
age --recipient "$AGE_RECIPIENT" --output "$DUMP.age" "$DUMP"
rm -f "$DUMP"
trap 'checkin error' ERR

NAME="$(basename "$DUMP.age")"
rclone copyto "$DUMP.age" "r2:$R2_BUCKET/db/$NAME"
# Dump mensuel, conservé sans expiration courte (la règle de cycle de vie
# du bucket ne vise que le préfixe db/).
if [ "$(date -u +%d)" = "01" ]; then
  rclone copyto "$DUMP.age" "r2:$R2_BUCKET/monthly/$NAME"
fi

# Fichiers téléversés (hors base). `copy` n'efface jamais côté R2 ; les preuves
# de paiement sont exclues (durée de conservation limitée, cf. RETENTION).
UPLOADS="${UPLOADS_DIR:-$APP_DIR/public/uploads}"
if [ -d "$UPLOADS" ]; then
  rclone copy "$UPLOADS" "r2:$R2_BUCKET/uploads" --exclude 'payment-proofs/**'
fi

find "$BACKUP_DIR" -name 'eba-*.dump.age' -mtime +"$LOCAL_KEEP_DAYS" -delete

trap - ERR
checkin ok
echo "Sauvegarde OK : $NAME"
