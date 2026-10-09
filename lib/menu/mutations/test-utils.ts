// Mocks typés partagés ; à importer APRÈS les `vi.mock` du test.

import { type MockedFunction } from 'vitest';
import prisma from '@/lib/prisma';

export const mockCatCreate = prisma.menuCategory.create as MockedFunction<
  typeof prisma.menuCategory.create
>;
export const mockCatUpdate = prisma.menuCategory.update as MockedFunction<
  typeof prisma.menuCategory.update
>;
export const mockCatFindUnique = prisma.menuCategory
  .findUnique as MockedFunction<typeof prisma.menuCategory.findUnique>;
export const mockCatFindMany = prisma.menuCategory.findMany as MockedFunction<
  typeof prisma.menuCategory.findMany
>;
export const mockProdCreate = prisma.product.create as MockedFunction<
  typeof prisma.product.create
>;
export const mockProdUpdate = prisma.product.update as MockedFunction<
  typeof prisma.product.update
>;
export const mockProdUpdateMany = prisma.product.updateMany as MockedFunction<
  typeof prisma.product.updateMany
>;
export const mockProdFindUnique = prisma.product.findUnique as MockedFunction<
  typeof prisma.product.findUnique
>;
export const mockProdFindMany = prisma.product.findMany as MockedFunction<
  typeof prisma.product.findMany
>;
export const mockSupGroupFindMany = prisma.supplementGroup
  .findMany as MockedFunction<typeof prisma.supplementGroup.findMany>;
export const mockSupGroupCreate = prisma.supplementGroup
  .create as MockedFunction<typeof prisma.supplementGroup.create>;
export const mockSupOptionUpdate = prisma.supplementOption
  .update as MockedFunction<typeof prisma.supplementOption.update>;
export const mockSupOptionCreate = prisma.supplementOption
  .create as MockedFunction<typeof prisma.supplementOption.create>;
export const mockSupOptionDeleteMany = prisma.supplementOption
  .deleteMany as MockedFunction<typeof prisma.supplementOption.deleteMany>;
export const mockScheduleCreate = prisma.productSchedule
  .create as MockedFunction<typeof prisma.productSchedule.create>;
export const mockScheduleUpdate = prisma.productSchedule
  .update as MockedFunction<typeof prisma.productSchedule.update>;
export const mockScheduleDelete = prisma.productSchedule
  .delete as MockedFunction<typeof prisma.productSchedule.delete>;
export const mockWeeklySpecialCreate = prisma.productWeeklySpecial
  .create as MockedFunction<typeof prisma.productWeeklySpecial.create>;
export const mockWeeklySpecialUpdate = prisma.productWeeklySpecial
  .update as MockedFunction<typeof prisma.productWeeklySpecial.update>;
export const mockWeeklySpecialDelete = prisma.productWeeklySpecial
  .delete as MockedFunction<typeof prisma.productWeeklySpecial.delete>;
