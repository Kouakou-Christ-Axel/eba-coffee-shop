import { headers } from 'next/headers';
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

async function getSession(): Promise<AuthorizedSession | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return session as unknown as AuthorizedSession;
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
