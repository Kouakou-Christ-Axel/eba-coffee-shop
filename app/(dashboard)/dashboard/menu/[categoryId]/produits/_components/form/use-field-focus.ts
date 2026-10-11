'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  FIELD_IDS,
  FIELD_TAB,
  type ValidatedField,
} from '@/lib/menu/product-form-completeness';

// Radix ne monte pas un onglet masqué : le focus est demandé par ref puis posé par l'effet, après le rendu.
export function useFieldFocus(changeTab: (value: string) => void) {
  const reduceMotion = useReducedMotion();
  const focusRequest = useRef<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);

  function goToField(field: ValidatedField) {
    changeTab(FIELD_TAB[field]);
    focusRequest.current = FIELD_IDS[field];
    setFocusNonce((n) => n + 1);
  }

  useEffect(() => {
    const id = focusRequest.current;
    if (!id) return;
    focusRequest.current = null;
    const el = document.getElementById(id);
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({
      block: 'center',
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [focusNonce, reduceMotion]);

  return goToField;
}
