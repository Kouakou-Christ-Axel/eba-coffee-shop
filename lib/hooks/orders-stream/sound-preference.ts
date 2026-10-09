'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { playNewOrderChime } from './chimes';

/** Hook utilitaire qui mémorise la préférence "son activé" dans localStorage et expose une ref synchronisée pour les callbacks SSE. */
export function useSoundPreference(storageKey: string): {
  soundEnabled: boolean;
  soundEnabledRef: React.MutableRefObject<boolean>;
  toggleSound: () => void;
} {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'false') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration depuis localStorage
      setSoundEnabled(false);
      soundEnabledRef.current = false;
    }
  }, [storageKey]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      soundEnabledRef.current = next;
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {
        // Quota / mode privé : on ignore.
      }
      if (next) playNewOrderChime();
      return next;
    });
  }, [storageKey]);

  return { soundEnabled, soundEnabledRef, toggleSound };
}
