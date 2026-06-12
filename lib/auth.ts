import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { mcp } from 'better-auth/plugins';
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

// URL canonique du serveur MCP, annoncée comme `resource` dans la métadonnée
// OAuth de ressource protégée (RFC 8707 / RFC 9728). DOIT correspondre
// exactement à l'URL du connecteur (`<domaine>/api/mcp`) : les clients stricts
// comme Claude comparent ce champ à l'URL du serveur et refusent la connexion
// en cas d'écart. Sans cette option, le plugin annonce l'origine seule
// (`https://eba.otw.ci`) ≠ `https://eba.otw.ci/api/mcp` → « Authorization failed »
// avant même l'écran de connexion.
const mcpResource = process.env.BETTER_AUTH_URL
  ? `${process.env.BETTER_AUTH_URL.replace(/\/+$/, '')}/api/mcp`
  : undefined;

export const auth = betterAuth({
  // `baseURL` explicite : le provider OAuth du plugin MCP s'en sert comme
  // `issuer` (et pour construire les URLs de découverte). Sans valeur, la
  // métadonnée OAuth refuse de se générer (`invalid_issuer`). On reprend
  // `BETTER_AUTH_URL` (= `NEXT_PUBLIC_SITE_URL`, la racine du domaine public).
  baseURL: process.env.BETTER_AUTH_URL,
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
    // Provider OAuth 2.0 pour le serveur MCP distant (`/api/mcp`). Permet aux
    // clients Claude (web/mobile/desktop) de se connecter sans en-tête Bearer
    // statique : l'administrateur s'authentifie avec son propre compte. Le
    // contrôle « réservé aux ADMIN » est fait dans la route `/api/mcp`. Quand un
    // client lance le flux et qu'aucune session n'existe, on renvoie vers
    // `/login` (qui sait reprendre le flux après connexion).
    mcp({ loginPage: '/login', resource: mcpResource }),
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
