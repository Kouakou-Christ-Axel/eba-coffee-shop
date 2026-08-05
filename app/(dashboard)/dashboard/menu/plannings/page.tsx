import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { listProductSchedules } from '@/lib/menu';
import { WEEKDAY_LABELS } from '@/lib/pickup-settings';
import { ScheduleForm } from './schedule-form';
import { ScheduleRowActions } from './schedule-row-actions';

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

function formatDays(days: number[]): string {
  if (days.length === 0) return '—';
  return WEEKDAY_ORDER.filter((d) => days.includes(d))
    .map((d) => WEEKDAY_LABELS[String(d)].slice(0, 3))
    .join(', ');
}

export default async function PlanningsPage() {
  const schedules = await listProductSchedules();

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
          <Link href="/dashboard/menu">
            <ChevronLeft className="size-4" />
            Menu
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Plannings récurrents</h1>
        <p className="text-sm text-muted-foreground">
          Un planning nommé (ex. « Jour du chocolat ») est assignable à
          plusieurs produits ET catégories à la fois — le modifier met à jour
          tout ce qui l’utilise.
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-semibold">
          Créer un nouveau planning
        </h2>
        <ScheduleForm />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Jours</TableHead>
            <TableHead>Produits</TableHead>
            <TableHead>Catégories</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedules.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell>
                <Badge variant="outline">{formatDays(s.days)}</Badge>
              </TableCell>
              <TableCell>{s.productCount}</TableCell>
              <TableCell>{s.categoryCount}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end">
                  <ScheduleRowActions
                    id={s.id}
                    name={s.name}
                    days={s.days}
                    inUse={s.productCount > 0 || s.categoryCount > 0}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {schedules.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                Aucun planning. Créez-en un ci-dessus.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
