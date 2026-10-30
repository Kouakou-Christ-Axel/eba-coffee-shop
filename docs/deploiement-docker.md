# Déploiement Docker (build GitHub Actions → pull sur le VPS)

Le build de Next.js se faisait sur le VPS et y était tué par manque de RAM (`exit 137`).
Il se fait maintenant dans GitHub Actions ; le VPS ne fait que **tirer l'image, migrer la
base et relancer le conteneur**. Postgres reste installé sur la machine (pas de conteneur).

```
push master → CI → CD
                    ├─ build : Postgres jetable + `pnpm db:push`, puis `docker build`
                    │          → ghcr.io/<owner>/eba-coffee-shop:<sha> (+ :latest)
                    └─ deploy (SSH) : git pull · docker pull · migrate · up -d
                                      · attente « healthy » (sinon retour image précédente)
                                      · POST /api/cron/revalidate-public
```

## Fichiers

| Fichier                    | Rôle                                                                        |
| -------------------------- | --------------------------------------------------------------------------- |
| `Dockerfile`               | Image multi-étapes ; le `.env` de build est un secret BuildKit (hors image) |
| `docker-compose.prod.yml`  | Services `app` et `migrate` (`network_mode: host`)                          |
| `.github/workflows/cd.yml` | Build, push GHCR, déploiement SSH                                           |

## Mise en place unique (root sur le VPS)

1. **Installer Docker** (moteur + plugin compose) et ajouter l'utilisateur de déploiement au
   groupe `docker` : `usermod -aG docker <VPS_USER>` (se reconnecter ensuite).
2. **Swap (filet de sécurité)** : `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`,
   puis `/swapfile none swap sw 0 0` dans `/etc/fstab`.
3. **Uploads** : le conteneur tourne en utilisateur `node` (uid 1000) et écrit dans
   `/var/www/eba-coffee/public/uploads` (monté en volume). `chown -R 1000:1000 /var/www/eba-coffee/public/uploads`.
4. **Postgres** : `DATABASE_URL` du `.env` du VPS reste en `localhost` (le conteneur partage le
   réseau de la machine). Rien à changer dans `pg_hba.conf`.
5. **`.env` du VPS** : inchangé, monté en lecture seule dans le conteneur. Il doit contenir
   `CRON_SECRET` (sinon les pages publiques ne sont pas invalidées après un déploiement ; elles se
   régénèrent alors à leur délai ISR).
6. **Secret GitHub `BUILD_ENV`** (Settings → Secrets → Actions) : un `.env` de **build**.
   Mettre les `NEXT_PUBLIC_*` réels (inlinés dans le bundle client) et, pour les variables
   obligatoires du schéma (`.env.schema`), des valeurs factices (`BETTER_AUTH_SECRET=build`,
   `RESEND_API_KEY=build`, …). `DATABASE_URL` est ajouté par le workflow. Les vrais secrets
   serveur restent uniquement dans le `.env` du VPS.
7. **Paquet GHCR** : après le premier push, vérifier que le dépôt a accès au paquet
   (Package settings → Manage Actions access) pour que le `GITHUB_TOKEN` puisse le tirer.

## Bascule depuis PM2

PM2 sert sur le port 3001 (reverse proxy). Pour tester sans couper le site :

```bash
cd /var/www/eba-coffee
export IMAGE=ghcr.io/kouakou-christ-axel/eba-coffee-shop:<sha> APP_PORT=3002
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
docker compose -f docker-compose.prod.yml up -d app
curl -i http://127.0.0.1:3002/api/shop-status
```

Quand c'est bon : `pm2 stop eba-coffee-shop && pm2 delete eba-coffee-shop && pm2 save`, puis
`docker compose -f docker-compose.prod.yml down`, et laisser le CD relancer sur 3001.

## Retour arrière

Le CD revient tout seul à l'image précédente si le conteneur n'est pas `healthy` en 150 s. À la
main : `IMAGE=ghcr.io/<owner>/eba-coffee-shop:<ancien-sha> docker compose -f docker-compose.prod.yml up -d app`.

## Limites connues

- Le build n'a pas accès à la vraie base : les pages ISR sortent vides du build et sont
  invalidées après démarrage. Entre `up -d` et l'invalidation (quelques secondes), une visite peut
  voir une page vide.
- Non testé de bout en bout : aucun Docker disponible dans l'environnement qui a écrit ces
  fichiers. Le premier run du CD est le vrai test.
