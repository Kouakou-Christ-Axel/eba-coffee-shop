import { z } from 'zod';
import { ADVANCE_ORDER_DAYS_MAX } from '@/config/constants';
import { supplementGroupSchema } from '@/lib/schemas/menu';
import { imageUrlSchema } from '@/lib/schemas/upload';

// Planning récurrent (voir `productScheduleSchema` plus bas) : `null` = aucun
// planning (tous les jours), absent = inchangé (mise à jour partielle).
export const scheduleFieldSchema = {
  scheduleId: z.string().min(1).nullable().optional(),
};

export const advanceOrderDaysFieldSchema = {
  advanceOrderDays: z
    .number()
    .int()
    .min(1)
    .max(ADVANCE_ORDER_DAYS_MAX)
    .nullable()
    .optional(),
};

export const createCategorySchema = z.object({
  name: z.string().min(1).max(80),
  ...scheduleFieldSchema,
  ...advanceOrderDaysFieldSchema,
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(80).optional(),
  ...scheduleFieldSchema,
  ...advanceOrderDaysFieldSchema,
});

export const featuredFieldsSchema = {
  featured: z.boolean().optional().default(false),
  featuredOrder: z.number().int().nonnegative().optional().default(0),
  featuredBadge: z.string().min(1).max(40).nullable().optional(),
};

export const costFieldsSchema = {
  coutMatiere: z.number().int().nonnegative().optional().default(0),
  coutEmballage: z.number().int().nonnegative().optional().default(0),
};

export const availabilityFieldsSchema = {
  // Stock vendable courant. `null`/absent = illimité (comportement inchangé) ;
  // entier = quantité restante suivie ; `0` = épuisé.
  stockQuantity: z.number().int().nonnegative().nullable().optional(),
  // Pause programmée (ISO 8601). `null`/absent = pas de pause.
  unavailableUntil: z.string().datetime().nullable().optional(),
  ...scheduleFieldSchema,
  ...advanceOrderDaysFieldSchema,
  requiresDeposit: z.boolean().optional(),
};

export const productInputSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  price: z.number().int().nonnegative(),
  imageUrl: imageUrlSchema.nullable().optional(),
  supplementGroups: z.array(supplementGroupSchema),
  ...featuredFieldsSchema,
  ...costFieldsSchema,
  ...availabilityFieldsSchema,
});

export const productUpdateSchema = z.object({
  categoryId: z.string().min(1).optional(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().min(1).max(500).optional(),
  price: z.number().int().nonnegative().optional(),
  imageUrl: imageUrlSchema.nullable().optional(),
  supplementGroups: z.array(supplementGroupSchema).optional(),
  featured: z.boolean().optional(),
  featuredOrder: z.number().int().nonnegative().optional(),
  featuredBadge: z.string().min(1).max(40).nullable().optional(),
  coutMatiere: z.number().int().nonnegative().optional(),
  coutEmballage: z.number().int().nonnegative().optional(),
  ...availabilityFieldsSchema,
});

export type CategoryInput = z.infer<typeof createCategorySchema>;

export type CategoryUpdate = z.infer<typeof updateCategorySchema>;

export type ProductInput = z.infer<typeof productInputSchema>;

export type ProductUpdate = z.infer<typeof productUpdateSchema>;
