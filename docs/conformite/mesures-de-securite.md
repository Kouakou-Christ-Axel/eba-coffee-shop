# Mesures de sécurité et de confidentialité

Décrit l'état réel du code (loi n°2013-450 : obligation de sécurité et de
confidentialité). À relire avant chaque dépôt ARTCI.

## Accès

- Dashboard réservé au personnel authentifié (code à usage unique par e-mail, 5 min). Rôles : ADMIN, MANAGER, ASSISTANT_MANAGER, CASHIER, COMPTABLE, ANALYSTE.
- Fiche client (accès, export, anonymisation) : ADMIN / MANAGER / ASSISTANT_MANAGER.
- Export CSV des commandes : le comptable ne reçoit ni nom, ni téléphone, ni note.
- Assistant IA : numéros de téléphone masqués (`lib/ai/assistant/mask-pii.ts`) avant envoi au modèle.
- Serveur MCP : OAuth par compte nominatif ; la clé statique `MCP_API_KEY` est optionnelle et à éviter (non nominative).

## Transport et stockage

- HTTPS imposé (HSTS en production), CSP, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` (`next.config.ts`).
- Adresse IP des votes de sondage conservée sous forme de condensé salé (`lib/hash-ip.ts`) ; navigateur non conservé.
- Sentry : corps de requête, cookies, query string, IP et e-mail retirés avant envoi (`sentry.shared.config.ts`).
- Iframe Google Maps : `referrerPolicy="origin"` — l'identifiant de suivi d'une commande n'est pas transmis à Google.

## Conservation

- Grille appliquée par `lib/data-retention.ts`, déclenchée par `POST /api/cron/data-retention` (secret `CRON_SECRET`), à planifier chaque jour par le cron de l'hébergeur.
- Effacement sur demande : `anonymizeCustomer` (`lib/customer-privacy.ts`).

## Limites connues (à traiter)

- Les pages de suivi de commande s'ouvrent par un identifiant `cuid` (jeton secret non cryptographique) : prévoir un jeton public de 128 bits distinct. Une limitation de débit est en place en attendant.
- Pas de journal d'audit des exports et consultations de fiches clients.
- Les images (preuves de paiement, reçus) restent sur Cloudinary même après effacement du lien en base.
- Le conteneur Google Tag Manager est chargé avant le choix cookies (Consent Mode v2, cookies bloqués) : Google peut recevoir des signaux techniques sans cookie.
- `Customer.dateOfBirth` est saisie par le personnel sans finalité automatisée : à supprimer si inutile.

## Violation de données

1. Isoler la cause (clé, compte, route).
2. Évaluer les personnes touchées et les données.
3. Informer l'ARTCI et les personnes concernées sans délai si un préjudice est possible.
4. Consigner l'incident et les mesures prises.
