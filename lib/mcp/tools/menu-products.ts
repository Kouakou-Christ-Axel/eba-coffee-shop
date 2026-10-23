// lib/mcp/tools/menu-products.ts
//
// Outils MCP — menu — produits.

import { z } from 'zod';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductAvailability,
  setProductAvailability,
  toggleProductFeatured,
  moveProduct,
  bulkUpdateProducts,
  bulkUpdateProductsSchema,
  productInputSchema,
  productUpdateSchema,
} from '@/lib/menu-mutations';
import { uploadProductImage } from '@/lib/cloudinary';
import { ALLOWED_IMAGE_MIME_TYPES, imageUrlSchema } from '@/lib/schemas/upload';
import { idSchema, resolveStoredImageUrl } from './helpers';
import type { McpTool } from './types';

export const menuProductsTools: McpTool[] = [
  // — Produits —
  {
    name: 'create_product',
    toolset: 'menu',
    title: 'Créer un produit',
    description:
      'Crée un produit dans la catégorie `categoryId`. Prix et coûts en FCFA ' +
      'entiers. `supplementGroups` peut être `[]`. Groupe : `type` single ' +
      '(un choix) / multiple (cases) / quantity (répartition d’une quantité ' +
      'entre options), bornes `minSelect`/`maxSelect` (égaux = quantité ' +
      'exacte) ; `available:false` sur un groupe ou une option le retire de la ' +
      'carte sans le supprimer. `imageUrl` : chemin `/uploads/...` ou URL ' +
      'http(s) (pour un fichier : `set_product_image`). `scheduleId` : ' +
      'planning récurrent (`list_product_schedules`), absent = tous les jours.',
    inputSchema: productInputSchema,
    readOnly: false,
    handler: (args) =>
      createProduct(args as z.infer<typeof productInputSchema>),
  },
  {
    name: 'update_product',
    toolset: 'menu',
    title: 'Modifier un produit',
    description:
      'Met à jour un produit existant de façon PARTIELLE : ne fournis que les ' +
      'champs à modifier, les autres restent inchangés. `categoryId` permet de ' +
      'déplacer le produit vers une autre catégorie. ⚠️ Si tu fournis ' +
      '`supplementGroups`, la liste entière est remplacée par celle fournie ' +
      '(omets-la pour conserver les suppléments existants). `scheduleId: null` ' +
      'retire le planning récurrent assigné (produit de nouveau disponible ' +
      'tous les jours, sous réserve du planning de sa catégorie).',
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
    toolset: 'menu',
    title: 'Définir l’image d’un produit',
    description:
      'Associe une image à un produit. Deux modes : (1) `imageUrl` — une URL ' +
      'http(s) publique est TÉLÉCHARGÉE côté serveur puis stockée localement ' +
      '(un chemin `/uploads/...` déjà local est conservé tel quel) ; c’est le ' +
      'moyen le plus simple depuis un chat. (2) `imageBase64` (contenu encodé ' +
      'en base64, ou data URI) + `mimeType` — utile quand on dispose des octets. ' +
      'Renvoie le produit mis à jour avec son `imageUrl`. Formats acceptés : ' +
      ALLOWED_IMAGE_MIME_TYPES.join(', ') +
      ' (converties automatiquement en WebP, redimensionnées, max 25 MB).',
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
      const { id, ...image } = args as {
        id: string;
        imageBase64?: string;
        mimeType?: string;
        imageUrl?: string;
      };
      const url = await resolveStoredImageUrl(
        image,
        uploadProductImage,
        uploadProductImage
      );
      return updateProduct(id, { imageUrl: url });
    },
  },
  {
    name: 'move_product',
    toolset: 'menu',
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
    toolset: 'menu',
    title: 'Supprimer un produit',
    description:
      'Supprime un produit. Soft delete : le produit est masqué partout (et ' +
      'retiré de `get_menu`) mais conservé en base.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteProduct((args as { id: string }).id),
  },
  {
    name: 'toggle_product_availability',
    toolset: 'menu',
    title: 'Afficher/masquer un produit',
    description:
      'Inverse la disponibilité d’un produit sur le site public (disponible ↔ ' +
      'indisponible).',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => toggleProductAvailability((args as { id: string }).id),
  },
  {
    name: 'set_product_availability',
    toolset: 'menu',
    title: 'Masquer / afficher un produit',
    description:
      'Fixe la disponibilité d’un produit sur le site public : `available: ' +
      'false` le MASQUE (désactivé), `true` l’affiche. Idempotent (rejouer ne ' +
      'change rien, contrairement à `toggle_product_availability`). Pour une ' +
      'pause temporaire avec retour automatique, utilise `pause_product`. ' +
      '`id` provient de `search_products` ou `get_menu`.',
    inputSchema: z.object({ id: idSchema, available: z.boolean() }),
    readOnly: false,
    handler: (args) => {
      const { id, available } = args as { id: string; available: boolean };
      return setProductAvailability(id, available);
    },
  },
  {
    name: 'toggle_product_featured',
    toolset: 'menu',
    title: 'Mettre en avant / retirer un produit',
    description: 'Inverse le statut « mis en avant » d’un produit.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => toggleProductFeatured((args as { id: string }).id),
  },
  {
    name: 'bulk_update_products',
    toolset: 'menu',
    title: 'Modifier plusieurs produits en une fois',
    description:
      'Modifie jusqu’à 100 produits en UNE requête, de façon atomique (tout ou ' +
      'rien : un id inconnu = rien n’est écrit). Deux modes : (1) `target` ' +
      '(`ids` OU `categoryId` = toute la catégorie) + `patch` commun ; (2) ' +
      '`items` : `[{ id, ...champs }]` quand les valeurs diffèrent par produit. ' +
      'Champs : `available`, `preorderable`, `featured`, `price`, `categoryId` ' +
      '(déplace en fin de catégorie), `scheduleId`/`advanceOrderDays`/' +
      '`unavailableUntil` (null = retirer), `requiresDeposit`. Valeurs absolues ' +
      '(rejouable). `supplementGroups` non géré : utilise `update_product`. ' +
      '`dryRun: true` renvoie l’aperçu avant/après sans rien écrire — à faire ' +
      'AVANT un lot important. Ids : `search_products`/`get_menu`.',
    inputSchema: bulkUpdateProductsSchema,
    readOnly: false,
    handler: (args) =>
      bulkUpdateProducts(args as z.infer<typeof bulkUpdateProductsSchema>),
  },
];
