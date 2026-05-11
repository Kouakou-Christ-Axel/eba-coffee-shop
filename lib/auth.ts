import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import prisma from '@/lib/prisma';
import { nextCookies } from 'better-auth/next-js';

export async function promoteAdminIfMatch(
  user: { id: string; email: string },
  _context?: unknown
) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && user.email === adminEmail) {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    });
  }
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [nextCookies()],
  databaseHooks: {
    user: {
      create: {
        after: promoteAdminIfMatch,
      },
    },
  },
});
