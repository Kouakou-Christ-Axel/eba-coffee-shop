# Sauvegardes de la base

Chaque nuit à 03:30 (UTC = Abidjan), le VPS fait un `pg_dump` de la base, le vérifie, le **chiffre** (age) et l'envoie sur **Cloudflare R2**. Les fichiers téléversés (`public/uploads/`, hors preuves de paiement) y sont copiés aussi. Une alerte Sentry part si la sauvegarde échoue **ou ne s'exécute pas**.

- Perte maximale en cas de sinistre (RPO) : ~24 h.
- Conservation : 3 jours sur le VPS ; 30 jours sur R2 (`db/`, règle de cycle de vie) ; un dump par mois sans expiration courte (`monthly/`).
- Code : `scripts/backup/` (`db-backup.sh`, `db-restore.sh`, `lib.sh`, `crontab.example`) ; installation : workflow GitHub « Sauvegarde (installer / lancer) ».

## Mise en place (une fois)

1. **R2** : créer un bucket **privé** (ex. `eba-backups`), un jeton API limité à ce bucket (lecture + écriture), et une règle de cycle de vie qui supprime le préfixe `db/` après 30 jours (ne pas viser `monthly/`).
2. **VPS** : installer `postgresql-client` (même version majeure que le serveur), `rclone`, `age`.
3. **Clés age** (sur votre poste, pas sur le VPS) : `age-keygen -o eba-backup-key.txt`. Garder ce fichier dans un gestionnaire de mots de passe : **sans lui, les sauvegardes sont illisibles**. Seule la ligne « public key » (`age1…`) va sur le VPS.
4. **Sentry** : créer un Cron Monitor (ex. `eba-db-backup`, planning `30 3 * * *` UTC, marge 60 min) et copier son URL de check-in (`https://oXXX.ingest.sentry.io/api/<projet>/cron/eba-db-backup/<clé>/`).
5. **VPS** : créer `~/.eba-backup.env` (`chmod 600`) :
   ```
   R2_ACCOUNT_ID=…
   R2_ACCESS_KEY_ID=…
   R2_SECRET_ACCESS_KEY=…
   R2_BUCKET=eba-backups
   AGE_RECIPIENT=age1…
   SENTRY_CRON_CHECKIN_URL=https://…/cron/eba-db-backup/<clé>/
   ```
   `DATABASE_URL` est lue dans `/var/www/eba-coffee/.env` (le suffixe Prisma `?schema=` est retiré).
6. Lancer le workflow **Sauvegarde (installer / lancer)** : il pose le cron et fait une première sauvegarde.
7. **Faire un test de restauration** (ci-dessous) avant de considérer la mise en place terminée, puis chaque trimestre.

## Restaurer

Toujours vers une base **vide et explicite** — le script refuse la base de l'application.

```bash
createdb eba_restore
scripts/backup/db-restore.sh latest postgresql://USER:PASS@localhost:5432/eba_restore ~/eba-backup-key.txt
# ou un fichier précis : remplacer « latest » par eba-2026-10-26-0330.dump.age
```

Ensuite : comparer quelques `count(*)` (commandes, clients, remboursements), puis `pnpm db:indexes` si l'index partiel `order_customer_counted_idx` manque. Pour un vrai sinistre : pointer `DATABASE_URL` vers la base restaurée et `pm2 reload`.

## Points d'attention

- Les dumps contiennent des données personnelles : toujours chiffrés hors du VPS. Une anonymisation ou une purge (`anonymizeCustomer`, `data-retention`) **n'efface pas les anciens dumps** : ils disparaissent à l'expiration (30 jours ; les dumps `monthly/` sont à purger à la main si un effacement l'exige).
- Alerte « check-in manquant » : couvre aussi un VPS éteint ou un cron supprimé.
- Cloudinary (images) est déjà hors du VPS et n'est pas sauvegardé ici.
