import type { Metadata } from 'next';
import { listPublicPolls } from '@/lib/polls';
import { BreadcrumbJsonLd } from '@/components/(public)/breadcrumb-json-ld';
import PollsListSection from '@/components/(public)/sondages/polls-list-section';

// ISR : TTFB quasi instantané pour une liste peu volatile. Les actions admin
// (app/(dashboard)/dashboard/sondages/actions.ts) appellent
// `revalidatePath('/sondages')` sur chaque mutation, donc ce délai n'est
// qu'un filet de sécurité de fraîcheur.
//
// ⚠️ Doit rester une valeur littérale : Next.js exige que `export const
// revalidate` soit statiquement analysable (une référence importée, même
// vers une constante numérique simple, fait échouer le build avec « Invalid
// segment configuration export detected »). Garder cette valeur synchronisée
// à la main avec `POLLS_REVALIDATE_SECONDS` (config/constants.ts).
export const revalidate = 60;

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

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: 'Sondages', path: '/sondages' }]} />
      <PollsListSection open={open} closed={closed} />
    </>
  );
}
