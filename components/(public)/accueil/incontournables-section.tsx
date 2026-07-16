import prisma from '@/lib/prisma';
import type { ContactSettings } from '@/lib/contact-settings';
import IncontournablesSectionClient, {
  type FeaturedProduct,
} from './incontournables-section-client';

async function getFeaturedProducts(): Promise<FeaturedProduct[]> {
  return prisma.product.findMany({
    where: {
      featured: true,
      available: true,
      deletedAt: null,
      category: { deletedAt: null },
    },
    orderBy: [{ featuredOrder: 'asc' }, { name: 'asc' }],
    take: 6,
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      imageUrl: true,
      featuredBadge: true,
    },
  });
}

async function IncontournablesSection({
  contact,
}: {
  contact: ContactSettings;
}) {
  const items = await getFeaturedProducts();

  if (items.length === 0) return null;

  return (
    <IncontournablesSectionClient items={items} whatsapp={contact.whatsapp} />
  );
}

export default IncontournablesSection;
