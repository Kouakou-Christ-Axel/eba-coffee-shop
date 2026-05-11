'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  WEEKDAY_LABELS,
  type PickupSettings,
  type TimeRange,
  type DateOverride,
} from '@/lib/pickup-settings';
import { savePickupSettings } from './actions';

const WEEKDAY_ORDER = ['1', '2', '3', '4', '5', '6', '0'] as const;

export function ParametresView({
  initialSettings,
}: {
  initialSettings: PickupSettings;
}) {
  const [settings, setSettings] = useState<PickupSettings>(initialSettings);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { kind: 'success' | 'error'; msg: string } | null
  >(null);

  function update<K extends keyof PickupSettings>(
    key: K,
    value: PickupSettings[K]
  ) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  function updateDayRanges(weekday: string, ranges: TimeRange[]) {
    setSettings((s) => ({
      ...s,
      weeklyHours: { ...s.weeklyHours, [weekday]: ranges },
    }));
  }

  function addRange(weekday: string) {
    const current = settings.weeklyHours[weekday] ?? [];
    updateDayRanges(weekday, [...current, { start: '08:00', end: '20:00' }]);
  }

  function removeRange(weekday: string, idx: number) {
    const current = settings.weeklyHours[weekday] ?? [];
    updateDayRanges(
      weekday,
      current.filter((_, i) => i !== idx)
    );
  }

  function updateRange(
    weekday: string,
    idx: number,
    field: 'start' | 'end',
    value: string
  ) {
    const current = settings.weeklyHours[weekday] ?? [];
    updateDayRanges(
      weekday,
      current.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );
  }

  function addOverride() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    setSettings((s) => ({
      ...s,
      dateOverrides: [
        ...s.dateOverrides,
        { date: `${y}-${m}-${d}`, closed: true, ranges: [] },
      ],
    }));
  }

  function updateOverride(idx: number, patch: Partial<DateOverride>) {
    setSettings((s) => ({
      ...s,
      dateOverrides: s.dateOverrides.map((o, i) =>
        i === idx ? { ...o, ...patch } : o
      ),
    }));
  }

  function removeOverride(idx: number) {
    setSettings((s) => ({
      ...s,
      dateOverrides: s.dateOverrides.filter((_, i) => i !== idx),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const result = await savePickupSettings(settings);
      if (result.ok) {
        setFeedback({ kind: 'success', msg: 'Paramètres enregistrés.' });
      } else {
        setFeedback({ kind: 'error', msg: result.error });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Configurez les créneaux de retrait click &amp; collect.
        </p>
      </header>

      <section className="space-y-4 rounded-lg border bg-card p-5">
        <div>
          <h2 className="font-semibold">Lieu de retrait</h2>
          <p className="text-xs text-muted-foreground">
            Affiché au client sur la page de confirmation de commande.
          </p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pickupAddress">Adresse</Label>
            <Input
              id="pickupAddress"
              type="text"
              maxLength={200}
              placeholder="Boulevard Latrille, Cocody, Abidjan"
              value={settings.pickupAddress ?? ''}
              onChange={(e) =>
                update(
                  'pickupAddress',
                  e.target.value === '' ? null : e.target.value
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pickupMapsUrl">Lien Google Maps</Label>
            <Input
              id="pickupMapsUrl"
              type="url"
              maxLength={500}
              placeholder="https://www.google.com/maps/embed?pb=... ou https://maps.google.com/?q=..."
              value={settings.pickupMapsUrl ?? ''}
              onChange={(e) =>
                update(
                  'pickupMapsUrl',
                  e.target.value === '' ? null : e.target.value
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              Une URL d&apos;intégration <code>/maps/embed</code> sera affichée
              comme une carte intégrée. Toute autre URL apparaîtra comme un
              lien.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-5">
        <div>
          <h2 className="font-semibold">Réglages généraux</h2>
          <p className="text-xs text-muted-foreground">
            S&apos;applique à tous les créneaux générés.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="slotInterval">Intervalle de créneaux (min)</Label>
            <Input
              id="slotInterval"
              type="number"
              min={5}
              max={60}
              value={settings.slotIntervalMin}
              onChange={(e) =>
                update('slotIntervalMin', Number(e.target.value))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="leadTime">Délai minimum avant retrait (min)</Label>
            <Input
              id="leadTime"
              type="number"
              min={0}
              max={1440}
              value={settings.leadTimeMin}
              onChange={(e) => update('leadTimeMin', Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="visibleDays">Jours visibles côté client</Label>
            <Input
              id="visibleDays"
              type="number"
              min={1}
              max={14}
              value={settings.visibleDays}
              onChange={(e) => update('visibleDays', Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="capacity">
              Capacité max par créneau (vide = illimité)
            </Label>
            <Input
              id="capacity"
              type="number"
              min={1}
              value={settings.capacityPerSlot ?? ''}
              onChange={(e) =>
                update(
                  'capacityPerSlot',
                  e.target.value === '' ? null : Number(e.target.value)
                )
              }
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-5">
        <div>
          <h2 className="font-semibold">Horaires hebdomadaires</h2>
          <p className="text-xs text-muted-foreground">
            Plusieurs plages possibles par jour. Aucune plage = jour fermé.
          </p>
        </div>
        <div className="space-y-3">
          {WEEKDAY_ORDER.map((weekday) => {
            const ranges = settings.weeklyHours[weekday] ?? [];
            return (
              <div
                key={weekday}
                className="flex flex-col gap-2 rounded-md border bg-background p-3 md:flex-row md:items-start"
              >
                <div className="w-full font-medium md:w-24 md:pt-1.5">
                  {WEEKDAY_LABELS[weekday]}
                </div>
                <div className="flex-1 space-y-2">
                  {ranges.length === 0 && (
                    <p className="text-xs italic text-muted-foreground">
                      Fermé
                    </p>
                  )}
                  {ranges.map((range, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={range.start}
                        onChange={(e) =>
                          updateRange(weekday, idx, 'start', e.target.value)
                        }
                        className="w-28"
                      />
                      <span className="text-muted-foreground">→</span>
                      <Input
                        type="time"
                        value={range.end}
                        onChange={(e) =>
                          updateRange(weekday, idx, 'end', e.target.value)
                        }
                        className="w-28"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeRange(weekday, idx)}
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
                    onClick={() => addRange(weekday)}
                  >
                    <Plus className="size-3" />
                    Ajouter une plage
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold">Dates exceptionnelles</h2>
            <p className="text-xs text-muted-foreground">
              Jours fériés, fermetures ou horaires spéciaux pour une date
              donnée.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addOverride}
          >
            <Plus className="size-3" />
            Ajouter
          </Button>
        </div>
        {settings.dateOverrides.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">
            Aucune exception définie.
          </p>
        ) : (
          <div className="space-y-3">
            {settings.dateOverrides.map((ov, idx) => (
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
                  <div className="ml-2 space-y-2 border-l-2 pl-3">
                    {ov.ranges.length === 0 && (
                      <p className="text-xs italic text-muted-foreground">
                        Aucune plage — la journée sera fermée.
                      </p>
                    )}
                    {ov.ranges.map((range, ri) => (
                      <div key={ri} className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={range.start}
                          onChange={(e) =>
                            updateOverride(idx, {
                              ranges: ov.ranges.map((r, i) =>
                                i === ri ? { ...r, start: e.target.value } : r
                              ),
                            })
                          }
                          className="w-28"
                        />
                        <span className="text-muted-foreground">→</span>
                        <Input
                          type="time"
                          value={range.end}
                          onChange={(e) =>
                            updateOverride(idx, {
                              ranges: ov.ranges.map((r, i) =>
                                i === ri ? { ...r, end: e.target.value } : r
                              ),
                            })
                          }
                          className="w-28"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            updateOverride(idx, {
                              ranges: ov.ranges.filter((_, i) => i !== ri),
                            })
                          }
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
                      onClick={() =>
                        updateOverride(idx, {
                          ranges: [
                            ...ov.ranges,
                            { start: '08:00', end: '20:00' },
                          ],
                        })
                      }
                    >
                      <Plus className="size-3" />
                      Ajouter une plage
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <Separator />

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          {feedback?.kind === 'success' && (
            <span className="text-green-600">{feedback.msg}</span>
          )}
          {feedback?.kind === 'error' && (
            <span className="text-red-600">{feedback.msg}</span>
          )}
        </div>
        <Button type="submit" disabled={isPending}>
          <Save className="size-4" />
          {isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );
}
