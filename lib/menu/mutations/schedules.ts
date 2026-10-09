import { z } from 'zod';
import prisma from '@/lib/prisma';
import { triggerRestockAlerts } from '@/lib/restock-alerts';
import { dedupeDays } from './helpers';

export async function pauseProduct(id: string, until: Date) {
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) throw new Error('Produit introuvable');
  return prisma.product.update({
    where: { id },
    data: { unavailableUntil: until },
  });
}

export async function resumeProduct(id: string) {
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) throw new Error('Produit introuvable');
  const updated = await prisma.product.update({
    where: { id },
    data: { unavailableUntil: null },
  });
  triggerRestockAlerts();
  return updated;
}

export const productScheduleSchema = z.object({
  name: z.string().min(1).max(60),
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
});

export const productScheduleUpdateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
});

export type ProductScheduleInput = z.infer<typeof productScheduleSchema>;

export type ProductScheduleUpdateInput = z.infer<
  typeof productScheduleUpdateSchema
>;

export async function createProductSchedule(input: ProductScheduleInput) {
  const data = productScheduleSchema.parse(input);
  return prisma.productSchedule.create({
    data: { name: data.name, days: dedupeDays(data.days) },
  });
}

export async function updateProductSchedule(
  id: string,
  input: ProductScheduleUpdateInput
) {
  const data = productScheduleUpdateSchema.parse(input);
  return prisma.productSchedule.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.days !== undefined && { days: dedupeDays(data.days) }),
    },
  });
}

// Supprime le planning : les produits/catégories qui l'utilisaient redeviennent
// disponibles tous les jours (`onDelete: SetNull`), rien d'autre n'est touché.
export async function deleteProductSchedule(id: string) {
  return prisma.productSchedule.delete({ where: { id } });
}
