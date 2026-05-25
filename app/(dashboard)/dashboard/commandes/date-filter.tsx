'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Props = {
  /** YYYY-MM-DD ou 'all' */
  selected: string;
  /** Statut courant à préserver lors du changement de date */
  status: string | undefined;
};

function shiftDay(yyyymmdd: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyymmdd);
  if (!m) return yyyymmdd;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + delta);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function todayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function DateFilter({ selected, status }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAll = selected === 'all';

  function navigate(nextDate: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (status) params.set('status', status);
    else params.delete('status');
    params.delete('page');
    if (nextDate === 'all') params.set('date', 'all');
    else params.set('date', nextDate);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={isAll}
        onClick={() => navigate(shiftDay(selected, -1))}
        aria-label="Jour précédent"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="relative">
        <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="date"
          value={isAll ? '' : selected}
          onChange={(e) => {
            const v = e.target.value;
            navigate(v || 'all');
          }}
          className="pl-8 pr-2 h-9 w-[160px]"
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={isAll}
        onClick={() => navigate(shiftDay(selected, +1))}
        aria-label="Jour suivant"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant={isAll ? 'default' : 'ghost'}
        size="sm"
        onClick={() => navigate(isAll ? todayString() : 'all')}
      >
        {isAll ? "Aujourd'hui" : 'Tout'}
      </Button>
    </div>
  );
}
