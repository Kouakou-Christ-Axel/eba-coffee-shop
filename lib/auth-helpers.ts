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

const DASHBOARD_ROLES: UserRole[] = ['ADMIN', 'CASHIER', 'KITCHEN'];
const CASHIER_ROLES: UserRole[] = ['ADMIN', 'CASHIER'];
const KITCHEN_ROLES: UserRole[] = ['ADMIN', 'CASHIER', 'KITCHEN'];

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
    role: z.enum(['USER', 'ADMIN', 'CASHIER', 'KITCHEN']),
  }),
});

async function getSession(): Promise<AuthorizedSession | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const parsed = authorizedSessionSchema.safeParse(session);
  if (!parsed.success) {
    // Dérive de shape côté Better Auth — on refuse explicitement plutôt que
    // de laisser un cast silencieux faire confiance à des données invalides.
    console.error(
      '[auth-helpers] Session shape invalide:',
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

/** ADMIN ou CASHIER. */
export async function requireCashier(): Promise<AuthorizedSession> {
  return requireRole(CASHIER_ROLES);
}

/** ADMIN, CASHIER ou KITCHEN (tout staff cuisine + caisse). */
export async function requireKitchen(): Promise<AuthorizedSession> {
  return requireRole(KITCHEN_ROLES);
}

/** N'importe quel rôle staff (ADMIN, CASHIER, KITCHEN). */
export async function requireDashboardAccess(): Promise<AuthorizedSession> {
  return requireRole(DASHBOARD_ROLES);
}

export const ROLE_GROUPS = {
  DASHBOARD: DASHBOARD_ROLES,
  CASHIER_PLUS: CASHIER_ROLES,
  KITCHEN_PLUS: KITCHEN_ROLES,
} as const;
