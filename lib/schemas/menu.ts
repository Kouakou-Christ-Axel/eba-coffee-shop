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

export const supplementGroupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Nom requis')
      .max(80, 'Nom trop long (max 80 caractères)'),
    // 'single' : un seul choix (radio). 'multiple' : cases à cocher, chaque
    // option 0 ou 1 fois. 'quantity' : quantité par option (ex. répartir 3
    // parts entre 3 goûts) — chaque option peut être choisie plusieurs fois.
    type: z.enum(['single', 'multiple', 'quantity']),
    required: z.boolean(),
    // Disponibilité d'un groupe entier (ex. « Sirops ») : désactivé = masqué.
    available: z.boolean().optional().default(true),
    // Bornes sur le nombre d'options cochées ('multiple') ou sur la quantité
    // totale répartie ('quantity'). `null`/absent = pas de borne. Ignorées
    // pour 'single'. Pour une quantité exacte (ex. 3 parts), poser
    // minSelect = maxSelect = 3.
    minSelect: z.number().int().nonnegative().nullable().optional(),
    maxSelect: z.number().int().positive().nullable().optional(),
    options: z
      .array(supplementOptionSchema)
      .min(1, 'Au moins une option requise'),
  })
  .refine(
    (g) =>
      g.minSelect == null || g.maxSelect == null || g.minSelect <= g.maxSelect,
    {
      message: 'Le minimum ne peut pas dépasser le maximum',
      path: ['minSelect'],
    }
  );

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
