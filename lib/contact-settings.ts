// lib/contact-settings.ts
//
// Schéma Zod + défauts des coordonnées publiques du commerce (adresse,
// téléphone, WhatsApp, email, liens Maps, réseaux sociaux). Éditables dans
// la page Paramètres (ADMIN). Les liens `tel:`/`wa.me` ne sont PAS stockés
// ici : ils se dérivent à l'affichage via `lib/contact-links.ts`.

import { z } from 'zod';
import { normalizeIvorianPhone } from '@/lib/phone';

const phoneNumber = z
  .string()
  .trim()
  .min(1, 'Numéro requis')
  .refine((v) => normalizeIvorianPhone(v) !== null, 'Numéro invalide');

export const contactSettingsSchema = z.object({
  address: z.string().trim().min(1).max(200),
  district: z.string().trim().min(1).max(100),
  landmark: z.string().trim().min(1).max(150),
  hoursLabel: z.string().trim().min(1).max(100),
  openingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format HH:MM'),
  closingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format HH:MM'),
  phone: phoneNumber,
  whatsapp: phoneNumber,
  email: z.string().trim().email('Email invalide'),
  mapsDirectionsUrl: z.string().trim().url('URL invalide').max(500),
  mapsEmbedUrl: z.string().trim().url('URL invalide').max(2000),
  instagramHandle: z.string().trim().min(1).max(50),
  instagramUrl: z.string().trim().url('URL invalide').max(300),
  tiktokHandle: z.string().trim().min(1).max(50),
  tiktokUrl: z.string().trim().url('URL invalide').max(300),
  hashtagLabel: z.string().trim().min(1).max(50),
  hashtagUrl: z.string().trim().url('URL invalide').max(300),
});

export type ContactSettings = z.infer<typeof contactSettingsSchema>;

// Valeurs reprises de l'ancien config/brand.config.ts — servent de filet de
// sécurité tant qu'aucune ligne n'est enregistrée en base, à corriger par
// l'admin depuis /dashboard/parametres.
export const DEFAULT_CONTACT_SETTINGS: ContactSettings = {
  address: 'Boulevard Latrille, Cocody, Abidjan',
  district: 'Cocody, Abidjan',
  landmark: 'A 2 min du carrefour Duncan',
  hoursLabel: 'Lun - Dim : 7h30 - 21h30',
  openingTime: '07:30',
  closingTime: '21:30',
  phone: '+225 27 22 00 00 00',
  whatsapp: '+225 07 00 00 00 00',
  email: 'contact@eba.ci',
  mapsDirectionsUrl:
    'https://maps.google.com/?q=Boulevard+Latrille+Cocody+Abidjan',
  mapsEmbedUrl:
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3775.551175252953!2d-3.9601476!3d5.4037600999999995!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xfc193623ac5095f%3A0x7f92b7dfdde03a30!2sEba%20coffee%20shop!5e1!3m2!1sfr!2sci!4v1780742729469!5m2!1sfr!2sci',
  instagramHandle: '@eba.coffeeshop',
  instagramUrl: 'https://www.instagram.com/eba.coffeeshop/',
  tiktokHandle: '@eba.coffeeshop',
  tiktokUrl: 'https://www.tiktok.com/@eba.coffeeshop',
  hashtagLabel: '#InstantEBA',
  hashtagUrl: 'https://www.instagram.com/explore/tags/InstantEBA/',
};

/** Ligne DB partielle → config effective (défauts si champ manquant/null). */
export function contactSettingsFromRow(
  row: Partial<ContactSettings> | null | undefined
): ContactSettings {
  return { ...DEFAULT_CONTACT_SETTINGS, ...(row ?? {}) };
}
