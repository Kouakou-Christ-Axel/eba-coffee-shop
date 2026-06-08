// lib/mcp/tools.ts
//
// Registre des outils (« tools ») exposés par le serveur MCP de gestion du menu.
//
// Principe : aucun outil ne réimplémente de logique métier. Chacun branche les
// fonctions existantes — `getMenuAdmin()` (lecture) et `lib/menu-mutations.ts`
// (écriture) — et réutilise les schémas Zod centralisés pour la validation des
// arguments. Conformément à CLAUDE.md, on ne redéclare pas de schémas inline :
// on importe ceux de `menu-mutations` et on les `.extend()` quand un `id` est
// requis.
//
// Le schéma Zod de chaque outil sert à deux choses :
//   1. générer le `inputSchema` JSON Schema renvoyé dans `tools/list` (via
//      `z.toJSONSchema`, natif en Zod 4) ;
//   2. valider les `arguments` reçus dans `tools/call` avant d'appeler le handler.

import { z } from 'zod';
import { getMenuAdmin } from '@/lib/menu';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryAvailability,
  moveCategory,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductAvailability,
  toggleProductFeatured,
  moveProduct,
  createCategorySchema,
  updateCategorySchema,
  productInputSchema,
  productUpdateSchema,
} from '@/lib/menu-mutations';
import { saveProductImageFromBase64 } from '@/lib/uploads';
import { ALLOWED_IMAGE_MIME_TYPES, imageUrlSchema } from '@/lib/schemas/upload';

// ─── Type d'un outil ────────────────────────────────────────────────────────

export type McpTool = {
  name: string;
  title: string;
  description: string;
  /** Schéma Zod des arguments. `z.object({})` = aucun argument. */
  inputSchema: z.ZodType;
  /** Outil en lecture seule (annotation MCP `readOnlyHint`). */
  readOnly: boolean;
  /** Exécute l'outil. Reçoit les arguments déjà validés par `inputSchema`. */
  handler: (args: unknown) => Promise<unknown>;
};

const idSchema = z.string().min(1, 'Identifiant requis');

// ─── Définitions ──────────────────────────────────────────────────────────────

export const tools: McpTool[] = [
  // — Lecture —
  {
    name: 'get_menu',
    title: 'Lire le menu',
    description:
      'Renvoie le menu complet avec les identifiants internes (id), y compris ' +
      'les catégories et produits masqués. Utilise les `id` renvoyés ici pour ' +
      'cibler les outils de modification.',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => getMenuAdmin(),
  },

  // — Catégories —
  {
    name: 'create_category',
    title: 'Créer une catégorie',
    description:
      'Crée une nouvelle catégorie de menu. Le slug et l’ordre sont générés ' +
      'automatiquement.',
    inputSchema: createCategorySchema,
    readOnly: false,
    handler: (args) => createCategory(args as { name: string }),
  },
  {
    name: 'update_category',
    title: 'Renommer une catégorie',
    description: 'Met à jour le nom d’une catégorie existante.',
    inputSchema: updateCategorySchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string; name: string };
      return updateCategory(id, rest);
    },
  },
  {
    name: 'delete_category',
    title: 'Supprimer une catégorie',
    description:
      'Supprime une catégorie et, par cascade, tous ses produits. Action ' +
      'irréversible.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteCategory((args as { id: string }).id),
  },
  {
    name: 'toggle_category_availability',
    title: 'Afficher/masquer une catégorie',
    description:
      'Inverse la visibilité d’une catégorie sur le site public (visible ↔ ' +
      'masquée).',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => toggleCategoryAvailability((args as { id: string }).id),
  },
  {
    name: 'move_category',
    title: 'Réordonner une catégorie',
    description:
      'Déplace une catégorie d’un cran vers le haut ou vers le bas dans ' +
      'l’ordre d’affichage.',
    inputSchema: z.object({
      id: idSchema,
      direction: z.enum(['up', 'down']),
    }),
    readOnly: false,
    handler: (args) => {
      const { id, direction } = args as {
        id: string;
        direction: 'up' | 'down';
      };
      return moveCategory(id, direction);
    },
  },

  // — Produits —
  {
    name: 'create_product',
    title: 'Créer un produit',
    description:
      'Crée un produit dans une catégorie (via `categoryId`). Les prix et coûts ' +
      '(`coutMatiere`, `coutEmballage`) sont en francs CFA entiers. ' +
      '`supplementGroups` peut être un tableau vide. `imageUrl` accepte un ' +
      'chemin local (`/uploads/products/...`, obtenu via `set_product_image`) ou ' +
      'une URL http(s) ; pour téléverser un fichier, utilise plutôt ' +
      '`set_product_image`.',
    inputSchema: productInputSchema,
    readOnly: false,
    handler: (args) =>
      createProduct(args as z.infer<typeof productInputSchema>),
  },
  {
    name: 'update_product',
    title: 'Modifier un produit',
    description:
      'Met à jour un produit existant de façon PARTIELLE : ne fournis que les ' +
      'champs à modifier, les autres restent inchangés. `categoryId` permet de ' +
      'déplacer le produit vers une autre catégorie. ⚠️ Si tu fournis ' +
      '`supplementGroups`, la liste entière est remplacée par celle fournie ' +
      '(omets-la pour conserver les suppléments existants).',
    inputSchema: productUpdateSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & z.infer<
        typeof productUpdateSchema
      >;
      return updateProduct(id, rest);
    },
  },
  {
    name: 'set_product_image',
    title: 'Définir l’image d’un produit',
    description:
      'Associe une image à un produit. Deux modes : (1) téléverser un fichier en ' +
      'fournissant `imageBase64` (contenu encodé en base64, ou data URI) + ' +
      '`mimeType` — l’image est stockée localement ; (2) référencer une image ' +
      'existante via `imageUrl` (chemin `/uploads/...` ou URL http(s)). Renvoie ' +
      'le produit mis à jour avec son `imageUrl`. Formats acceptés : ' +
      ALLOWED_IMAGE_MIME_TYPES.join(', ') +
      ' (max 5 MB).',
    inputSchema: z
      .object({
        id: idSchema,
        imageBase64: z
          .string()
          .min(1)
          .optional()
          .describe('Image encodée en base64 (brut) ou data URI.'),
        mimeType: z
          .enum(ALLOWED_IMAGE_MIME_TYPES)
          .optional()
          .describe('Type MIME requis avec imageBase64 (sauf data URI).'),
        imageUrl: imageUrlSchema
          .optional()
          .describe('Alternative : URL/chemin d’une image déjà hébergée.'),
      })
      .refine((v) => Boolean(v.imageBase64) || Boolean(v.imageUrl), {
        message: 'Fournis soit `imageBase64`, soit `imageUrl`.',
      }),
    readOnly: false,
    handler: async (args) => {
      const { id, imageBase64, mimeType, imageUrl } = args as {
        id: string;
        imageBase64?: string;
        mimeType?: string;
        imageUrl?: string;
      };
      const url = imageBase64
        ? await saveProductImageFromBase64(imageBase64, mimeType)
        : imageUrl!;
      return updateProduct(id, { imageUrl: url });
    },
  },
  {
    name: 'move_product',
    title: 'Réordonner un produit',
    description:
      'Déplace un produit d’un cran vers le haut ou vers le bas dans l’ordre ' +
      'd’affichage, au sein de sa catégorie.',
    inputSchema: z.object({
      id: idSchema,
      direction: z.enum(['up', 'down']),
    }),
    readOnly: false,
    handler: (args) => {
      const { id, direction } = args as {
        id: string;
        direction: 'up' | 'down';
      };
      return moveProduct(id, direction);
    },
  },
  {
    name: 'delete_product',
    title: 'Supprimer un produit',
    description: 'Supprime définitivement un produit. Action irréversible.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteProduct((args as { id: string }).id),
  },
  {
    name: 'toggle_product_availability',
    title: 'Afficher/masquer un produit',
    description:
      'Inverse la disponibilité d’un produit sur le site public (disponible ↔ ' +
      'indisponible).',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => toggleProductAvailability((args as { id: string }).id),
  },
  {
    name: 'toggle_product_featured',
    title: 'Mettre en avant / retirer un produit',
    description: 'Inverse le statut « mis en avant » d’un produit.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => toggleProductFeatured((args as { id: string }).id),
  },
];

export const toolsByName = new Map(tools.map((t) => [t.name, t]));
