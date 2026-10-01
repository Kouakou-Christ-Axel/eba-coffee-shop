'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-helpers';
import { sendStaffInviteEmail } from '@/lib/email';
import { normalizeSiteUrl } from '@/lib/site-url';
import { userEmailSchema } from '@/lib/schemas/user';
import type { UserRole } from '@/generated/prisma/client';

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrateur',
  MANAGER: 'Gérant·e',
  ASSISTANT_MANAGER: 'Gérant·e adjoint·e',
  COMPTABLE: 'Comptable',
  CASHIER: 'Caissier·e',
  KITCHEN: 'Cuisine',
  ANALYSTE: 'Analyste',
  USER: 'Client',
};

const inviteSchema = z.object({
  email: userEmailSchema,
  role: z.enum([
    'ADMIN',
    'MANAGER',
    'ASSISTANT_MANAGER',
    'COMPTABLE',
    'CASHIER',
    'KITCHEN',
    'ANALYSTE',
  ]),
});

export async function inviteStaff(input: { email: string; role: UserRole }) {
  const session = await requireAdmin();
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Entrée invalide');
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (existing) {
    // Si l'utilisateur existe déjà, on met juste à jour son rôle.
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: parsed.data.role },
    });
  } else {
    await prisma.user.create({
      data: {
        email: parsed.data.email,
        role: parsed.data.role,
        emailVerified: false,
      },
    });
  }

  const baseUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? '');
  try {
    await sendStaffInviteEmail({
      to: parsed.data.email,
      inviterName: session.user.name ?? 'L’équipe EBA',
      roleLabel: ROLE_LABELS[parsed.data.role],
      loginUrl: `${baseUrl}/login`,
    });
  } catch (err) {
    console.error('[invite] envoi email échoué :', err);
    // On ne reject pas : l'utilisateur est créé, il peut se connecter en
    // saisissant son email sur /login (l'OTP partira automatiquement).
  }

  revalidatePath('/dashboard/utilisateurs');
}

export async function updateUserRole(input: { id: string; role: UserRole }) {
  await requireAdmin();
  const parsed = z
    .object({
      id: z.string().min(1),
      role: z.enum([
        'ADMIN',
        'MANAGER',
        'ASSISTANT_MANAGER',
        'COMPTABLE',
        'CASHIER',
        'KITCHEN',
        'ANALYSTE',
        'USER',
      ]),
    })
    .safeParse(input);
  if (!parsed.success) {
    throw new Error('Entrée invalide');
  }

  await prisma.user.update({
    where: { id: parsed.data.id },
    data: { role: parsed.data.role },
  });

  revalidatePath('/dashboard/utilisateurs');
}

// Garde-fou commun à la désactivation et à la suppression : un admin ne peut
// agir ni sur son propre compte, ni retirer le dernier ADMIN actif (sans quoi
// plus personne ne pourrait gérer les comptes).
async function assertCanDeactivate(
  targetId: string,
  currentUserId: string
): Promise<void> {
  if (targetId === currentUserId) {
    throw new Error('Impossible de désactiver ou supprimer son propre compte');
  }
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { role: true },
  });
  if (target?.role === 'ADMIN') {
    const activeAdmins = await prisma.user.count({
      where: { role: 'ADMIN', disabledAt: null },
    });
    if (activeAdmins <= 1) {
      throw new Error('Impossible de retirer le dernier administrateur actif');
    }
  }
}

export async function disableUser(input: { id: string }) {
  const session = await requireAdmin();
  const id = z.string().min(1).parse(input.id);
  await assertCanDeactivate(id, session.user.id);

  await prisma.user.update({
    where: { id },
    data: { disabledAt: new Date() },
  });
  // Coupe immédiatement toute session active, en plus du check fait à chaque
  // requête dans `getSession` (lib/auth-helpers.ts).
  await prisma.session.deleteMany({ where: { userId: id } });

  revalidatePath('/dashboard/utilisateurs');
}

export async function enableUser(input: { id: string }) {
  await requireAdmin();
  const id = z.string().min(1).parse(input.id);

  await prisma.user.update({
    where: { id },
    data: { disabledAt: null },
  });

  revalidatePath('/dashboard/utilisateurs');
}

export async function deleteUser(input: { id: string }) {
  const session = await requireAdmin();
  const id = z.string().min(1).parse(input.id);
  await assertCanDeactivate(id, session.user.id);

  // Toutes les relations `createdById`/`closedById`/`moderatedById` vers User
  // sont en `onDelete: SetNull` (prisma/schema.prisma) : l'historique
  // (commandes, dépenses, clôtures…) reste intact, juste sans auteur.
  // `Session`/`Account`/`PushSubscription` sont en cascade.
  await prisma.user.delete({ where: { id } });

  revalidatePath('/dashboard/utilisateurs');
}
