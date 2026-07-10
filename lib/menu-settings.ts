import { z } from 'zod';
import { cloudinaryUrlSchema } from '@/lib/schemas/upload';

export const menuSettingsSchema = z.object({
  menuPdfUrl: cloudinaryUrlSchema.nullable(),
});

export type MenuSettings = z.infer<typeof menuSettingsSchema>;

export const DEFAULT_MENU_SETTINGS: MenuSettings = {
  menuPdfUrl: null,
};
