'use client';

// components/(dashboard)/push-sound-relay.tsx
//
// Fait sonner le carillon "nouvelle commande en cuisine" dès la réception de
// la notification push, quel que soit l'écran du dashboard affiché — pas
// seulement /dashboard/preparation, où le flux SSE (`useOrdersStream`) le
// déclenche déjà à l'arrivée de la commande. L'API Notification web ne
// permet pas de personnaliser le son de la notification système elle-même ;
// le service worker (public/sw.js) relaie donc chaque push reçu via
// `postMessage` aux onglets ouverts, et c'est ce composant qui joue le son.
//
// Ne rend rien : composant purement comportemental, monté globalement dans
// app/(dashboard)/layout.tsx.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { playNewOrderChime, useSoundPreference } from '@/lib/hooks/use-orders-stream';

const SOUND_STORAGE_KEY = 'eba.preparation.sound-enabled';

export function PushSoundRelay() {
  const pathname = usePathname();
  const { soundEnabledRef } = useSoundPreference(SOUND_STORAGE_KEY);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; tag?: string } | undefined;
      if (data?.type !== 'eba-push' || !data.tag) return;
      if (!data.tag.startsWith('order-kitchen-')) return;
      // L'écran préparation carillonne déjà via son propre flux SSE, plus
      // immédiat que le push — éviter le double son.
      if (pathname?.startsWith('/dashboard/preparation')) return;
      if (soundEnabledRef.current) playNewOrderChime();
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [pathname, soundEnabledRef]);

  return null;
}
