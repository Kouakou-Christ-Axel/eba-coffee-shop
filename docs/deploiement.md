# Déploiement Docker blue/green

État : **staging uniquement**. La production reste sur `cd.yml` (pm2, `git pull` + build sur le VPS).

## Principe

1. Un push sur la branche `staging` lance `.github/workflows/cd-staging.yml`.
2. Le job `build` construit Next (`BUILD_STANDALONE=1`) contre un Postgres de service, puis publie deux images sur GHCR : `ghcr.io/<dépôt>:sha-<commit>` (exécution) et `…-tools:sha-<commit>` (schéma BDD).
3. Le job `deploy` exécute `deploy/deploy.sh` sur le serveur (SSH) : pull, schéma BDD, démarrage de l'autre couleur, contrôle `/api/health`, réchauffage des pages ISR, bascule nginx, arrêt de l'ancienne couleur (conservée arrêtée pour le rollback).

Ports staging : **bleu 2001, vert 2002** (liés à `127.0.0.1`). Rollback : _Actions → CD Staging → Run workflow → rollback_, ou `bash deploy.sh rollback staging` sur le serveur.

## Pourquoi `__VARLOCK_ENV` (à ne pas casser)

`next build` fige dans `.next/server/chunks/[turbopack]_runtime.js` toutes les valeurs varlock vues au build, **et elles écrasent l'environnement du conteneur au démarrage**. Donc : le build CI utilise des valeurs factices (aucun secret dans l'image) et `deploy/docker-entrypoint.sh` calcule `__VARLOCK_ENV` (`varlock load --format json-full`) avec les vraies variables du conteneur, qui prend alors le dessus. Une configuration invalide arrête le conteneur : la bascule n'a pas lieu. Seules les variables `NEXT_PUBLIC_*` sont réellement figées au build, d'où **une image par environnement**.

## Préparation du serveur (une fois)

- Docker, et un utilisateur de déploiement dans le groupe `docker` avec `sudo -n nginx -t` / `sudo -n nginx -s reload` autorisés (sudoers).
- Dossiers : `sudo install -d -o <user> /var/lib/eba/staging /etc/eba`.
- `/etc/eba/staging.env` d'après `deploy/staging.env.example` (chmod 600, **sans guillemets**).
- Postgres : base `eba_staging` + rôle dédié `eba_staging` sans droit sur la prod ; écouter sur l'interface du pont Docker (`listen_addresses`, `pg_hba.conf` pour `172.16.0.0/12`) ; vérifier `max_connections` (deux couleurs = deux pools + deux écouteurs LISTEN).
- nginx : adapter le vhost `staging.eba-coffee.com` d'après `deploy/nginx/staging.conf` (remplace le `proxy_pass` fixe sur 2001 par l'upstream géré par le script), créer `/etc/nginx/.htpasswd-eba-staging`.
- Secrets GitHub (environnement `staging`) : `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` ; variables : `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_API_KEY`, `NEXT_PUBLIC_WAVE_MERCHANT_ID`.
- Serveur Jèko factice : `pnpm jeko:mock` sur l'hôte (port 4010) avec les clés de `staging.env` et `JEKO_MOCK_WEBHOOK_URL=https://staging.eba-coffee.com/api/webhooks/jeko`.

## Règles

- **Schéma BDD additif seulement** : l'ancienne couleur sert encore pendant `db push`. Une suppression ou un renommage se fait en deux déploiements (expand puis contract). `db push` n'est jamais lancé avec `--accept-data-loss`.
- Un rollback ne défait pas le schéma.
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (`openssl rand -base64 32`, au build **et** à l'exécution) est facultative : elle évite des erreurs de déchiffrement pour les sessions caisse/cuisine ouvertes pendant une bascule.
- Aucun cron n'est planifié en staging. `CRON_SECRET` y sert seulement au réchauffage.

## Limites connues

- Les flux SSE (cuisine, caisse) sont coupés à l'arrêt de l'ancienne couleur ; les clients se reconnectent seuls.
- Limiteurs de débit et throttles (`lib/rate-limit.ts`, `lib/jeko/expiry.ts`) sont par processus : remis à zéro à chaque bascule.
- `revalidatePath` n'atteint que le conteneur qui reçoit la mutation : pendant le chevauchement, le stock public peut rester périmé jusqu'à 60 s sur l'autre couleur.
