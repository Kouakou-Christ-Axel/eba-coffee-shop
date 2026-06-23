# Serveur MCP — Administration EBA

Serveur [MCP](https://modelcontextprotocol.io) distant qui expose
l'**administration de l'app** (menu, stats, dépenses, caisse, clients, fidélité…)
à un client compatible comme Claude, en langage naturel.

- **Endpoint** : `POST https://<votre-domaine>/api/mcp`
- **Transport** : Streamable HTTP (JSON-RPC 2.0), sans état

## Deux façons de s'authentifier

| Mode                           | Pour qui / quoi                             | Multi-utilisateurs ? |
| ------------------------------ | ------------------------------------------- | -------------------- |
| **OAuth 2.0** (recommandé)     | Claude **web / mobile / desktop**           | ✅ par compte ADMIN  |
| **Clé statique** `MCP_API_KEY` | Clients « machine » : Claude Code CLI, curl | ❌ secret partagé    |

Le serveur tente d'abord la clé statique (si `MCP_API_KEY` est fournie en
`Authorization: Bearer …`) ; sinon il bascule sur OAuth. **Toute requête sans
identifiant valide reçoit 401** ; un compte sans rôle **ADMIN** reçoit **403**.

---

## 1. OAuth 2.0 — Claude web / mobile (+ desktop)

C'est le **seul** mode utilisable sur claude.ai (web) et l'app mobile Claude :
ces clients ne permettent pas de coller un en-tête Bearer, ils exigent un flux
OAuth. Chaque administrateur se connecte avec **son propre compte** (OTP email /
Google) — pas de secret à partager, accès traçable et révocable individuellement.

Le provider OAuth est fourni par le plugin MCP de Better Auth (`lib/auth.ts`).
Il publie automatiquement la découverte (RFC 8414 / 9728) :

- `https://<votre-domaine>/.well-known/oauth-authorization-server`
- `https://<votre-domaine>/.well-known/oauth-protected-resource`
- endpoints OAuth sous `https://<votre-domaine>/api/auth/mcp/*`

### Pré-requis

- L'app est **déployée publiquement en HTTPS** et `BETTER_AUTH_URL`
  (= `NEXT_PUBLIC_SITE_URL`) pointe vers ce domaine — l'OAuth `issuer` en dépend.
- Les tables OAuth existent en base : après déploiement, lancer
  `pnpm db:push` (puis `pnpm db:generate`). Modèles `OauthApplication`,
  `OauthAccessToken`, `OauthConsent` dans `prisma/schema.prisma`.
- Chaque utilisateur autorisé a le rôle **ADMIN** (voir « Donner accès à un
  collaborateur » plus bas).
- Côté Claude : un plan **Pro / Max / Team / Enterprise** (les connecteurs
  personnalisés y sont disponibles).

### Ajouter le connecteur (claude.ai / mobile)

1. **Paramètres → Connecteurs → Ajouter un connecteur personnalisé**.
2. Coller **uniquement l'URL** : `https://<votre-domaine>/api/mcp` (aucun en-tête
   à saisir).
3. Claude découvre l'OAuth et ouvre la page de connexion EBA (`/login`). Se
   connecter avec un email **ADMIN** → le flux revient automatiquement vers
   Claude, qui obtient un jeton.

### Donner accès à un collaborateur

1. Le collaborateur se connecte une première fois sur `https://<votre-domaine>/login`
   (il reçoit un code OTP par email) — cela crée son compte (rôle `USER`).
2. Un administrateur lui attribue le rôle **ADMIN** via
   **Dashboard → Utilisateurs** (`/dashboard/utilisateurs`).
3. Il peut alors ajouter le connecteur (étape ci-dessus). Pour **révoquer**
   l'accès : repasser son rôle à `USER` (ou le supprimer).

---

## 2. Clé statique — Claude Code (CLI) / clients machine

Pratique pour un usage « propriétaire » en ligne de commande. **Optionnelle** :
si `MCP_API_KEY` n'est pas définie, ce mode est simplement désactivé (OAuth reste
disponible).

1. Générer un jeton fort :

   ```bash
   openssl rand -hex 32
   ```

2. Le déclarer dans l'environnement (voir `.env.schema`) :

   ```
   MCP_API_KEY=<le-jeton-généré>
   ```

### Claude Code (CLI)

```bash
claude mcp add --transport http eba-menu https://<votre-domaine>/api/mcp \
  --header "Authorization: Bearer <MCP_API_KEY>"
```

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "eba-menu": {
      "type": "http",
      "url": "https://<votre-domaine>/api/mcp",
      "headers": { "Authorization": "Bearer <MCP_API_KEY>" }
    }
  }
}
```

> Claude Desktop sait aussi faire de l'OAuth : tu peux y ajouter le serveur
> **sans** en-tête (comme sur le web) pour utiliser ton compte ADMIN.

## Outils exposés

| Outil                            | Type     | Description                                        |
| -------------------------------- | -------- | -------------------------------------------------- |
| `get_menu`                       | lecture  | Menu complet avec identifiants internes (`id`)     |
| `get_daily_stats`                | lecture  | Stats agrégées de la journée en cours              |
| `get_range_stats`                | lecture  | KPIs sur une plage (`from`/`to`, `YYYY-MM-DD`)     |
| `get_daily_series`               | lecture  | Série jour par jour (commandes + CA) sur plage     |
| `get_top_products`               | lecture  | Top produits vendus sur une plage (`limit?`)       |
| `list_expense_categories`        | lecture  | Catégories de dépense (+ nombre de dépenses)       |
| `create_expense_category`        | écriture | Créer une catégorie de dépense                     |
| `update_expense_category`        | écriture | Renommer une catégorie de dépense                  |
| `delete_expense_category`        | écriture | Supprimer une catégorie (soft delete, conserve les dépenses) |
| `list_expenses`                  | lecture  | Lister les dépenses (filtres date/catégorie)       |
| `get_expense_summary`            | lecture  | Total + ventilation des dépenses par catégorie     |
| `create_expense`                 | écriture | Enregistrer une dépense                            |
| `update_expense`                 | écriture | Modifier une dépense (mise à jour **partielle**)   |
| `delete_expense`                 | écriture | Supprimer une dépense                              |
| `set_expense_receipt`            | écriture | Joindre un justificatif (base64 ou URL)            |
| `list_investment_sources`        | lecture  | Sources de financement (+ nombre d’apports)        |
| `create_investment_source`       | écriture | Créer une source de financement                    |
| `update_investment_source`       | écriture | Renommer une source de financement                 |
| `delete_investment_source`       | écriture | Supprimer une source (soft delete, conserve les apports) |
| `list_investments`               | lecture  | Lister les apports (filtres date/source/rembt)     |
| `get_investment_summary`         | lecture  | Total + ventilation par source + restant dû        |
| `create_investment`              | écriture | Enregistrer un apport / financement                |
| `update_investment`              | écriture | Modifier un apport (mise à jour **partielle**)     |
| `delete_investment`              | écriture | Supprimer un apport                                |
| `set_investment_document`        | écriture | Joindre un justificatif (base64 ou URL)            |
| `list_revenue_adjustments`       | lecture  | Lister les régularisations de recette (+ total)    |
| `get_revenue_adjustment_summary` | lecture  | Total net + ventilation par mode de paiement       |
| `create_revenue_adjustment`      | écriture | Ajuster le CA sans commande (montant signé)        |
| `update_revenue_adjustment`      | écriture | Modifier une régularisation (partiel)              |
| `delete_revenue_adjustment`      | écriture | Supprimer une régularisation                       |
| `get_cash_position`              | lecture  | Chiffres espèces d’un jour + clôture éventuelle    |
| `get_cash_closing`               | lecture  | Lire la clôture d’un jour                          |
| `list_cash_closings`             | lecture  | Historique des clôtures sur une plage              |
| `save_cash_closing`              | écriture | Créer / mettre à jour la clôture d’un jour         |
| `create_order`                   | écriture | Enregistrer une commande (antidatage possible)     |
| `list_orders`                    | lecture  | Lister les commandes (filtres statut/date/texte)   |
| `set_order_status`               | écriture | Changer le statut (récupérée, annulée, …)          |
| `mark_order_paid`                | écriture | Encaisser une commande (CASH/WAVE/OTHER)           |
| `apply_order_discount`           | écriture | Appliquer une remise de ligne (FCFA)               |
| `list_customers`                 | lecture  | Lister / rechercher des clients (+ stats)          |
| `get_customer`                   | lecture  | Détail d’un client (par `id` ou `phone`)           |
| `get_loyalty_card`               | lecture  | Carte à tampons d’un client + récompenses dispo    |
| `adjust_loyalty_stamps`          | écriture | Ajuster les tampons d’un client (correction)       |
| `get_loyalty_settings`           | lecture  | Lire la config de la carte à tampons               |
| `update_loyalty_settings`        | écriture | Modifier la config de la carte à tampons           |
| `create_category`                | écriture | Créer une catégorie                                |
| `update_category`                | écriture | Renommer une catégorie                             |
| `delete_category`                | écriture | Supprimer une catégorie (soft delete, cascade produits) |
| `toggle_category_availability`   | écriture | Afficher / masquer une catégorie                   |
| `move_category`                  | écriture | Réordonner une catégorie (`up` / `down`)           |
| `create_product`                 | écriture | Créer un produit                                   |
| `update_product`                 | écriture | Modifier un produit (mise à jour **partielle**)    |
| `set_product_image`              | écriture | Téléverser (base64) ou rattacher une image         |
| `move_product`                   | écriture | Réordonner un produit (`up` / `down`)              |
| `delete_product`                 | écriture | Supprimer un produit (soft delete)                 |
| `toggle_product_availability`    | écriture | Afficher / masquer un produit                      |
| `toggle_product_featured`        | écriture | Mettre en avant / retirer un produit               |
| `list_inventory_items`           | lecture  | Lister les références (filtres + stock/PMP)        |
| `get_inventory_item`             | lecture  | Détail d’une référence (+ achats / comptages)      |
| `get_inventory_summary`          | lecture  | KPIs inventaire (sous seuil, valeur stock…)        |
| `list_low_stock_items`           | lecture  | Références sous le seuil (à réapprovisionner)      |
| `list_inventory_purchases`       | lecture  | Lister les achats/réappro (filtres date/réf.)      |
| `list_inventory_counts`          | lecture  | Historique des comptages périodiques               |
| `get_inventory_count`            | lecture  | Rapport d’un comptage (entrées/sorties, PMP)       |
| `create_inventory_item`          | écriture | Créer une référence (+ stock d’ouverture)          |
| `update_inventory_item`          | écriture | Modifier une référence (mise à jour **partielle**) |
| `archive_inventory_item`         | écriture | Archiver une référence (suppression douce)         |
| `record_inventory_purchases`     | écriture | Réappro par lot (entrées + PMP, dépense liée)      |
| `cancel_restock_batch`           | écriture | Annuler un lot (restaure stock + PMP)              |
| `record_inventory_count`         | écriture | Enregistrer un comptage (déduit la conso)          |
| `get_inventory_settings`         | lecture  | Lire la config du module d’inventaire              |
| `update_inventory_settings`      | écriture | Modifier la config du module d’inventaire          |

Les prix et coûts (`coutMatiere`, `coutEmballage`) sont exprimés en **francs
CFA** (nombres entiers) et `get_menu` les renvoie. Commence toujours par
`get_menu` pour récupérer les `id` avant toute modification.

Les outils statistiques sont en **lecture seule**. Les plages `from`/`to` sont
au format `YYYY-MM-DD`, interprétées en **jour civil Abidjan** (bornes incluses),
et les montants (CA, panier moyen…) sont en francs CFA entiers.

Les outils **dépenses** couvrent l'administration complète (catégories +
dépenses, lecture **et** écriture) : on peut tout gérer sans ouvrir l'app.
`amount` est en francs CFA entiers, `date` au format `YYYY-MM-DD`, `categoryId`
provient de `list_expense_categories`, et `paymentMethod` ∈
`CASH`/`WAVE`/`BANK`/`OTHER`. Le justificatif photo se joint via
`set_expense_receipt` (base64 ou URL). Chaque dépense reçoit à la création un
**numéro de reçu** `receiptNo` (`DEP-YYYY-MM-NNNN`, séquence remise à zéro chaque
mois civil) ; ce numéro est **immuable** (il ne change pas si la `date` est
modifiée ensuite).

Les outils **investissements** (apports / financements injectés dans l'affaire :
capital, prêt, apport d'associé, subvention…) couvrent l'administration complète
(sources + apports, lecture **et** écriture). Distincts des dépenses
d'exploitation, ils n'entrent pas dans la marge nette. `amount` est en francs CFA
entiers, `date` au format `YYYY-MM-DD`, `sourceId` provient de
`list_investment_sources`, et `paymentMethod` ∈ `CASH`/`WAVE`/`BANK`/`OTHER` (canal
d'entrée des fonds). Pour un apport remboursable, `reimbursable: true` avec
éventuellement `amountRepaid` (≤ `amount`) et `dueDate` ; le restant dû est
calculé. Le justificatif se joint via `set_investment_document` (base64 ou URL).

Les outils **régularisation de recette** permettent d'ajuster le CA **sans créer
de commande** (ventes non saisies en temps réel, anciennes commandes perdues…).
`amount` est en francs CFA entiers **signés** (positif = recette ajoutée, négatif
= retirée), `date` au format `YYYY-MM-DD`, `paymentMode` ∈ `CASH`/`WAVE`/`OTHER`
(défaut CASH). L'ajustement est injecté dans `lib/stats.ts` : il remonte dans les
statistiques, la série journalière et — pour le mode espèces — la **clôture de
caisse** (qui dérive de `getDailyStats`). Il n'affecte ni le nombre de commandes
ni le panier moyen.

Les outils **clôture de caisse** (espèces, une clôture par jour civil) :
`get_cash_position` prépare une clôture (ventes/dépenses espèces du jour),
`save_cash_closing` l'enregistre (la caisse théorique et l'écart sont
recalculés : fond + ventes espèces − dépenses espèces ; écart = comptées −
théorique).

L'outil **commande** `create_order` enregistre une commande, y compris
**ancienne** : `orderDate` (`YYYY-MM-DD`, jour civil Abidjan) antidate la
commande (le `createdAt` est aligné sur ce jour pour un tri chronologique
correct) ; omis = jour en cours. Les `items` référencent les produits par
`productId` (issu de `get_menu`) + `quantity` ; prix, coûts et prix des
suppléments (désignés par `groupName` + `optionName`) sont résolus depuis le
menu — inutile de les fournir. Le total est calculé côté serveur (net après
remises). `orderType` ∈ `DELIVERY`/`DINE_IN`/`TAKEAWAY` (défaut `TAKEAWAY`) ;
`customerName`, `customerPhone` (normalisé, rattache la fidélité) et `note`
sont optionnels.

Le **suivi des commandes** : `list_orders` retrouve les commandes (filtres
statut / plage de jours / recherche, 20 par page) et renvoie leur `id` ;
`set_order_status` change le statut (NEW → PREPARING → READY → COMPLETED, ou
CANCELLED — « récupérée » = `COMPLETED`, transitions invalides refusées) ;
`mark_order_paid` encaisse (`CASH`/`WAVE`/`OTHER`), et pousse automatiquement en
cuisine une commande encore `NEW`. `apply_order_discount` applique une **remise**
(montant fixe FCFA, plafonnée) à une ou plusieurs lignes ciblées par leur
`cartId` (visible dans les `items` de `list_orders`) et recalcule le total
(0 pour retirer une remise ; refusé sur une commande terminée/annulée).

Les outils **clients** (CRM, lecture seule) exposent les clients identifiés par
**téléphone** (clé normalisée) avec leurs stats (nb de commandes, total dépensé,
dernière commande). `get_customer` accepte un `phone` saisi librement (normalisé
automatiquement) ou un `id`.

Les outils **fidélité** (carte à tampons) : `get_loyalty_card` (avancement +
récompenses dispo), `adjust_loyalty_stamps` (correction tracée),
`get_loyalty_settings` / `update_loyalty_settings` (config : montant min,
taille de carte, paliers, plafonds, règle 1/jour). Les tampons se gagnent
automatiquement à la création de commande (≥ montant min, 1/jour/numéro).

Les outils **inventaire** (matières premières & consommables) couvrent la gestion
périodique des stocks, lecture **et** écriture : `list_inventory_items` /
`get_inventory_item` / `get_inventory_summary` / `list_low_stock_items` (état du
stock, valorisé au **PMP** — prix moyen pondéré), `list_inventory_purchases` et
`record_inventory_purchases` (réapprovisionnement par lot : entrées avec
fournisseur et coût unitaire, mise à jour du PMP, option de création d'une dépense
liée du total), `cancel_restock_batch` (annule un lot et restaure stock + PMP,
refusé si un comptage postérieur existe), `list_inventory_counts` /
`get_inventory_count` / `record_inventory_count` (comptages périodiques : le stock
final compté déduit la consommation = stock initial + achats − stock final),
`create_inventory_item` / `update_inventory_item` (partiel) /
`archive_inventory_item` (suppression douce) pour les références, et
`get_inventory_settings` / `update_inventory_settings` pour la configuration. Les
quantités sont **décimales** ; les montants en francs CFA.

### Images produit

`set_product_image` permet à un client comme Claude de **donner une image à un
produit** sans passer par le dashboard :

- **Téléversement** : `imageBase64` (contenu encodé base64 ou data URI
  `data:image/png;base64,...`) + `mimeType`. Formats d'entrée acceptés :
  JPEG/PNG/WebP/AVIF/HEIC (max 25 MB). L'image est **redimensionnée** (≤ 2200 px)
  et **ré-encodée en WebP** côté serveur, puis enregistrée localement
  (`/uploads/products/<uuid>.webp`) et rattachée au produit.
- **Référence** : `imageUrl` pour pointer une image déjà hébergée (chemin
  `/uploads/...` ou URL http(s)).

`update_product` est **partiel** : ne fournis que les champs à changer. ⚠️ Si tu
passes `supplementGroups`, la liste entière est remplacée ; omets-la pour
conserver les suppléments existants.

Chaque groupe de suppléments et chaque option (« goût ») porte un drapeau
`available` (défaut `true`). Mis à `false`, l'élément reste configuré mais
disparaît du menu public (et de la caisse) — utile pour masquer temporairement
un parfum en rupture sans le supprimer.

**Soft delete** : `delete_category` et `delete_product` ne suppriment plus
réellement les lignes. Elles posent un `deletedAt` (la catégorie entraîne ses
produits) : les éléments sont masqués partout (y compris de `get_menu`) mais
conservés en base. Idem côté référentiels comptables — `delete_expense_category`
et `delete_investment_source` masquent sans casser les écritures rattachées, qui
gardent leur libellé ; recréer un libellé identique « ressuscite » la version
supprimée.

## Architecture

- `app/api/mcp/route.ts` — transport HTTP : auth (clé statique à temps constant
  **puis** OAuth via `withMcpAuth` + garde-fou rôle ADMIN), parsing JSON-RPC,
  CORS, invalidation du cache menu après écriture.
- `lib/auth.ts` — provider OAuth : plugin `mcp({ loginPage: '/login' })` de
  Better Auth + `baseURL` (issuer).
- `app/.well-known/oauth-authorization-server/route.ts` et
  `app/.well-known/oauth-protected-resource/route.ts` — découverte OAuth à la
  racine de l'origine (déléguée au plugin via `oAuthDiscoveryMetadata` /
  `oAuthProtectedResourceMetadata`).
- `app/(public)/login/page.tsx` — sait **reprendre** le flux OAuth après
  connexion (renvoie vers `/api/auth/mcp/authorize` avec les paramètres repris).
- `lib/mcp/handler.ts` — dispatcher JSON-RPC (`initialize`, `tools/list`,
  `tools/call`, `ping`), agnostique du framework.
- `lib/mcp/tools.ts` — registre des outils. Chaque outil **branche** la logique
  existante (`lib/menu.ts`, `lib/menu-mutations.ts`) et réutilise les schémas Zod
  centralisés : aucune logique métier dupliquée.

## Test rapide (curl)

```bash
TOKEN=<MCP_API_KEY>
URL=https://<votre-domaine>/api/mcp

# Lister les outils
curl -s -X POST "$URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq

# Lire le menu
curl -s -X POST "$URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_menu","arguments":{}}}' | jq
```
