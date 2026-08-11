// Layout de la section menu. Deux rôles :
// 1. monter `UndoToastProvider` une seule fois au-dessus de toutes les routes
//    `/dashboard/menu/**` (catégories, produits, plannings, extras globaux,
//    stock par goût) : les lignes de table démontent au re-rendu serveur qui
//    suit une Server Action, le toast doit survivre à ce démontage ;
// 2. porter la sous-navigation partagée, sinon les sous-sections ne sont
//    atteignables que depuis la page des catégories.

import type { ReactNode } from 'react';
import { UndoToastProvider } from '@/lib/hooks/use-undo-toast';
import { MenuSubNav } from './menu-sub-nav';

export default function MenuLayout({ children }: { children: ReactNode }) {
  return (
    <UndoToastProvider>
      <div className="space-y-6">
        <MenuSubNav />
        {children}
      </div>
    </UndoToastProvider>
  );
}
