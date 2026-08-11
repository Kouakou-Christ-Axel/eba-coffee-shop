import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { listProductSchedules } from '@/lib/menu';
import { ProductForm } from '../product-form';
import { BackButton } from '@/components/(dashboard)/back-button';

// Page d'administration : données live, jamais prérendue.
export const dynamic = 'force-dynamic';

export default async function NewProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<{ onglet?: string }>;
}) {
  const { categoryId } = await params;
  const { onglet } = await searchParams;
  const [category, schedules] = await Promise.all([
    prisma.menuCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, deletedAt: true },
    }),
    listProductSchedules(),
  ]);
  if (!category || category.deletedAt) notFound();

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
      <ProductForm
        categoryId={categoryId}
        schedules={schedules}
        defaultTab={onglet}
      />
    </div>
  );
}
