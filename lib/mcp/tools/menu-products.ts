// lib/mcp/tools/menu-products.ts
//
// Outils MCP — menu — produits.

import { z } from 'zod';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductAvailability,
  toggleProductFeatured,
  moveProduct,
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
      'Crée un produit dans une catégorie (via `categoryId`). Les prix et coûts ' +
      '(`coutMatiere`, `coutEmballage`) sont en francs CFA entiers. ' +
      '`supplementGroups` peut être un tableau vide. Chaque groupe a un `type` ' +
      '∈ single (un choix) / multiple (cases à cocher) / quantity (répartition ' +
      'd’une quantité entre options, ex. 3 parts sur 3 goûts), et peut poser ' +
      '`minSelect`/`maxSelect` (bornes sur le nombre d’options cochées ou la ' +
      'quantité totale répartie ; égaux = quantité exacte). Chaque groupe et ' +
      'chaque option (« goût ») accepte un drapeau `available` (défaut true) : ' +
      'passé à false, l’élément reste configuré mais n’est plus proposé côté ' +
      'client. ' +
      '`imageUrl` accepte un ' +
      'chemin local (`/uploads/products/...`, obtenu via `set_product_image`) ou ' +
      'une URL http(s) ; pour téléverser un fichier, utilise plutôt ' +
      '`set_product_image`. `scheduleId` (optionnel) assigne un planning ' +
      'récurrent (voir `list_product_schedules`) : le produit n’est alors ' +
      'commandable que les jours du planning (combiné par intersection avec ' +
      'celui de sa catégorie s’il en a un) — absent = tous les jours.',
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
    name: 'toggle_product_featured',
    toolset: 'menu',
    title: 'Mettre en avant / retirer un produit',
    description: 'Inverse le statut « mis en avant » d’un produit.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => toggleProductFeatured((args as { id: string }).id),
  },
];
