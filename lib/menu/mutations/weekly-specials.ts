import { z } from 'zod';
import prisma from '@/lib/prisma';

export const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const productWeeklySpecialSchema = z
  .object({
    startDate: z.string().regex(DATE_ONLY_RE, 'Format YYYY-MM-DD'),
    endDate: z.string().regex(DATE_ONLY_RE, 'Format YYYY-MM-DD'),
    note: z.string().max(200).nullable().optional(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'La date de fin doit être après la date de début',
    path: ['endDate'],
  });

export const productWeeklySpecialUpdateSchema = z
  .object({
    startDate: z.string().regex(DATE_ONLY_RE, 'Format YYYY-MM-DD').optional(),
    endDate: z.string().regex(DATE_ONLY_RE, 'Format YYYY-MM-DD').optional(),
    note: z.string().max(200).nullable().optional(),
  })
  .refine(
    (v) =>
      v.startDate === undefined ||
      v.endDate === undefined ||
      v.endDate >= v.startDate,
    {
      message: 'La date de fin doit être après la date de début',
      path: ['endDate'],
    }
  );

export type ProductWeeklySpecialInput = z.infer<
  typeof productWeeklySpecialSchema
>;

export type ProductWeeklySpecialUpdateInput = z.infer<
  typeof productWeeklySpecialUpdateSchema
>;

export async function createProductWeeklySpecial(
  productId: string,
  input: ProductWeeklySpecialInput
) {
  const data = productWeeklySpecialSchema.parse(input);
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) throw new Error('Produit introuvable');
  return prisma.productWeeklySpecial.create({
    data: {
      productId,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      note: data.note ?? null,
    },
  });
}

export async function updateProductWeeklySpecial(
  id: string,
  input: ProductWeeklySpecialUpdateInput
) {
  const data = productWeeklySpecialUpdateSchema.parse(input);
  return prisma.productWeeklySpecial.update({
    where: { id },
    data: {
      ...(data.startDate !== undefined && {
        startDate: new Date(data.startDate),
      }),
      ...(data.endDate !== undefined && { endDate: new Date(data.endDate) }),
      ...(data.note !== undefined && { note: data.note }),
    },
  });
}

export async function deleteProductWeeklySpecial(id: string) {
  return prisma.productWeeklySpecial.delete({ where: { id } });
}
