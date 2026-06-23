// lib/schemas/menu.ts
//
// Schémas Zod centralisés pour la structure du menu (catégories, produits,
// groupes de suppléments). Source : types existants dans config/menu.ts —
// on les passe en runtime-validable pour pouvoir valider les payloads des
// futurs endpoints d'admin du menu et garantir la cohérence.

import { z } from 'zod';

// ─── Suppléments ──────────────────────────────────────────────────────────────

export const supplementOptionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nom requis')
    .max(80, 'Nom trop long (max 80 caractères)'),
  price: z.number().int().nonnegative('Prix invalide'),
  // Disponibilité d'un « goût » : désactivé = conservé mais non sélectionnable
  // côté client. Optionnel (défaut true) pour la compat ascendante des payloads.
  available: z.boolean().optional().default(true),
});

export const supplementGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nom requis')
    .max(80, 'Nom trop long (max 80 caractères)'),
  type: z.enum(['single', 'multiple']),
  required: z.boolean(),
  // Disponibilité d'un groupe entier (ex. « Sirops ») : désactivé = masqué.
  available: z.boolean().optional().default(true),
  options: z
    .array(supplementOptionSchema)
    .min(1, 'Au moins une option requise'),
});

export type SupplementOptionInput = z.infer<typeof supplementOptionSchema>;
export type SupplementGroupInput = z.infer<typeof supplementGroupSchema>;

// ─── Produits ─────────────────────────────────────────────────────────────────

export const menuItemSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'Identifiant requis')
    .max(100, 'Identifiant trop long (max 100 caractères)'),
  name: z
    .string()
    .trim()
    .min(1, 'Nom requis')
    .max(120, 'Nom trop long (max 120 caractères)'),
  description: z
    .string()
    .trim()
    .max(500, 'Description trop longue (max 500 caractères)'),
  price: z.number().int().nonnegative('Prix invalide'),
  image: z.string().max(500).optional(),
  supplements: z.array(supplementGroupSchema).optional(),
  featured: z.boolean().optional(),
  featuredOrder: z.number().int().nonnegative().optional(),
  featuredBadge: z
    .string()
    .trim()
    .max(60, 'Badge trop long (max 60 caractères)')
    .optional(),
});

export type MenuItemInput = z.infer<typeof menuItemSchema>;

// ─── Catégories ───────────────────────────────────────────────────────────────

export const menuCategorySchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'Identifiant requis')
    .max(100, 'Identifiant trop long (max 100 caractères)'),
  name: z
    .string()
    .trim()
    .min(1, 'Nom requis')
    .max(120, 'Nom trop long (max 120 caractères)'),
  products: z.array(menuItemSchema),
});

export type MenuCategoryInput = z.infer<typeof menuCategorySchema>;

// ─── Menu complet ────────────────────────────────────────────────────────────

export const menuSchema = z.array(menuCategorySchema);
export type MenuInput = z.infer<typeof menuSchema>;
