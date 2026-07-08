'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Check, Loader2, Plus, Trash2, X } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
  isAllowedImageMimeType,
} from '@/lib/schemas/upload';
import {
  createPollOptionAction,
  updatePollOptionAction,
  movePollOptionAction,
  deletePollOptionAction,
  moderatePollSuggestionAction,
} from '../actions';

const MAX_MB = Math.round(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024));

type OptionRow = {
  id: string;
  label: string;
  description: string | null;
  imageUrl: string | null;
  deletedAt: Date | null;
  votes: number;
};

type SuggestionRow = {
  id: string;
  label: string;
  description: string | null;
  imageUrl: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submitterName: string | null;
  submitterPhone: string | null;
  rejectionReason: string | null;
};

async function uploadPollOptionImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('subdir', 'poll-options');
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `Erreur ${res.status}`);
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}

export function PollDetail({
  pollId,
  options,
  totalVotes,
  suggestions,
  allowSuggestions,
}: {
  pollId: string;
  options: OptionRow[];
  totalVotes: number;
  suggestions: SuggestionRow[];
  allowSuggestions: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  const pendingSuggestions = suggestions.filter((s) => s.status === 'PENDING');
  const decidedSuggestions = suggestions.filter((s) => s.status !== 'PENDING');

  function addOption() {
    setError(null);
    const label = newLabel.trim();
    if (!label) {
      setError('Le libellé est obligatoire.');
      return;
    }
    startTransition(async () => {
      const r = await createPollOptionAction(pollId, {
        label,
        description: newDescription.trim() || undefined,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setNewLabel('');
      setNewDescription('');
      router.refresh();
    });
  }

  function move(id: string, direction: 'up' | 'down') {
    setPendingId(id);
    startTransition(async () => {
      const r = await movePollOptionAction(id, pollId, direction);
      setPendingId(null);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  function remove(option: OptionRow) {
    if (!window.confirm(`Retirer l’option « ${option.label} » ?`)) return;
    setPendingId(option.id);
    startTransition(async () => {
      const r = await deletePollOptionAction(option.id, pollId);
      setPendingId(null);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  async function uploadImage(optionId: string, file: File) {
    setError(null);
    if (!isAllowedImageMimeType(file.type)) {
      setError(
        `Format non supporté (autorisés : ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}).`
      );
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setError(`Fichier trop volumineux (max ${MAX_MB} MB).`);
      return;
    }
    setUploading(true);
    try {
      const url = await uploadPollOptionImage(file);
      const r = await updatePollOptionAction(optionId, pollId, {
        imageUrl: url,
      });
      if (!r.ok) setError(r.error);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur upload');
    } finally {
      setUploading(false);
    }
  }

  function moderate(
    suggestion: SuggestionRow,
    decision: 'approve' | 'reject'
  ) {
    let rejectionReason: string | undefined;
    if (decision === 'reject') {
      const reason = window.prompt('Motif du rejet ?');
      if (!reason || !reason.trim()) return;
      rejectionReason = reason.trim();
    }
    setPendingId(suggestion.id);
    startTransition(async () => {
      const r = await moderatePollSuggestionAction(suggestion.id, pollId, {
        decision,
        rejectionReason,
      });
      setPendingId(null);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-destructive">{error}</p>}

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
                    <span className="text-xs text-muted-foreground">
                      {pct}%
                    </span>
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

      <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
        <div className="flex-1 space-y-1.5">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Nouvelle option (ex. Croissant amande)"
          />
          <Textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optionnel)"
          />
        </div>
        <Button onClick={addOption} disabled={pending}>
          <Plus className="mr-1.5 h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {allowSuggestions && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">
            Suggestions de la communauté
            {pendingSuggestions.length > 0 && (
              <Badge className="ml-2">{pendingSuggestions.length}</Badge>
            )}
          </h3>

          {pendingSuggestions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucune suggestion en attente.
            </p>
          )}

          <div className="space-y-2">
            {pendingSuggestions.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                {s.imageUrl && (
                  <Image
                    src={s.imageUrl}
                    alt={s.label}
                    width={48}
                    height={48}
                    className="size-12 shrink-0 rounded-md object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{s.label}</p>
                  {s.description && (
                    <p className="text-xs text-muted-foreground">
                      {s.description}
                    </p>
                  )}
                  {(s.submitterName || s.submitterPhone) && (
                    <p className="text-xs text-muted-foreground">
                      Proposé par {s.submitterName ?? 'un client'}
                      {s.submitterPhone ? ` (${s.submitterPhone})` : ''}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => moderate(s, 'approve')}
                    disabled={pendingId === s.id}
                    aria-label="Approuver"
                  >
                    <Check className="h-4 w-4 text-primary" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => moderate(s, 'reject')}
                    disabled={pendingId === s.id}
                    aria-label="Rejeter"
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {decidedSuggestions.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                Historique ({decidedSuggestions.length})
              </summary>
              <div className="mt-2 space-y-2">
                {decidedSuggestions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-md border p-2 text-xs"
                  >
                    <span>{s.label}</span>
                    <Badge
                      variant={
                        s.status === 'APPROVED' ? 'default' : 'destructive'
                      }
                    >
                      {s.status === 'APPROVED' ? 'Approuvée' : 'Rejetée'}
                    </Badge>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
