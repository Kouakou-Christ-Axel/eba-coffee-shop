import Link from 'next/link';
import prisma from '@/lib/prisma';
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
import { getMenuSettings } from '@/lib/menu-settings-db';
import { listProductSchedules } from '@/lib/menu';
import { CategoryForm } from './category-form';
import { CategoryRowActions } from './category-row-actions';
import { MenuPdfField } from './menu-pdf-field';

export default async function MenuPage() {
  const [categories, menuSettings, schedules] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { products: { where: { deletedAt: null } } } },
        schedule: { select: { id: true, name: true } },
      },
    }),
    getMenuSettings(),
    listProductSchedules(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Menu — Catégories</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/menu/plannings">Plannings récurrents</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/menu/stock-supplements">Stock par goût</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/menu/extras-globaux">Extras globaux</Link>
          </Button>
        </div>
      </div>

      <MenuPdfField initialUrl={menuSettings.menuPdfUrl} />

      <div className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-semibold">
          Ajouter une nouvelle catégorie
        </h2>
        <CategoryForm schedules={schedules} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Produits</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((cat, idx) => (
            <TableRow key={cat.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/dashboard/menu/${cat.id}`}
                  className="hover:underline"
                >
                  {cat.name}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {cat.slug}
              </TableCell>
              <TableCell>{cat._count.products}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={cat.available ? 'default' : 'outline'}>
                    {cat.available ? 'Visible' : 'Masquée'}
                  </Badge>
                  {cat.schedule && (
                    <Badge variant="outline" title="Planning récurrent">
                      {cat.schedule.name}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/dashboard/menu/${cat.id}`}>Produits →</Link>
                  </Button>
                  <CategoryRowActions
                    id={cat.id}
                    name={cat.name}
                    available={cat.available}
                    scheduleId={cat.scheduleId}
                    advanceOrderDays={cat.advanceOrderDays}
                    schedules={schedules}
                    isFirst={idx === 0}
                    isLast={idx === categories.length - 1}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {categories.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                Aucune catégorie. Créez-en une ci-dessus.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
