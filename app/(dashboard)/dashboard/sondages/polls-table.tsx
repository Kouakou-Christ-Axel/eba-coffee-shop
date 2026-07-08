'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  PollFormFields,
  emptyPollScalarValues,
  type PollScalarValues,
} from './poll-form-fields';
import { EditPollSheet } from './edit-poll-sheet';
import { createPollAction, setPollStatusAction, deletePollAction } from './actions';

type PollRow = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  allowSuggestions: boolean;
  resultsVisibility: 'LIVE' | 'AFTER_CLOSE';
  optionsCount: number;
  votesCount: number;
  pendingSuggestionsCount: number;
};

const STATUS_LABELS: Record<PollRow['status'], string> = {
  DRAFT: 'Préparation',
  OPEN: 'Ouvert',
  CLOSED: 'Clôturé',
};

type CreateValues = PollScalarValues & { options: string[] };

const emptyCreate: CreateValues = {
  ...emptyPollScalarValues,
  options: ['', ''],
};

export function PollsTable({ polls }: { polls: PollRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [values, setValues] = useState<CreateValues>(emptyCreate);

  function openCreate() {
    setError(null);
    setValues(emptyCreate);
    setCreateOpen(true);
  }

  function submitCreate() {
    setError(null);
    const title = values.title.trim();
    if (!title) {
      setError('Le titre est obligatoire.');
      return;
    }
    const options = values.options.map((o) => o.trim()).filter(Boolean);
    if (options.length < 2) {
      setError('Au moins 2 options sont requises.');
      return;
    }
    const input = {
      title,
      description: values.description.trim() || undefined,
      imageUrl: values.imageUrl,
      allowSuggestions: values.allowSuggestions,
      resultsVisibility: values.resultsVisibility,
      options: options.map((label) => ({ label })),
    };
    startTransition(async () => {
      const r = await createPollAction(input);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCreateOpen(false);
      router.refresh();
    });
  }

  function changeStatus(id: string, status: PollRow['status']) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const r = await setPollStatusAction(id, { status });
      setPendingId(null);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  function remove(poll: PollRow) {
    if (
      !window.confirm(
        `Supprimer le sondage « ${poll.title} » ? Action irréversible.`
      )
    ) {
      return;
    }
    setError(null);
    setPendingId(poll.id);
    startTransition(async () => {
      const r = await deletePollAction(poll.id);
      setPendingId(null);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nouveau sondage
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

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
                    <SelectItem key="CLOSED">
                      {STATUS_LABELS.CLOSED}
                    </SelectItem>
                  </Select>
                </TableCell>
                <TableCell className="tabular-nums">
                  {p.optionsCount}
                </TableCell>
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

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Nouveau sondage</SheetTitle>
            <SheetDescription>
              Crée un sondage avec ses options de vote (au moins 2). Il est
              créé en préparation — ouvre-le ensuite pour lancer le vote.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-4">
            <PollFormFields
              values={values}
              onChange={(v) => setValues({ ...v, options: values.options })}
            />

            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">Options</p>
              {values.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const options = [...values.options];
                      options[i] = e.target.value;
                      setValues({ ...values, options });
                    }}
                    placeholder={`Option ${i + 1}`}
                  />
                  {values.options.length > 2 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setValues({
                          ...values,
                          options: values.options.filter((_, j) => j !== i),
                        })
                      }
                      aria-label="Retirer l’option"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setValues({ ...values, options: [...values.options, ''] })
                }
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Ajouter une option
              </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="mt-2" onClick={submitCreate} disabled={pending}>
              {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Créer
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
