import { requireAdmin } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';
import { UsersClient } from './users-client';
import type { UserRole } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <p className="text-sm text-muted-foreground">
          Invite ton équipe à accéder au dashboard. Chaque rôle a ses propres
          permissions.
        </p>
      </div>
      <UsersClient
        users={users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role as UserRole,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
