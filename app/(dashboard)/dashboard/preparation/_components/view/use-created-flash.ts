'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export function useCreatedFlash() {
  // `/dashboard/preparation/new` redirige ici avec `?cree=<n° du jour>` (comme la caisse) : retour visible après création.
  const searchParams = useSearchParams();
  const createdParam = searchParams.get('cree');
  const [createdFlash, setCreatedFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!createdParam) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCreatedFlash(createdParam);
    window.history.replaceState(null, '', '/dashboard/preparation');
    const timer = setTimeout(() => setCreatedFlash(null), 8_000);
    return () => clearTimeout(timer);
  }, [createdParam]);
  return { createdFlash, setCreatedFlash };
}
