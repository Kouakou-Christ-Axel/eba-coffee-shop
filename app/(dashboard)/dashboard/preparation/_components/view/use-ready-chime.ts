'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { playNewOrderChime } from '@/lib/hooks/use-orders-stream';

/** Sonne quand le nombre de programmées « prêtes à lancer » augmente. */
export function useReadyToLaunchChime(
  count: number,
  soundEnabledRef: RefObject<boolean>
) {
  const previous = useRef(count);
  useEffect(() => {
    if (count > previous.current && soundEnabledRef.current) {
      playNewOrderChime();
    }
    previous.current = count;
  }, [count, soundEnabledRef]);
}
