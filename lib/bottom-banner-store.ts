// lib/bottom-banner-store.ts
//
// Coordonne les bandeaux flottants "fixed bottom" (install PWA, carte PDF)
// avec le bouton panier flottant de /carte, qui doit toujours rester
// cliquable même quand un bandeau est affiché par-dessus lui.

import { create } from 'zustand';

type BannerId = 'pwa-install' | 'menu-pdf';

type BottomBannerState = {
  visible: Set<BannerId>;
  setVisible: (id: BannerId, isVisible: boolean) => void;
};

export const useBottomBannerStore = create<BottomBannerState>((set) => ({
  visible: new Set(),
  setVisible: (id, isVisible) =>
    set((state) => {
      const next = new Set(state.visible);
      if (isVisible) next.add(id);
      else next.delete(id);
      return { visible: next };
    }),
}));

/** Vrai si au moins un bandeau flottant "fixed bottom" est actuellement affiché. */
export function useHasBottomBanner(): boolean {
  return useBottomBannerStore((s) => s.visible.size > 0);
}
