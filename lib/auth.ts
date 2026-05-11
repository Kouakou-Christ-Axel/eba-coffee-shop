import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { nextCookies } from 'better-auth/next-js';
import prisma from '@/lib/prisma';
import { sendOtpEmail } from '@/lib/email';

export async function promoteAdminIfMatch(
  user: { id: string; email: string },
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
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'USER',
        input: false,
      },
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * 5,
      sendVerificationOTP: async ({ email, otp }) => {
        await sendOtpEmail(email, otp);
      },
    }),
    nextCookies(),
  ],
  databaseHooks: {
    user: {
      create: {
        after: promoteAdminIfMatch,
      },
    },
  },
});
