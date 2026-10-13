'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreatePollSheet } from './_components/polls-table/create-poll-sheet';
import { PollsRows } from './_components/polls-table/polls-rows';
import type { PollRow } from './_components/polls-table/types';
import { usePollsTable } from './_components/polls-table/use-polls-table';

export function PollsTable({ polls }: { polls: PollRow[] }) {
  const table = usePollsTable();

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={table.openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nouveau sondage
        </Button>
      </div>

      {table.error && <p className="text-sm text-destructive">{table.error}</p>}

      <PollsRows polls={polls} table={table} />

      <CreatePollSheet table={table} />
    </div>
  );
}
