# Checklist — déclaration / autorisation ARTCI

À dérouler quand l'entreprise sera constituée. Les traitements sont déjà décrits
dans `registre-traitements.md` ; les transferts dans
`sous-traitants-et-transferts.md`.

## Pièces à réunir

- [ ] Raison sociale, forme juridique, RCCM, NCC, représentant légal.
- [ ] Adresse du siège et contact du responsable (ou délégué) à la protection des données.
- [ ] Hébergeur du site et localisation des serveurs et de la base de données.
- [ ] Accords de traitement de données signés : Jèko, Resend, Cloudinary, Cloudflare, Sentry, OpenRouter (et mode « zero data retention »), Google, Meta.
- [ ] Relecture juridique des pages `/confidentialite`, `/mentions-legales`, `/cgv`, `/cookies`.

## À saisir dans le dashboard (Paramètres → Coordonnées)

- [ ] Raison sociale / exploitant, forme juridique, N° RCCM, NCC, directeur de la publication.
- [ ] Hébergeur du site.
- [ ] Email dédié aux droits (sinon l'email général est utilisé).
- [ ] N° de déclaration ou d'autorisation ARTCI, dès réception du récépissé.

## Dépôt

- [ ] Déclaration des traitements (registre).
- [ ] Demande d'autorisation des transferts hors Côte d'Ivoire (tableau des sous-traitants).
- [ ] Mettre à jour la grille de conservation si l'ARTCI impose d'autres durées (`config/data-protection.ts`, puis `pnpm exec tsx scripts/gen-compliance-docs.ts`).

## Après dépôt

- [ ] Planifier le cron quotidien `POST /api/cron/data-retention` (en-tête `Authorization: Bearer $CRON_SECRET`).
- [ ] Traiter les demandes de droits sous un mois (fiche client → Exporter / Anonymiser).
