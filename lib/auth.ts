import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { nextCookies } from 'better-auth/next-js';
import prisma from '@/lib/prisma';
import { sendOtpEmail } from '@/lib/email';

export async function promoteAdminIfMatch(user: { id: string; email: string }) {
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
  // Le site est servi en HTTPS derrière un reverse proxy (nginx -> PM2). On force
  // les cookies sécurisés pour que la pose ET la lecture du cookie de session
  // utilisent systématiquement le même préfixe `__Secure-`. Sans cela, si le
  // proxy ne transmet pas `X-Forwarded-Proto: https`, Better Auth détecte le
  // protocole comme HTTP et peut poser un cookie puis en relire un autre (nom
  // préfixé différemment), ce qui fait apparaître la session comme nulle juste
  // après la connexion (dashboard « Non autorisé »).
  advanced: {
    useSecureCookies: true,
  },
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
