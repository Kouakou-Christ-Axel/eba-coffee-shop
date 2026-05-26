import { notFound } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { ProductForm, type ProductFormInitial } from '../product-form';

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ categoryId: string; productId: string }>;
}) {
  const { categoryId, productId } = await params;

  const [category, product] = await Promise.all([
    prisma.menuCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true },
    }),
    prisma.product.findUnique({
      where: { id: productId },
      include: {
        supplementGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { options: true },
        },
      },
    }),
  ]);

  if (!category || !product || product.categoryId !== categoryId) {
    notFound();
  }

  const initial: ProductFormInitial = {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    imageUrl: product.imageUrl,
    featured: product.featured,
    featuredOrder: product.featuredOrder,
    featuredBadge: product.featuredBadge,
    supplementGroups: product.supplementGroups.map((g) => ({
      name: g.name,
      type: g.type as 'single' | 'multiple',
      required: g.required,
      options: g.options.map((o) => ({ name: o.name, price: o.price })),
    })),
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
          <Link href={`/dashboard/menu/${categoryId}`}>← {category.name}</Link>
        </Button>
        <h1 className="text-2xl font-bold">Modifier {product.name}</h1>
      </div>
      <ProductForm categoryId={categoryId} initial={initial} />
    </div>
  );
}
