import { notFound } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { ProductForm } from '../product-form';

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  const category = await prisma.menuCategory.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true },
  });
  if (!category) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
          <Link href={`/dashboard/menu/${categoryId}`}>← {category.name}</Link>
        </Button>
        <h1 className="text-2xl font-bold">Nouveau produit</h1>
      </div>
      <ProductForm categoryId={categoryId} />
    </div>
  );
}
