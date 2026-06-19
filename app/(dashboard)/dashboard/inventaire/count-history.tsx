'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const f = new Intl.NumberFormat('fr-FR');

type Count = {
  id: string;
  date: string;
  label: string | null;
  lineCount: number;
  by: string | null;
};

export function CountHistory({ counts }: { counts: Count[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comptages d’inventaire</CardTitle>
      </CardHeader>
      <CardContent>
        {counts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun comptage enregistré.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Lignes</TableHead>
                <TableHead>Par</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {counts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.date}</TableCell>
                  <TableCell>{c.label || '—'}</TableCell>
                  <TableCell>{f.format(c.lineCount)}</TableCell>
                  <TableCell>{c.by || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
