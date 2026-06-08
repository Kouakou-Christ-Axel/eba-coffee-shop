import { notFound } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { ProductsTable } from './products-table';
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

      <ProductsTable categoryId={categoryId} products={category.products} />
    </div>
  );
}
