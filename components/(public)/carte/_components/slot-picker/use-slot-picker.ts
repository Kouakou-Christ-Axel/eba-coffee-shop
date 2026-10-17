import { useEffect, useMemo, useState } from 'react';
import { formatAbidjanTime, todayDateString } from '@/lib/timezone';
import type { PickupDay } from '@/lib/hooks/use-pickup-info';
import { minAllowedPickupDateString } from '@/lib/supplements';
import { pickDefaultSlot } from '@/lib/pickup-slots';
import { DEFERRED_PICKUP_DEFAULT_TIME } from '@/config/constants';
import { precommandeDay } from '@/lib/cart-precommande';
import { sameDayOnlyItems } from '@/lib/cart-preorder';
import { dayLabel, isCartAvailableOn, isOpenNow, slotDayKey } from './helpers';
import type { SlotPickerProps } from './types';

export function useSlotPicker({
  timing,
  onTimingChange,
  value,
  onChange,
  info,
  items,
  minAdvanceOrderDays = 0,
  precommandePure = false,
}: SlotPickerProps) {
  const today = todayDateString();
  const [activeDay, setActiveDay] = useState<string | null>(null);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Date[]>();
    if (info.status !== 'ready') return map;
    for (const s of info.slots) {
      const k = slotDayKey(s);
      const arr = map.get(k) ?? [];
      arr.push(s);
      map.set(k, arr);
    }
    return map;
  }, [info]);

  const minAllowedDate =
    minAdvanceOrderDays > 0
      ? minAllowedPickupDateString(minAdvanceOrderDays)
      : null;
  const allDays: PickupDay[] = useMemo(
    () => (info.status === 'ready' ? info.days : []),
    [info]
  );
  // Mémoïsés : `days` est une dépendance du useMemo de `defaultSlot` (React Compiler).
  const scheduleFilteredDays = useMemo(
    () =>
      allDays.filter((d) =>
        isCartAvailableOn(items, new Date(`${d.date}T00:00:00Z`))
      ),
    [allDays, items]
  );
  // Un article qui refuse la précommande ferme tous les autres jours.
  const sameDayOnly = useMemo(
    () => sameDayOnlyItems(items).length > 0,
    [items]
  );
  const days = useMemo(() => {
    if (sameDayOnly)
      return scheduleFilteredDays.filter((d) => d.date === today);
    // Précommande pure : un seul jour possible, TOUJOURS demain.
    if (precommandePure) {
      const day = precommandeDay();
      return scheduleFilteredDays.filter((d) => d.date === day);
    }
    return minAllowedDate
      ? scheduleFilteredDays.filter((d) => d.date >= minAllowedDate)
      : scheduleFilteredDays;
  }, [
    scheduleFilteredDays,
    minAllowedDate,
    precommandePure,
    sameDayOnly,
    today,
  ]);
  const scheduleRestricted = scheduleFilteredDays.length < allDays.length;
  const todayRanges = allDays.find((d) => d.date === today)?.ranges ?? [];
  const cartAvailableNow = isCartAvailableOn(items);
  const openNow = isOpenNow(todayRanges) && !minAllowedDate && cartAvailableNow;
  const selectedDay = activeDay ?? days[0]?.date ?? null;

  // Fermé ou délai de commande actif : « Dès que possible » n'a pas de sens.
  useEffect(() => {
    if (info.status === 'ready' && !openNow && timing === 'asap') {
      onTimingChange('scheduled');
    }
  }, [info.status, openNow, timing, onTimingChange]);

  // Partagé entre l'effet de pré-sélection et le bouton de raccourci : les
  // deux doivent s'accorder sur le MÊME créneau.
  const firstDay = days[0]?.date ?? null;
  const defaultSlot: Date | null = useMemo(() => {
    if (info.status !== 'ready' || !minAllowedDate || !firstDay) return null;
    const candidates = days.flatMap((d) => slotsByDay.get(d.date) ?? []);
    return pickDefaultSlot(candidates, firstDay, DEFERRED_PICKUP_DEFAULT_TIME);
    // `days`/`slotsByDay` sont dérivés de `info` : le suivre suffit.
  }, [info, minAllowedDate, firstDay, days, slotsByDay]);

  useEffect(() => {
    if (!value && defaultSlot) onChange(defaultSlot.toISOString());
  }, [value, defaultSlot, onChange]);

  const selectedDate = value ? new Date(value) : null;
  const selectedLabel =
    timing === 'scheduled' && selectedDate
      ? `${dayLabel(slotDayKey(selectedDate), today)} à ${formatAbidjanTime(selectedDate)}`
      : null;

  return {
    today,
    setActiveDay,
    slotsByDay,
    minAllowedDate,
    days,
    scheduleRestricted,
    sameDayOnly,
    cartAvailableNow,
    openNow,
    selectedDay,
    defaultSlot,
    selectedLabel,
  };
}

export type SlotPickerState = ReturnType<typeof useSlotPicker>;
