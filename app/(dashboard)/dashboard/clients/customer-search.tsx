'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const DEBOUNCE_MS = 350;

export function CustomerSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  function push(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    const trimmed = next.trim();
    if (trimmed) params.set('search', trimmed);
    else params.delete('search');
    // `startTransition` évite que la navigation (déclenchée à chaque
    // recherche) ne fasse apparaître le fallback `loading.tsx` de toute la
    // page : React garde le contenu actuel affiché et n'utilise `isPending`
    // que pour un indicateur discret, au lieu d'un flash plein écran à
    // chaque frappe.
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  }

  function onChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push(next), DEBOUNCE_MS);
  }

  function clear() {
    if (timer.current) clearTimeout(timer.current);
    setValue('');
    push('');
  }

  return (
    <div className="relative w-full sm:w-[300px]">
      {isPending ? (
        <Loader2
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      ) : (
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Nom ou téléphone…"
        className="pl-8 pr-8 h-9"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={clear}
          aria-label="Effacer"
          className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
