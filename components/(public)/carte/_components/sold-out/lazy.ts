import dynamic from 'next/dynamic';

export const SupplementModal = dynamic(
  () => import('@/components/(public)/carte/supplement-modal'),
  { ssr: false }
);
export const RestockAlertButton = dynamic(
  () => import('../restock-alert-button'),
  { ssr: false }
);
