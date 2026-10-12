'use client';

import {
  Archive,
  History,
  Loader2,
  Merge,
  Pencil,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableCell } from '@/components/ui/table';

export function ArticleRowActions({
  name,
  hasMeta,
  pending,
  onHistory,
  onRename,
  onSettings,
  onMerge,
  onArchive,
}: {
  name: string;
  hasMeta: boolean;
  pending: boolean;
  onHistory: () => void;
  onRename: () => void;
  onSettings: () => void;
  onMerge: () => void;
  onArchive: () => void;
}) {
  return (
    <TableCell className="text-right">
      <div className="flex items-center justify-end">
        <Button
          size="icon"
          variant="ghost"
          onClick={onHistory}
          aria-label={`Historique de « ${name} »`}
        >
          <History className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onRename}
          aria-label="Renommer l'article"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onSettings}
          disabled={!hasMeta}
          aria-label="Réglages de l'article"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onMerge}
          disabled={!hasMeta}
          aria-label="Fusionner avec un autre article"
        >
          <Merge className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onArchive}
          disabled={pending}
          aria-label="Retirer l'article du référentiel"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Archive className="h-4 w-4 text-destructive" />
          )}
        </Button>
      </div>
    </TableCell>
  );
}
