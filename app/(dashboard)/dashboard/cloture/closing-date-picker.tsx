'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { shiftDateString, todayDateString } from '@/lib/timezone';

export function ClosingDatePicker({ date }: { date: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function go(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('date', next);
    router.push(`?${params.toString()}`);
  }

  const isToday = date === todayDateString();

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => go(shiftDateString(date, -1))}
        aria-label="Jour précédent"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="relative">
        <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="date"
          value={date}
          max={todayDateString()}
          onChange={(e) => e.target.value && go(e.target.value)}
          className="pl-8 pr-2 h-9 w-[160px]"
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={isToday}
        onClick={() => go(shiftDateString(date, 1))}
        aria-label="Jour suivant"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      {!isToday && (
        <Button variant="ghost" size="sm" onClick={() => go(todayDateString())}>
          Aujourd&apos;hui
        </Button>
      )}
    </div>
  );
}
