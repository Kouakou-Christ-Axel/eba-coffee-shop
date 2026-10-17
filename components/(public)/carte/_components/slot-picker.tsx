'use client';

// Étape « Pour quand ? » du checkout : « Dès que possible » ou « Planifier ».
// Données : `usePickupInfo` (fetch unique pour tout le modal).

import { Button } from '@heroui/react';
import { Clock, RefreshCw } from 'lucide-react';
import { DayChips, DaySlots } from './slot-picker-day-view';
import { PickupModeToggle } from './pickup-mode-toggle';
import {
  AdvanceOrderNotice,
  SameDayOnlyNotice,
  ScheduleRestrictedNotice,
} from './slot-picker/constraint-notices';
import { DefaultSlotShortcut } from './slot-picker/default-slot-shortcut';
import { shortDayDate } from './slot-picker/helpers';
import type { SlotPickerProps } from './slot-picker/types';
import { useSlotPicker } from './slot-picker/use-slot-picker';

export function SlotPicker(props: SlotPickerProps) {
  const {
    timing,
    onTimingChange,
    value,
    onChange,
    error,
    info,
    minAdvanceOrderDays = 0,
    soldOutRestricted = false,
    precommandePure = false,
  } = props;
  const picker = useSlotPicker(props);
  const { days, selectedDay, minAllowedDate, defaultSlot } = picker;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex w-full items-baseline justify-between">
        <p className="text-sm font-medium">Pour quand&nbsp;?</p>
        {picker.selectedLabel && (
          <span className="flex items-center gap-1 text-xs text-primary">
            <Clock className="h-3 w-3" />
            {picker.selectedLabel}
          </span>
        )}
      </div>

      {info.status === 'loading' ? (
        <p className="rounded-md border border-foreground/15 px-3 py-4 text-center text-xs text-foreground/50">
          Chargement des horaires…
        </p>
      ) : info.status === 'error' ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-foreground/15 px-3 py-4">
          <p className="text-center text-xs text-foreground/50">
            Impossible de charger les horaires.
          </p>
          <Button
            size="sm"
            variant="bordered"
            startContent={<RefreshCw className="h-3.5 w-3.5" />}
            onPress={info.retry}
          >
            Réessayer
          </Button>
        </div>
      ) : (
        <>
          <AdvanceOrderNotice
            minAdvanceOrderDays={minAdvanceOrderDays}
            precommandePure={precommandePure}
            soldOutRestricted={soldOutRestricted}
          />

          {picker.sameDayOnly && <SameDayOnlyNotice />}
          {picker.scheduleRestricted && <ScheduleRestrictedNotice />}

          <PickupModeToggle
            timing={timing}
            onTimingChange={onTimingChange}
            openNow={picker.openNow}
            minAllowedDate={minAllowedDate}
            soldOutRestricted={soldOutRestricted}
            cartAvailableNow={picker.cartAvailableNow}
            leadTimeMin={info.leadTimeMin}
          />

          {error && <p className="text-xs text-danger">{error}</p>}

          {timing === 'scheduled' &&
            (selectedDay ? (
              <div className="flex flex-col gap-2 pt-1">
                {minAllowedDate && defaultSlot && (
                  <DefaultSlotShortcut
                    defaultSlot={defaultSlot}
                    value={value}
                    today={picker.today}
                    onChange={onChange}
                    onSelectDay={picker.setActiveDay}
                  />
                )}
                {precommandePure ? (
                  <p className="text-xs font-medium text-foreground/70">
                    Retrait demain, {shortDayDate(selectedDay)}
                  </p>
                ) : (
                  <DayChips
                    days={days}
                    today={picker.today}
                    activeDay={selectedDay}
                    onSelect={picker.setActiveDay}
                  />
                )}
                <DaySlots
                  day={days.find((d) => d.date === selectedDay) ?? days[0]}
                  slots={picker.slotsByDay.get(selectedDay) ?? []}
                  selected={value}
                  onSelect={onChange}
                />
              </div>
            ) : (
              <p className="py-3 text-center text-xs text-foreground/50">
                Aucun jour disponible pour un article de votre panier dans les
                prochains jours.
              </p>
            ))}
        </>
      )}
    </div>
  );
}
