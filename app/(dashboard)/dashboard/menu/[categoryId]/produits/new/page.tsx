import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { ProductForm } from '../product-form';
import { BackButton } from '@/components/(dashboard)/back-button';

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
        <BackButton
          fallbackHref={`/dashboard/menu/${categoryId}`}
          label={category.name}
          className="-ml-3 mb-2"
        />
        <h1 className="text-2xl font-bold">Nouveau produit</h1>
      </div>
      <ProductForm categoryId={categoryId} />
    </div>
  );
}
