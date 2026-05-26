'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { DateOverride } from '@/lib/pickup-settings';

type Props = {
  overrides: DateOverride[];
  onChange: (overrides: DateOverride[]) => void;
};

export function DateOverridesForm({ overrides, onChange }: Props) {
  function addOverride() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    onChange([
      ...overrides,
      { date: `${y}-${m}-${d}`, closed: true, ranges: [] },
    ]);
  }

  function updateOverride(idx: number, patch: Partial<DateOverride>) {
    onChange(overrides.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  }

  function removeOverride(idx: number) {
    onChange(overrides.filter((_, i) => i !== idx));
  }

  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Dates exceptionnelles</h2>
          <p className="text-xs text-muted-foreground">
            Jours fériés, fermetures ou horaires spéciaux pour une date donnée.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addOverride}>
          <Plus className="size-3" />
          Ajouter
        </Button>
      </div>
      {overrides.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">
          Aucune exception définie.
        </p>
      ) : (
        <div className="space-y-3">
          {overrides.map((ov, idx) => (
            <div
              key={idx}
              className="space-y-2 rounded-md border bg-background p-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  type="date"
                  value={ov.date}
                  onChange={(e) =>
                    updateOverride(idx, { date: e.target.value })
                  }
                  className="w-44"
                />
                <div className="flex items-center gap-2">
                  <Switch
                    id={`closed-${idx}`}
                    checked={ov.closed}
                    onCheckedChange={(c) =>
                      updateOverride(idx, {
                        closed: c,
                        ranges: c ? [] : ov.ranges,
                      })
                    }
                  />
                  <Label htmlFor={`closed-${idx}`}>Fermé</Label>
                </div>
                <Input
                  type="text"
                  placeholder="Note (optionnel)"
                  value={ov.note ?? ''}
                  onChange={(e) =>
                    updateOverride(idx, { note: e.target.value })
                  }
                  className="max-w-xs flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeOverride(idx)}
                  aria-label="Supprimer cette exception"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {!ov.closed && (
                <OverrideRangesEditor
                  ranges={ov.ranges}
                  onChange={(ranges) => updateOverride(idx, { ranges })}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function OverrideRangesEditor({
  ranges,
  onChange,
}: {
  ranges: DateOverride['ranges'];
  onChange: (ranges: DateOverride['ranges']) => void;
}) {
  return (
    <div className="ml-2 space-y-2 border-l-2 pl-3">
      {ranges.length === 0 && (
        <p className="text-xs italic text-muted-foreground">
          Aucune plage — la journée sera fermée.
        </p>
      )}
      {ranges.map((range, ri) => (
        <div key={ri} className="flex items-center gap-2">
          <Input
            type="time"
            value={range.start}
            onChange={(e) =>
              onChange(
                ranges.map((r, i) =>
                  i === ri ? { ...r, start: e.target.value } : r
                )
              )
            }
            className="w-28"
          />
          <span className="text-muted-foreground">→</span>
          <Input
            type="time"
            value={range.end}
            onChange={(e) =>
              onChange(
                ranges.map((r, i) =>
                  i === ri ? { ...r, end: e.target.value } : r
                )
              )
            }
            className="w-28"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onChange(ranges.filter((_, i) => i !== ri))}
            aria-label="Retirer cette plage"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...ranges, { start: '08:00', end: '20:00' }])}
      >
        <Plus className="size-3" />
        Ajouter une plage
      </Button>
    </div>
  );
}
