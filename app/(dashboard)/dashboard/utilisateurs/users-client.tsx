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
import { useConfirmDialog } from '../_components/use-confirm-dialog';
import {
  inviteStaff,
  updateUserRole,
  disableUser,
  enableUser,
  deleteUser,
} from './actions';
import type { UserRole } from '@/generated/prisma/client';

type StaffUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
  disabledAt: string | null;
};

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'CASHIER', label: 'Caissier·e' },
  { value: 'KITCHEN', label: 'Cuisine' },
  { value: 'COMPTABLE', label: 'Comptable' },
  { value: 'ANALYSTE', label: 'Analyste' },
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
  ANALYSTE: 'Analyste',
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
  ANALYSTE: 'secondary',
  USER: 'outline',
};

export function UsersClient({
  users,
  currentUserId,
}: {
  users: StaffUser[];
  currentUserId: string;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('CASHIER');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirm, confirmDialog } = useConfirmDialog();

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

  const handleDisable = async (user: StaffUser) => {
    const ok = await confirm({
      title: 'Désactiver ce compte',
      message: `${user.email} ne pourra plus se connecter au dashboard. Cette action est réversible.`,
      confirmLabel: 'Désactiver',
      destructive: true,
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      try {
        await disableUser({ id: user.id });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inattendue');
      }
    });
  };

  const handleEnable = (user: StaffUser) => {
    setError(null);
    startTransition(async () => {
      try {
        await enableUser({ id: user.id });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inattendue');
      }
    });
  };

  const handleDelete = async (user: StaffUser) => {
    const ok = await confirm({
      title: 'Supprimer ce compte',
      message: `${user.email} sera définitivement supprimé. Son historique (commandes, dépenses, etc.) est conservé mais n'affichera plus son nom. Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteUser({ id: user.id });
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
            <TableHead>Statut</TableHead>
            <TableHead>Créé le</TableHead>
            <TableHead />
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            const isDisabled = u.disabledAt !== null;
            return (
              <TableRow key={u.id} className={isDisabled ? 'opacity-60' : ''}>
                <TableCell className="font-medium">{u.email}</TableCell>
                <TableCell>{u.name ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={ROLE_VARIANTS[u.role]}>
                    {ROLE_LABELS[u.role]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {isDisabled ? (
                    <Badge variant="outline">Désactivé</Badge>
                  ) : (
                    <Badge variant="default">Actif</Badge>
                  )}
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
                    <option value="ANALYSTE">Analyste</option>
                    <option value="ASSISTANT_MANAGER">
                      Gérant·e adjoint·e
                    </option>
                    <option value="MANAGER">Gérant·e</option>
                    <option value="ADMIN">Administrateur</option>
                  </select>
                </TableCell>
                <TableCell>
                  {!isSelf && (
                    <div className="flex gap-2">
                      {isDisabled ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleEnable(u)}
                        >
                          Réactiver
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleDisable(u)}
                        >
                          Désactiver
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleDelete(u)}
                      >
                        Supprimer
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {confirmDialog}
    </div>
  );
}
