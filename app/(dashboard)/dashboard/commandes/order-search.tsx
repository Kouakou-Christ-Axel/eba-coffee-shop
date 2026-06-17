'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useOrdersNav } from './use-orders-nav';

const DEBOUNCE_MS = 350;

export function OrderSearch({ initial }: { initial: string }) {
  const { navigate } = useOrdersNav();
  const [value, setValue] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resynchronise si l'URL change depuis l'extérieur (navigation, reset).
  useEffect(() => {
    setValue(initial);
  }, [initial]);

  function pushSearch(next: string) {
    const trimmed = next.trim();
    navigate((params) => {
      if (trimmed) params.set('search', trimmed);
      else params.delete('search');
    });
  }

  function onChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => pushSearch(next), DEBOUNCE_MS);
  }

  function clear() {
    if (timer.current) clearTimeout(timer.current);
    setValue('');
    pushSearch('');
  }

  return (
    <div className="relative w-full sm:w-[280px]">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="N°, référence, nom ou téléphone…"
        className="pl-8 pr-8 h-9"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={clear}
          aria-label="Effacer la recherche"
          className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
