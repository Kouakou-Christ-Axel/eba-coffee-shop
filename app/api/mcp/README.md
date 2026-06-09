# Serveur MCP — Gestion du menu

Serveur [MCP](https://modelcontextprotocol.io) distant qui expose la **gestion du
menu** (catégories et produits) à un client compatible comme Claude. Il permet de
consulter et modifier le menu en langage naturel.

- **Endpoint** : `POST https://<votre-domaine>/api/mcp`
- **Transport** : Streamable HTTP (JSON-RPC 2.0), sans état
- **Auth** : `Authorization: Bearer <MCP_API_KEY>`

## Configuration

1. Générer un jeton fort :

   ```bash
   openssl rand -hex 32
   ```

2. Le déclarer dans l'environnement (voir `.env.schema`) :

   ```
   MCP_API_KEY=<le-jeton-généré>
   ```

> Si `MCP_API_KEY` n'est pas définie, le serveur répond **503** : aucun accès
> n'est possible sans clé (le menu étant modifiable en écriture).

## Brancher un client

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

## Outils exposés

| Outil                          | Type     | Description                                      |
| ------------------------------ | -------- | ------------------------------------------------ |
| `get_menu`                     | lecture  | Menu complet avec identifiants internes (`id`)   |
| `get_daily_stats`              | lecture  | Stats agrégées de la journée en cours            |
| `get_range_stats`              | lecture  | KPIs sur une plage (`from`/`to`, `YYYY-MM-DD`)   |
| `get_daily_series`             | lecture  | Série jour par jour (commandes + CA) sur plage   |
| `get_top_products`             | lecture  | Top produits vendus sur une plage (`limit?`)     |
| `list_expense_categories`      | lecture  | Catégories de dépense (+ nombre de dépenses)     |
| `create_expense_category`      | écriture | Créer une catégorie de dépense                   |
| `update_expense_category`      | écriture | Renommer une catégorie de dépense                |
| `delete_expense_category`      | écriture | Supprimer une catégorie (refusé si utilisée)     |
| `list_expenses`                | lecture  | Lister les dépenses (filtres date/catégorie)     |
| `get_expense_summary`          | lecture  | Total + ventilation des dépenses par catégorie   |
| `create_expense`               | écriture | Enregistrer une dépense                          |
| `update_expense`               | écriture | Modifier une dépense (mise à jour **partielle**) |
| `delete_expense`               | écriture | Supprimer une dépense                            |
| `set_expense_receipt`          | écriture | Joindre un justificatif (base64 ou URL)          |
| `get_cash_position`            | lecture  | Chiffres espèces d’un jour + clôture éventuelle  |
| `get_cash_closing`             | lecture  | Lire la clôture d’un jour                        |
| `list_cash_closings`           | lecture  | Historique des clôtures sur une plage            |
| `save_cash_closing`            | écriture | Créer / mettre à jour la clôture d’un jour       |
| `create_order`                 | écriture | Enregistrer une commande (antidatage possible)   |
| `list_orders`                  | lecture  | Lister les commandes (filtres statut/date/texte) |
| `set_order_status`             | écriture | Changer le statut (récupérée, annulée, …)        |
| `mark_order_paid`              | écriture | Encaisser une commande (CASH/WAVE/OTHER)         |
| `apply_order_discount`         | écriture | Appliquer une remise de ligne (FCFA)             |
| `list_customers`               | lecture  | Lister / rechercher des clients (+ stats)        |
| `get_customer`                 | lecture  | Détail d’un client (par `id` ou `phone`)         |
| `get_loyalty_card`             | lecture  | Carte à tampons d’un client + récompenses dispo  |
| `adjust_loyalty_stamps`        | écriture | Ajuster les tampons d’un client (correction)     |
| `get_loyalty_settings`         | lecture  | Lire la config de la carte à tampons             |
| `update_loyalty_settings`      | écriture | Modifier la config de la carte à tampons         |
| `create_category`              | écriture | Créer une catégorie                              |
| `update_category`              | écriture | Renommer une catégorie                           |
| `delete_category`              | écriture | Supprimer une catégorie (cascade produits)       |
| `toggle_category_availability` | écriture | Afficher / masquer une catégorie                 |
| `move_category`                | écriture | Réordonner une catégorie (`up` / `down`)         |
| `create_product`               | écriture | Créer un produit                                 |
| `update_product`               | écriture | Modifier un produit (mise à jour **partielle**)  |
| `set_product_image`            | écriture | Téléverser (base64) ou rattacher une image       |
| `move_product`                 | écriture | Réordonner un produit (`up` / `down`)            |
| `delete_product`               | écriture | Supprimer un produit                             |
| `toggle_product_availability`  | écriture | Afficher / masquer un produit                    |
| `toggle_product_featured`      | écriture | Mettre en avant / retirer un produit             |

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
`set_expense_receipt` (base64 ou URL).

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

### Images produit

`set_product_image` permet à un client comme Claude de **donner une image à un
produit** sans passer par le dashboard :

- **Téléversement** : `imageBase64` (contenu encodé base64 ou data URI
  `data:image/png;base64,...`) + `mimeType`. L'image est enregistrée localement
  (`/uploads/products/<uuid>.<ext>`, max 5 MB, JPEG/PNG/WebP/AVIF) et rattachée
  au produit.
- **Référence** : `imageUrl` pour pointer une image déjà hébergée (chemin
  `/uploads/...` ou URL http(s)).

`update_product` est **partiel** : ne fournis que les champs à changer. ⚠️ Si tu
passes `supplementGroups`, la liste entière est remplacée ; omets-la pour
conserver les suppléments existants.

## Architecture

- `app/api/mcp/route.ts` — transport HTTP : auth (Bearer, comparaison à temps
  constant), parsing JSON-RPC, invalidation du cache menu après écriture.
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
