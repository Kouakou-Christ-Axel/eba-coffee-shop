import prisma from '@/lib/prisma';
import {
  DEFAULT_MENU_SETTINGS,
  menuSettingsSchema,
  type MenuSettings,
} from '@/lib/menu-settings';

export async function getMenuSettings(): Promise<MenuSettings> {
  const row = await prisma.menuSettings.findUnique({
    where: { id: 'singleton' },
  });
  if (!row) return DEFAULT_MENU_SETTINGS;

  const parsed = menuSettingsSchema.safeParse({ menuPdfUrl: row.menuPdfUrl });
  return parsed.success ? parsed.data : DEFAULT_MENU_SETTINGS;
}

export async function updateMenuSettings(input: MenuSettings): Promise<void> {
  const validated = menuSettingsSchema.parse(input);
  await prisma.menuSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', menuPdfUrl: validated.menuPdfUrl },
    update: { menuPdfUrl: validated.menuPdfUrl },
  });
}
