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

| Outil                          | Type     | Description                                     |
| ------------------------------ | -------- | ----------------------------------------------- |
| `get_menu`                     | lecture  | Menu complet avec identifiants internes (`id`)  |
| `create_category`              | écriture | Créer une catégorie                             |
| `update_category`              | écriture | Renommer une catégorie                          |
| `delete_category`              | écriture | Supprimer une catégorie (cascade produits)      |
| `toggle_category_availability` | écriture | Afficher / masquer une catégorie                |
| `move_category`                | écriture | Réordonner une catégorie (`up` / `down`)        |
| `create_product`               | écriture | Créer un produit                                |
| `update_product`               | écriture | Modifier un produit (mise à jour **partielle**) |
| `set_product_image`            | écriture | Téléverser (base64) ou rattacher une image      |
| `move_product`                 | écriture | Réordonner un produit (`up` / `down`)           |
| `delete_product`               | écriture | Supprimer un produit                            |
| `toggle_product_availability`  | écriture | Afficher / masquer un produit                   |
| `toggle_product_featured`      | écriture | Mettre en avant / retirer un produit            |

Les prix et coûts (`coutMatiere`, `coutEmballage`) sont exprimés en **francs
CFA** (nombres entiers) et `get_menu` les renvoie. Commence toujours par
`get_menu` pour récupérer les `id` avant toute modification.

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
