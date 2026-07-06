import prisma from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import {
  DEFAULT_SETTINGS,
  pickupSettingsSchema,
  type PickupSettings,
} from '@/lib/pickup-settings';
import { generatePickupSlots } from '@/lib/pickup-slots';

export async function getPickupSettings(): Promise<PickupSettings> {
  const row = await prisma.pickupSettings.findUnique({
    where: { id: 'singleton' },
  });
  if (!row) return DEFAULT_SETTINGS;

  const parsed = pickupSettingsSchema.safeParse({
    slotIntervalMin: row.slotIntervalMin,
    leadTimeMin: row.leadTimeMin,
    visibleDays: row.visibleDays,
    capacityPerSlot: row.capacityPerSlot,
    weeklyHours: row.weeklyHours,
    dateOverrides: row.dateOverrides,
    pickupAddress: row.pickupAddress,
    pickupMapsUrl: row.pickupMapsUrl,
  });

  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function updatePickupSettings(
  input: PickupSettings
): Promise<void> {
  const validated = pickupSettingsSchema.parse(input);
  const data = {
    slotIntervalMin: validated.slotIntervalMin,
    leadTimeMin: validated.leadTimeMin,
    visibleDays: validated.visibleDays,
    capacityPerSlot: validated.capacityPerSlot,
    weeklyHours: validated.weeklyHours as Prisma.InputJsonValue,
    dateOverrides: validated.dateOverrides as Prisma.InputJsonValue,
    pickupAddress: validated.pickupAddress,
    pickupMapsUrl: validated.pickupMapsUrl,
  };
  await prisma.pickupSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...data },
    update: data,
  });
}

export async function getAvailablePickupSlots(
  now: Date,
  presetSettings?: PickupSettings
): Promise<Date[]> {
  const settings = presetSettings ?? (await getPickupSettings());
  const candidates = generatePickupSlots(now, settings);

  if (settings.capacityPerSlot === null || candidates.length === 0) {
    return candidates;
  }

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['NEW', 'PREPARING', 'READY'] },
      pickupTime: { in: candidates },
    },
    select: { pickupTime: true },
  });

  const counts = new Map<number, number>();
  for (const o of orders) {
    if (!o.pickupTime) continue;
    const key = o.pickupTime.getTime();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const capacity = settings.capacityPerSlot;
  return candidates.filter((s) => (counts.get(s.getTime()) ?? 0) < capacity);
}
