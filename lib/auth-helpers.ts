import { headers } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import type { UserRole } from '@/generated/prisma/client';

type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
};

export type AuthorizedSession = {
  user: SessionUser;
};

// ASSISTANT_MANAGER = même accès opérationnel que MANAGER (menu, caisse,
// commandes, clôture, préparation, inventaire, clients, sondages, stats)
// SANS les modules finance (dépenses, investissements, régularisations) et
// sans accès au serveur MCP (cf. `MCP_ROLES` dans `app/api/mcp/route.ts`).
const MANAGER_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'ASSISTANT_MANAGER'];
const FINANCE_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'COMPTABLE'];
const STATS_ROLES: UserRole[] = [
  'ADMIN',
  'MANAGER',
  'ASSISTANT_MANAGER',
  'COMPTABLE',
];
const CASHIER_ROLES: UserRole[] = [
  'ADMIN',
  'MANAGER',
  'ASSISTANT_MANAGER',
  'CASHIER',
];
const KITCHEN_ROLES: UserRole[] = [
  'ADMIN',
  'MANAGER',
  'ASSISTANT_MANAGER',
  'CASHIER',
  'KITCHEN',
];
const CLOTURE_ROLES: UserRole[] = [
  'ADMIN',
  'MANAGER',
  'ASSISTANT_MANAGER',
  'CASHIER',
  'COMPTABLE',
];
const DASHBOARD_ROLES: UserRole[] = [
  'ADMIN',
  'MANAGER',
  'ASSISTANT_MANAGER',
  'CASHIER',
  'KITCHEN',
  'COMPTABLE',
];

// Validation runtime du shape renvoyé par Better Auth.
//
// Pourquoi : `auth.api.getSession()` est typé via inférence côté Better Auth,
// mais le résultat dépend des plugins (emailOTP, nextCookies, additionalFields).
// Un cast `as unknown as AuthorizedSession` masquerait toute dérive de shape
// (ex. plugin qui change `role` en `string | undefined`) et ouvrirait la porte
// à une coercion silencieuse côté `requireRole`.
//
// Périmètre : on valide UNIQUEMENT les champs critiques (`user.id`, `user.role`)
// car ce sont les seuls consommés par les guards. On reste permissif sur les
// autres (`name` nullable, `email` requis comme le type existant).
export const authorizedSessionSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    email: z.string(),
    name: z.string().nullable(),
    role: z.enum([
      'USER',
      'ADMIN',
      'CASHIER',
      'KITCHEN',
      'MANAGER',
      'COMPTABLE',
      'ASSISTANT_MANAGER',
    ]),
  }),
});

async function getSession(): Promise<AuthorizedSession | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    // Aucune session lisible : le cookie de session est absent ou non transmis.
    // C'est généralement un problème de cookie (`Secure`/préfixe, reverse proxy
    // qui ne forwarde pas X-Forwarded-Proto) et NON un problème de rôle.
    console.warn(
      '[auth-helpers] getSession: aucune session (cookie de session absent ou non lu)'
    );
    return null;
  }

  const parsed = authorizedSessionSchema.safeParse(session);
  if (!parsed.success) {
    // Dérive de shape côté Better Auth — on refuse explicitement plutôt que
    // de laisser un cast silencieux faire confiance à des données invalides.
    // On logge la valeur réelle de `role`/`name` pour diagnostiquer rapidement.
    console.error(
      '[auth-helpers] Session présente mais shape invalide — role=%o name=%o erreurs=%o',
      (session as { user?: { role?: unknown } }).user?.role,
      (session as { user?: { name?: unknown } }).user?.name,
      parsed.error.flatten()
    );
    return null;
  }
  return parsed.data;
}

/** Renvoie la session courante (ou null si non connecté). */
export async function getCurrentSession(): Promise<AuthorizedSession | null> {
  return getSession();
}

async function requireRole(allowed: UserRole[]): Promise<AuthorizedSession> {
  const session = await getSession();
  if (!session || !allowed.includes(session.user.role)) {
    throw new Error('Non autorisé');
  }
  return session;
}

/** ADMIN seul. */
export async function requireAdmin(): Promise<AuthorizedSession> {
  return requireRole(['ADMIN']);
}

/** ADMIN, MANAGER ou ASSISTANT_MANAGER. */
export async function requireManager(): Promise<AuthorizedSession> {
  return requireRole(MANAGER_ROLES);
}

/** ADMIN, MANAGER ou COMPTABLE (gestion financière). */
export async function requireFinance(): Promise<AuthorizedSession> {
  return requireRole(FINANCE_ROLES);
}

/** ADMIN, MANAGER, ASSISTANT_MANAGER ou COMPTABLE (lecture des statistiques). */
export async function requireStats(): Promise<AuthorizedSession> {
  return requireRole(STATS_ROLES);
}

/** ADMIN, MANAGER ou CASHIER. */
export async function requireCashier(): Promise<AuthorizedSession> {
  return requireRole(CASHIER_ROLES);
}

/** ADMIN, MANAGER, ASSISTANT_MANAGER, CASHIER ou KITCHEN (tout staff cuisine + caisse). */
export async function requireKitchen(): Promise<AuthorizedSession> {
  return requireRole(KITCHEN_ROLES);
}

/** ADMIN, MANAGER, ASSISTANT_MANAGER, CASHIER ou COMPTABLE (accès à la clôture de caisse). */
export async function requireCloture(): Promise<AuthorizedSession> {
  return requireRole(CLOTURE_ROLES);
}

/** N'importe quel rôle staff (tous sauf USER). */
export async function requireDashboardAccess(): Promise<AuthorizedSession> {
  return requireRole(DASHBOARD_ROLES);
}

export const ROLE_GROUPS = {
  DASHBOARD: DASHBOARD_ROLES,
  MANAGER_PLUS: MANAGER_ROLES,
  FINANCE: FINANCE_ROLES,
  STATS: STATS_ROLES,
  CASHIER_PLUS: CASHIER_ROLES,
  KITCHEN_PLUS: KITCHEN_ROLES,
  CLOTURE: CLOTURE_ROLES,
} as const;
