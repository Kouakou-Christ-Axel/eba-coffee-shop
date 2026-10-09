import { type MockedFunction } from 'vitest';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import * as mutations from '@/lib/menu-mutations';

export const mockGetSession = auth.api.getSession as MockedFunction<
  typeof auth.api.getSession
>;
export const mockRevalidate = revalidatePath as MockedFunction<
  typeof revalidatePath
>;
export const mockCreateCategory = mutations.createCategory as MockedFunction<
  typeof mutations.createCategory
>;

export const adminSession = {
  user: { role: 'ADMIN', id: 'u1', email: 'admin@eba.ci', name: null },
  session: {},
} as never;
