import type { Metadata } from 'next';
import { listPublicPolls } from '@/lib/polls';
import PollsListSection from '@/components/(public)/sondages/polls-list-section';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sondages',
  description:
    'Donne ton avis : vote pour la pâtisserie de la semaine et propose tes idées à EBA Coffee Shop.',
  alternates: {
    canonical: '/sondages',
  },
};

export default async function SondagesPage() {
  const [open, closed] = await Promise.all([
    listPublicPolls({ status: 'OPEN' }),
    listPublicPolls({ status: 'CLOSED' }),
  ]);

  return <PollsListSection open={open} closed={closed} />;
}
