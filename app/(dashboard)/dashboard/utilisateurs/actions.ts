'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-helpers';
import { sendStaffInviteEmail } from '@/lib/email';
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
  email: z.string().email('Email invalide'),
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

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
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
