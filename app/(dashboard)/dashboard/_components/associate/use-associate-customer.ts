'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { SetOrderCustomerInput } from '@/lib/schemas/order';
import type { CustomerHit } from './types';

const DEBOUNCE_MS = 350;
export const MIN_QUERY_LENGTH = 2;

export type AssociateCustomerState = ReturnType<typeof useAssociateCustomer>;

export function useAssociateCustomer({
  orderId,
  action,
}: {
  orderId: string;
  action: (
    orderId: string,
    input: SetOrderCustomerInput
  ) => Promise<{ error: string } | undefined>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerHit[]>([]);
  const [searching, setSearching] = useState(false);

  // Saisie manuelle (client non trouvé).
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      abort.current?.abort();
    };
  }, []);

  function resetState() {
    setQuery('');
    setResults([]);
    setManualPhone('');
    setManualName('');
    setError(null);
  }

  function handleClose() {
    if (isPending) return;
    setIsOpen(false);
    resetState();
  }

  function runSearch(term: string) {
    // Une requête plus ancienne mais plus lente écrasait sinon un résultat
    // plus récent (le sélecteur de `caisse/new` annule déjà correctement).
    abort.current?.abort();
    const q = term.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setSearching(true);
    fetch(`/api/customers/search?q=${encodeURIComponent(q)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : { customers: [] }))
      .then((data: { customers?: CustomerHit[] }) => {
        setResults(data.customers ?? []);
        setSearching(false);
      })
      .catch(() => {
        // Requête annulée : une plus récente est en vol, on lui laisse la
        // main (y compris l'extinction de l'indicateur « Recherche… »).
        if (controller.signal.aborted) return;
        setResults([]);
        setSearching(false);
      });
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(next), DEBOUNCE_MS);
  }

  function submit(input: SetOrderCustomerInput) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action(orderId, input);
        if (result?.error) {
          setError(result.error);
          return;
        }
        setIsOpen(false);
        resetState();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur serveur');
      }
    });
  }

  return {
    isOpen,
    setIsOpen,
    query,
    setQuery,
    results,
    setResults,
    searching,
    manualPhone,
    setManualPhone,
    manualName,
    setManualName,
    error,
    isPending,
    handleClose,
    handleQueryChange,
    submit,
  };
}
