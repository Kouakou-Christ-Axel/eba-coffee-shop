import prisma from '@/lib/prisma';
import { getInventorySettings } from '@/lib/inventory-settings-db';
import { getDaysSinceLastCount, listLowStockItems } from '@/lib/inventory';
import { sendInventoryReminderEmail } from '@/lib/email';

export async function maybeSendInventoryReminder(): Promise<void> {
  try {
    const settings = await getInventorySettings();
    if (!settings.reminderEnabled) return;

    const days = await getDaysSinceLastCount();
    if (days === null || days <= settings.reminderDays) return;

    const row = await prisma.inventorySettings.findUnique({
      where: { id: 'singleton' },
      select: { lastReminderSentAt: true },
    });
    const last = row?.lastReminderSentAt;
    if (last && Date.now() - last.getTime() < 24 * 60 * 60 * 1000) return;

    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true },
    });
    const recipients = admins.map((a) => a.email).filter(Boolean);
    if (recipients.length === 0) return;

    const lowStock = await listLowStockItems();
    await sendInventoryReminderEmail({
      daysSince: days,
      recipients,
      lowStockItems: lowStock.slice(0, 10).map((i) => ({
        name: i.name,
        quantity: i.currentQuantity,
        unit: i.unit,
      })),
    });

    await prisma.inventorySettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', lastReminderSentAt: new Date() },
      update: { lastReminderSentAt: new Date() },
    });
  } catch (err) {
    console.error('[inventory] rappel email échoué', err);
  }
}
