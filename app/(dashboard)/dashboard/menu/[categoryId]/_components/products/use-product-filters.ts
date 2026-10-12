'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SEARCH_DEBOUNCE_MS, isAvailability, type Availability } from './types';

export function useProductFilters() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [availability, setAvailability] = useState<Availability>(() => {
    const v = searchParams.get('dispo');
    return isAvailability(v) ? v : 'all';
  });
  const [featuredOnly, setFeaturedOnly] = useState(
    () => searchParams.get('vedette') === '1'
  );
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => setDebouncedQuery(query),
      SEARCH_DEBOUNCE_MS
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());
    else params.delete('q');
    if (availability !== 'all') params.set('dispo', availability);
    else params.delete('dispo');
    if (featuredOnly) params.set('vedette', '1');
    else params.delete('vedette');
    const qs = params.toString();
    window.history.replaceState(
      null,
      '',
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    );
  }, [debouncedQuery, availability, featuredOnly]);

  const hasFilters =
    debouncedQuery.trim() !== '' || availability !== 'all' || featuredOnly;

  function resetFilters() {
    setQuery('');
    setDebouncedQuery('');
    setAvailability('all');
    setFeaturedOnly(false);
  }
  return {
    query,
    setQuery,
    availability,
    setAvailability,
    featuredOnly,
    setFeaturedOnly,
    debouncedQuery,
    hasFilters,
    resetFilters,
  };
}

export type ProductFilters = ReturnType<typeof useProductFilters>;
