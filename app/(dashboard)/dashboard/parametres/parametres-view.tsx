'use client';

import { useState, useTransition } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type {
  PickupSettings,
  TimeRange,
  DateOverride,
} from '@/lib/pickup-settings';
import { savePickupSettings } from './actions';
import { PickupLocationForm } from './_components/pickup-location-form';
import { GeneralSettingsForm } from './_components/general-settings-form';
import { WeeklyHoursForm } from './_components/weekly-hours-form';
import { DateOverridesForm } from './_components/date-overrides-form';

export function ParametresView({
  initialSettings,
}: {
  initialSettings: PickupSettings;
}) {
  const [settings, setSettings] = useState<PickupSettings>(initialSettings);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    kind: 'success' | 'error';
    msg: string;
  } | null>(null);

  function update<K extends keyof PickupSettings>(
    key: K,
    value: PickupSettings[K]
  ) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  function updateWeeklyHours(weekday: string, ranges: TimeRange[]) {
    setSettings((s) => ({
      ...s,
      weeklyHours: { ...s.weeklyHours, [weekday]: ranges },
    }));
  }

  function updateOverrides(overrides: DateOverride[]) {
    setSettings((s) => ({ ...s, dateOverrides: overrides }));
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

      <PickupLocationForm settings={settings} onUpdate={update} />
      <GeneralSettingsForm settings={settings} onUpdate={update} />
      <WeeklyHoursForm
        weeklyHours={settings.weeklyHours}
        onChange={updateWeeklyHours}
      />
      <DateOverridesForm
        overrides={settings.dateOverrides}
        onChange={updateOverrides}
      />

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
