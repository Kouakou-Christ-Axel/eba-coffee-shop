// lib/consent-store.ts
//
// État partagé du consentement cookies. Deux besoins distincts :
//
//  1. `status` — le choix courant, pour que la page /cookies puisse le montrer
//     et le réinitialiser, et pour que la bannière réapparaisse alors.
//  2. `isPrompting` — vrai UNIQUEMENT quand la bannière occupe réellement le bas
//     de l'écran. Les autres bandeaux flottants (installation PWA, carte PDF)
//     s'effacent tant qu'elle est là : deux bandeaux superposés seraient
//     illisibles. Un booléen dédié plutôt qu'un test `status === 'pending'`,
//     parce que sans NEXT_PUBLIC_GTM_ID la bannière n'est jamais montée — le
//     statut resterait « pending » à vie et masquerait l'invite d'installation.

import { create } from 'zustand';
import type { ConsentStatus } from '@/lib/consent-storage';

type ConsentState = {
  status: ConsentStatus;
  isPrompting: boolean;
  setStatus: (status: ConsentStatus) => void;
  setPrompting: (isPrompting: boolean) => void;
};

export const useConsentStore = create<ConsentState>((set) => ({
  status: 'pending',
  isPrompting: false,
  setStatus: (status) => set({ status }),
  setPrompting: (isPrompting) => set({ isPrompting }),
}));

/** Vrai si la bannière de consentement est affichée en bas de l'écran. */
export function useIsConsentPrompting(): boolean {
  return useConsentStore((s) => s.isPrompting);
}
