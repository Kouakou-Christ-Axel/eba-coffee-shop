'use client';

// lib/hooks/use-resettable-state.ts
//
// State qui se réinitialise quand une clé change, sans `useEffect` (pattern
// React "Adjusting state when a prop changes" — cf.
// https://react.dev/learn/you-might-not-need-an-effect). Extrait de
// `SupplementPicker`/`SupplementModal` où le même besoin se répète : reset des
// sélections quand le produit affiché (ou la ligne éditée) change.

import { useState } from 'react';

export function useResettableState<T>(
  key: string,
  init: () => T
): [T, (updater: (prev: T) => T) => void] {
  const [prevKey, setPrevKey] = useState(key);
  const [value, setValue] = useState<T>(init);

  if (key !== prevKey) {
    setPrevKey(key);
    setValue(init());
    return [init(), setValue];
  }

  return [value, setValue];
}
