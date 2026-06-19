'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Undo2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cancelImportBatchAction } from './actions';

type ImportBatch = {
  id: string;
  date: string;
  mode: string;
  createdCount: number;
  updatedCount: number;
  canceled: boolean;
  by: string | null;
};

export function ImportHistory({ imports }: { imports: ImportBatch[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function cancel(id: string) {
    if (
      !window.confirm(
        'Annuler cet import ? Les références créées seront archivées et les références mises à jour restaurées.'
      )
    ) {
      return;
    }
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const r = await cancelImportBatchAction(id);
      setPendingId(null);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Imports de catalogue</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
        {imports.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun import.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Créées</TableHead>
                <TableHead>Mises à jour</TableHead>
                <TableHead>Par</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {imports.map((b) => (
                <TableRow key={b.id} className={b.canceled ? 'opacity-50' : ''}>
                  <TableCell>{b.date}</TableCell>
                  <TableCell className="tabular-nums">{b.createdCount}</TableCell>
                  <TableCell className="tabular-nums">{b.updatedCount}</TableCell>
                  <TableCell>{b.by || '—'}</TableCell>
                  <TableCell className="text-right">
                    {b.canceled ? (
                      <Badge variant="secondary">Annulé</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cancel(b.id)}
                        disabled={pending && pendingId === b.id}
                      >
                        {pending && pendingId === b.id ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <Undo2 className="mr-1.5 h-4 w-4" />
                        )}
                        Annuler
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
