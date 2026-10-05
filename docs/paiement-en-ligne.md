# Paiement en ligne (Jèko)

Le client paie sa commande en ligne via **Jèko Checkout** (Wave, Orange Money, MTN
Money, Moov Money, Djamo), puis revient sur le site. Il paie **1 %** de frais ; Jèko
prélève **1,5 %**, EBA absorbe l'écart.

## Le parcours

1. Le checkout envoie le panier **et** le moyen choisi à `POST /api/commandes`.
2. Le serveur **ne croit rien du navigateur** : prix, suppléments et total sont
   revérifiés contre le menu (`lib/orders/cart-verification.ts`). Un total falsifié
   est refusé (`409 CART_CHANGED`) et ne crée aucune commande.
3. La commande est créée **en attente** et reste **invisible du staff** (caisse,
   cuisine, stats) tant qu'elle n'est pas payée (`lib/orders/visibility.ts`).
4. Le client est redirigé vers Jèko, paie, puis revient sur `/commande/[id]`.
5. Le **webhook** (`POST /api/webhooks/jeko`) règle la commande : elle passe en
   cuisine, le staff est prévenu. Au retour du client, `…/paiement/verifier` fait la
   même chose sans attendre le webhook (Jèko peut mettre 5 min à réconcilier).
6. Sans paiement, la commande **expire après 15 min** (`PAYMENT_EXPIRY_MINUTES`).

## Variables d'environnement

Toutes optionnelles : tant que les quatre premières ne sont pas toutes renseignées,
le paiement en ligne reste **inerte** : les commandes sont créées comme avant et se règlent
au comptoir (la capture d'écran + IA n'existe plus, cf. « À savoir »).

| Variable              | Rôle                                         | Où la trouver                                                                                                                          |
| --------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `JEKO_API_KEY`        | Clé API (`X-API-KEY`)                        | Dashboard Business › Paramètres › API & Webhooks                                                                                       |
| `JEKO_API_KEY_ID`     | Identifiant de la clé (`X-API-KEY-ID`)       | Même écran                                                                                                                             |
| `JEKO_STORE_ID`       | UUID du magasin qui encaisse                 | `GET https://api.jeko.africa/partner_api/stores` avec les deux en-têtes `X-API-KEY` / `X-API-KEY-ID` : renvoie la liste `{ id, name }` |
| `JEKO_WEBHOOK_SECRET` | Signe les webhooks (HMAC-SHA256)             | Même écran, après avoir saisi l'URL du webhook                                                                                         |
| `JEKO_API_BASE_URL`   | Racine de l'API ; absente = production       | Seulement pour viser le serveur factice                                                                                                |
| `ONLINE_FEE_PERCENT`  | Frais facturés au client, en % ; absente = 1 | —                                                                                                                                      |

**Dans le Dashboard Jèko**, un seul champ à remplir : l'URL du webhook
`https://<ton-domaine>/api/webhooks/jeko` (HTTPS public, **une seule URL par
magasin**). Les URLs de retour ne se configurent pas : le code les envoie à chaque
paiement.

## Tester en local (sans argent réel)

Jèko n'a pas de sandbox. Le projet fournit donc un **serveur Jèko factice**
(`scripts/jeko-mock/`) qui imite le contrat documenté et envoie de vrais webhooks
signés.

```bash
cp .env.example .env            # puis décommenter le bloc « Paiement en ligne (Jèko) »
docker compose up -d            # PostgreSQL sur le port 5433
pnpm db:push && pnpm db:trigger && pnpm db:seed
pnpm dev                        # terminal 1 — http://localhost:3000
pnpm jeko:mock                  # terminal 2 — http://127.0.0.1:4010
```

Passe une commande sur le site : tu arrives sur une page « Jèko (factice) » avec
quatre gestes.

| Bouton                | Ce que ça simule                | À vérifier                                                    |
| --------------------- | ------------------------------- | ------------------------------------------------------------- |
| ✅ Payer              | Paiement réussi + webhook signé | La commande passe en cuisine, le staff est prévenu            |
| ✅ Payer sans webhook | Succès sans webhook             | La page de suivi règle la commande au retour (réconciliation) |
| ❌ Échouer            | Solde insuffisant               | Message d'échec, bouton « Réessayer » avec un autre moyen     |
| 🚪 Quitter sans payer | Abandon                         | Compte à rebours, puis expiration à 15 min                    |

Autres vérifications utiles : arrêter `pnpm jeko:mock` pendant une commande (la
commande existe, « Réessayer » reste proposé), et forcer une expiration avec
`update "order" set "paymentExpiresAt" = now() - interval '5 minutes' where id = '…'`
(le nettoyage part au prochain passage — dashboard, caisse, cuisine, webhook —, au
plus une fois par minute).

La limitation anti-abus de `POST /api/commandes` (5 commandes / 10 min / IP) s'applique
aussi en local ; en test, changer l'en-tête `x-forwarded-for` suffit.

## Tester contre le vrai Jèko

1. Utiliser un **magasin dédié aux tests** (pas de sandbox).
2. Exposer l'application en HTTPS public (tunnel `cloudflared`/`ngrok`) : Jèko ne
   joint pas `localhost` pour le webhook, et **refuse les URLs de retour en
   `localhost` (422, vérifié)**. Mettre l'URL du tunnel dans `NEXT_PUBLIC_SITE_URL`,
   puis saisir `https://<tunnel>/api/webhooks/jeko` dans le dashboard. Next.js en
   dev demande aussi l'hôte du tunnel dans `allowedDevOrigins`.
3. Faire un **premier paiement de 100 centimes (1 FCFA)** : `amountCents` est censé
   valoir FCFA × 100 d'après la doc, ce test lève le doute avant tout vrai client.

## Mise en production

- Renseigner `JEKO_API_KEY`, `JEKO_API_KEY_ID`, `JEKO_STORE_ID`, `JEKO_WEBHOOK_SECRET`.
  **Ne pas** définir `JEKO_API_BASE_URL`.
- Lancer `pnpm db:push` (nouvelles colonnes de `Order` et nouveaux modes de paiement).
- Saisir l'URL du webhook dans le Dashboard Business.
- **Surveiller les livraisons** : Jèko désactive un webhook en silence après 15 échecs
  consécutifs. Le filet de sécurité est la réconciliation (retour du client et
  expiration), mais un webhook mort retarde le règlement.

## À savoir

- **Paiement tardif** : si Jèko confirme un paiement après l'expiration ou
  l'annulation, il est encaissé (`isPaid`) mais la commande n'est **pas** remise en
  cuisine ; le staff est alerté et la rétablit (ou rembourse) par le flux habituel.
- **Rupture de stock** : avant de faire payer, `startJekoPayment` vérifie le stock
  (sauf commande différée) et refuse (`out_of_stock`) : le client n'est pas débité.
  Si le stock manque pendant le paiement, le paiement est **enregistré sans entrée
  en cuisine** (`setOrderPayment(..., { skipKitchen: true })`) : la commande reste
  `NEW`, payée, avec une alerte ; le staff la lance en confirmant la production
  (`coverShortage`), comme pour toute pénurie.
- **Frais** : `onlineFee − gatewayFee` donne la marge par commande (environ −0,5 %).
  Les frais ne sont jamais comptés dans le chiffre d'affaires.
- **Capture d'écran + analyse IA : supprimées.** Les routes `…/preuve-paiement` et
  tout `lib/ai/` ont disparu. Les colonnes `paymentProof*` restent en base : l'écran
  caisse relit encore les captures des anciennes commandes.
- **Wave n'a pas disparu de la caisse** : `NEXT_PUBLIC_WAVE_MERCHANT_ID` sert au
  message de récap WhatsApp que le staff envoie à la main.
- **Double paiement** : si une relance a créé une seconde demande et que le client paie
  les deux, la seconde transaction est détectée (`Order.paymentTransactionId`) et le
  staff est alerté pour rembourser depuis le Dashboard Jèko.
- **Montant figé** : `Order.paymentAmountDue` garde ce qui a été demandé à Jèko. Le
  règlement compare à cette valeur, pas à `total + frais` recalculé (l'annulation par le
  client remet `total` au prix brut).
- **Pas de remboursement automatique** : aucune API de remboursement n'a été repérée,
  il se fait à la main depuis le Dashboard Jèko.
