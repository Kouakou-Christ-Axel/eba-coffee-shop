'use client';

import { MediaImage as Image } from '@/components/ui/media-image';
import Link from 'next/link';
import { Loader2, Trash2 } from 'lucide-react';
import { Select, SelectItem } from '@heroui/react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EditPollSheet } from '../../edit-poll-sheet';
import { STATUS_LABELS, type PollRow } from './types';
import type { PollsTableState } from './use-polls-table';

export function PollsRows({
  polls,
  table,
}: {
  polls: PollRow[];
  table: PollsTableState;
}) {
  const { pendingId, changeStatus, remove } = table;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Image</TableHead>
            <TableHead>Titre</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Options</TableHead>
            <TableHead>Votes</TableHead>
            <TableHead>Suggestions</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {polls.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                {p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
                    alt={p.title}
                    width={40}
                    height={40}
                    className="size-10 rounded-md object-cover"
                  />
                ) : (
                  <div className="size-10 rounded-md border border-dashed" />
                )}
              </TableCell>
              <TableCell className="text-sm font-medium">
                <Link
                  href={`/dashboard/sondages/${p.id}`}
                  className="hover:underline"
                >
                  {p.title}
                </Link>
              </TableCell>
              <TableCell>
                <Select
                  aria-label="Statut du sondage"
                  size="sm"
                  className="w-36"
                  isDisabled={pendingId === p.id}
                  selectedKeys={[p.status]}
                  disallowEmptySelection
                  onSelectionChange={(keys) => {
                    const next = String(
                      Array.from(keys)[0] ?? p.status
                    ) as PollRow['status'];
                    if (next !== p.status) changeStatus(p.id, next);
                  }}
                >
                  <SelectItem key="DRAFT">{STATUS_LABELS.DRAFT}</SelectItem>
                  <SelectItem key="OPEN">{STATUS_LABELS.OPEN}</SelectItem>
                  <SelectItem key="CLOSED">{STATUS_LABELS.CLOSED}</SelectItem>
                </Select>
              </TableCell>
              <TableCell className="tabular-nums">{p.optionsCount}</TableCell>
              <TableCell className="tabular-nums">{p.votesCount}</TableCell>
              <TableCell>
                {p.pendingSuggestionsCount > 0 ? (
                  <Badge>{p.pendingSuggestionsCount} en attente</Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end">
                  <EditPollSheet poll={p} />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(p)}
                    disabled={pendingId === p.id}
                    aria-label="Supprimer le sondage"
                  >
                    {pendingId === p.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {polls.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                Aucun sondage pour l’instant.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
