import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import prisma from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ProductRowActions } from './product-row-actions';
import { ArrowLeft } from 'lucide-react';

export default async function CategoryProductsPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;

  const category = await prisma.menuCategory.findUnique({
    where: { id: categoryId },
    include: {
      products: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          price: true,
          coutMatiere: true,
          coutEmballage: true,
          imageUrl: true,
          available: true,
          featured: true,
          featuredBadge: true,
        },
      },
    },
  });

  if (!category) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
          <Link href="/dashboard/menu">
            <ArrowLeft /> Catégories
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{category.name}</h1>
          <Button asChild>
            <Link href={`/dashboard/menu/${categoryId}/produits/new`}>
              + Nouveau produit
            </Link>
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Image</TableHead>
            <TableHead>Nom</TableHead>
            <TableHead>Prix</TableHead>
            <TableHead>Coûts</TableHead>
            <TableHead>Marge</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {category.products.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                {p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
                    alt={p.name}
                    width={48}
                    height={48}
                    className="size-12 rounded-md object-cover"
                  />
                ) : (
                  <div className="size-12 rounded-md bg-muted" />
                )}
              </TableCell>
              <TableCell className="font-medium">
                <Link
                  href={`/dashboard/menu/${categoryId}/produits/${p.id}`}
                  className="hover:underline"
                >
                  {p.name}
                </Link>
              </TableCell>
              <TableCell>
                {new Intl.NumberFormat('fr-FR').format(p.price)} FCFA
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {p.coutMatiere + p.coutEmballage > 0 ? (
                  <span>
                    {new Intl.NumberFormat('fr-FR').format(
                      p.coutMatiere + p.coutEmballage
                    )}{' '}
                    FCFA
                  </span>
                ) : (
                  <span className="text-xs">—</span>
                )}
              </TableCell>
              <TableCell>
                {p.coutMatiere + p.coutEmballage > 0 && p.price > 0 ? (
                  (() => {
                    const marge = p.price - p.coutMatiere - p.coutEmballage;
                    const pct = Math.round((marge / p.price) * 100);
                    return (
                      <span
                        className={
                          pct >= 50
                            ? 'text-sm font-medium text-green-600'
                            : pct >= 20
                              ? 'text-sm font-medium text-yellow-600'
                              : 'text-sm font-medium text-destructive'
                        }
                      >
                        {new Intl.NumberFormat('fr-FR').format(marge)} F ({pct}
                        %)
                      </span>
                    );
                  })()
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={p.available ? 'default' : 'outline'}>
                    {p.available ? 'Visible' : 'Masqué'}
                  </Badge>
                  {p.featured && (
                    <Badge variant="secondary">
                      ★ {p.featuredBadge ?? 'Favori'}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link
                      href={`/dashboard/menu/${categoryId}/produits/${p.id}`}
                    >
                      Modifier
                    </Link>
                  </Button>
                  <ProductRowActions
                    id={p.id}
                    available={p.available}
                    featured={p.featured}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {category.products.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                Aucun produit dans cette catégorie.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
