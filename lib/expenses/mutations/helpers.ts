import { Prisma } from '@/generated/prisma/client';

export function rethrowUniqueName(err: unknown): unknown {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    return new Error('Une catégorie porte déjà ce nom.');
  }
  return err;
}
