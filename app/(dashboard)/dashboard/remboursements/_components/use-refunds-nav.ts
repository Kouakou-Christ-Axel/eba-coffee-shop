'use client';

// Filtres de la liste des remboursements, branchés sur l'URL via nuqs. Une seule
// transition est partagée par tous les contrôles (onglets, canal, dates).

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useTransition,
} from 'react';
import { useQueryStates, type Values } from 'nuqs';
import { refundsParsers } from '../search-params';

export type RefundsFilters = Values<typeof refundsParsers>;
export type RefundsFiltersPatch = {
  [K in keyof RefundsFilters]?: RefundsFilters[K] | null;
};

export type RefundsNav = {
  filters: RefundsFilters;
  /** Applique un patch ; repasse à la page 1. */
  update: (patch: RefundsFiltersPatch) => void;
  isPending: boolean;
};

const RefundsNavContext = createContext<RefundsNav | null>(null);

export function useRefundsNavValue(): RefundsNav {
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useQueryStates(refundsParsers, {
    shallow: false,
    history: 'push',
    scroll: false,
    startTransition,
  });
  const update = useCallback<RefundsNav['update']>(
    (patch) => void setFilters({ ...patch, page: null }),
    [setFilters]
  );
  return useMemo(
    () => ({ filters, update, isPending }),
    [filters, update, isPending]
  );
}

export const RefundsNavProvider = RefundsNavContext.Provider;

export function useRefundsNav(): RefundsNav {
  const ctx = useContext(RefundsNavContext);
  if (!ctx) {
    throw new Error('useRefundsNav doit être utilisé dans <RefundsToolbar>');
  }
  return ctx;
}
