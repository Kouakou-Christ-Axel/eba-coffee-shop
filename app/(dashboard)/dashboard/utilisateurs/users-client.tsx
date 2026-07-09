'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { inviteStaff, updateUserRole } from './actions';
import type { UserRole } from '@/generated/prisma/client';

type StaffUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
};

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'CASHIER', label: 'Caissier·e' },
  { value: 'KITCHEN', label: 'Cuisine' },
  { value: 'COMPTABLE', label: 'Comptable' },
  { value: 'ASSISTANT_MANAGER', label: 'Gérant·e adjoint·e' },
  { value: 'MANAGER', label: 'Gérant·e' },
  { value: 'ADMIN', label: 'Administrateur' },
];

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrateur',
  MANAGER: 'Gérant·e',
  ASSISTANT_MANAGER: 'Gérant·e adjoint·e',
  COMPTABLE: 'Comptable',
  CASHIER: 'Caissier·e',
  KITCHEN: 'Cuisine',
  USER: 'Client',
};

const ROLE_VARIANTS: Record<
  UserRole,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  ADMIN: 'destructive',
  MANAGER: 'destructive',
  ASSISTANT_MANAGER: 'secondary',
  COMPTABLE: 'secondary',
  CASHIER: 'default',
  KITCHEN: 'secondary',
  USER: 'outline',
};

export function UsersClient({ users }: { users: StaffUser[] }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('CASHIER');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleInvite = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await inviteStaff({ email, role });
        setEmail('');
        setSuccess(`Invitation envoyée à ${email}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inattendue');
      }
    });
  };

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    startTransition(async () => {
      try {
        await updateUserRole({ id: userId, role: newRole });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inattendue');
      }
    });
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleInvite}
        className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="invite-email">Email à inviter</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="staff@eba.ci"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-role">Rôle</Label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={isPending || !email}>
          {isPending ? 'Envoi…' : 'Inviter'}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Nom</TableHead>
            <TableHead>Rôle</TableHead>
            <TableHead>Créé le</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.email}</TableCell>
              <TableCell>{u.name ?? '—'}</TableCell>
              <TableCell>
                <Badge variant={ROLE_VARIANTS[u.role]}>
                  {ROLE_LABELS[u.role]}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(u.createdAt).toLocaleDateString('fr-FR')}
              </TableCell>
              <TableCell>
                <select
                  value={u.role}
                  onChange={(e) =>
                    handleRoleChange(u.id, e.target.value as UserRole)
                  }
                  disabled={isPending}
                  className="rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm"
                >
                  <option value="USER">Client</option>
                  <option value="CASHIER">Caissier·e</option>
                  <option value="KITCHEN">Cuisine</option>
                  <option value="COMPTABLE">Comptable</option>
                  <option value="ASSISTANT_MANAGER">Gérant·e adjoint·e</option>
                  <option value="MANAGER">Gérant·e</option>
                  <option value="ADMIN">Administrateur</option>
                </select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
