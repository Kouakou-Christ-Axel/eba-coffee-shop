'use client';

// components/layouts/dashboard-fab-mount.tsx
//
// Point de montage du raccourci dashboard flottant. Il ne rend rien tant que
// `useStaffAccess` n'a pas confirmé une session staff — et surtout, il
// n'IMPORTE le bouton qu'à ce moment-là : `next/dynamic` sort `DashboardFab`
// (et son icône Tabler) du chunk du layout public, que tout visiteur du site
// vitrine télécharge sur chaque page.

import dynamic from 'next/dynamic';
import { useStaffAccess } from '@/lib/hooks/use-staff-access';

const DashboardFab = dynamic(() => import('./dashboard-fab'), { ssr: false });

export default function DashboardFabMount() {
  const hasDashboardAccess = useStaffAccess();

  if (!hasDashboardAccess) return null;

  return <DashboardFab />;
}
