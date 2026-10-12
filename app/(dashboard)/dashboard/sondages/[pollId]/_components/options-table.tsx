'use client';

import { MediaImage as Image } from '@/components/ui/media-image';
import { ArrowDown, ArrowUp, Loader2, Trash2 } from 'lucide-react';
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
import { ALLOWED_IMAGE_MIME_TYPES } from '@/lib/schemas/upload';
import type { OptionRow } from './types';
import type { PollDetailState } from './use-poll-detail';

export function OptionsTable({
  options,
  totalVotes,
  poll,
}: {
  options: OptionRow[];
  totalVotes: number;
  poll: PollDetailState;
}) {
  const { pendingId, uploading, uploadImage, move, remove } = poll;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Image</TableHead>
            <TableHead>Option</TableHead>
            <TableHead>Votes</TableHead>
            <TableHead>Résultat</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {options.map((o, i) => {
            const pct =
              totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0;
            return (
              <TableRow key={o.id} className={o.deletedAt ? 'opacity-50' : ''}>
                <TableCell>
                  {o.imageUrl ? (
                    <Image
                      src={o.imageUrl}
                      alt={o.label}
                      width={48}
                      height={48}
                      className="size-12 rounded-md object-cover"
                    />
                  ) : (
                    <label className="flex size-12 cursor-pointer items-center justify-center rounded-md border border-dashed text-[10px] text-muted-foreground">
                      {uploading ? '…' : 'Photo'}
                      <input
                        type="file"
                        accept={ALLOWED_IMAGE_MIME_TYPES.join(',')}
                        className="hidden"
                        disabled={uploading || Boolean(o.deletedAt)}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadImage(o.id, f);
                        }}
                      />
                    </label>
                  )}
                </TableCell>
                <TableCell>
                  <p className="text-sm font-medium">{o.label}</p>
                  {o.description && (
                    <p className="text-xs text-muted-foreground">
                      {o.description}
                    </p>
                  )}
                  {o.deletedAt && (
                    <Badge variant="secondary" className="mt-1">
                      Retirée
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{o.votes}</TableCell>
                <TableCell className="w-40">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{pct}%</span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => move(o.id, 'up')}
                      disabled={pendingId === o.id || i === 0}
                      aria-label="Monter"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => move(o.id, 'down')}
                      disabled={pendingId === o.id || i === options.length - 1}
                      aria-label="Descendre"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    {!o.deletedAt && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(o)}
                        disabled={pendingId === o.id}
                        aria-label="Retirer l’option"
                      >
                        {pendingId === o.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
