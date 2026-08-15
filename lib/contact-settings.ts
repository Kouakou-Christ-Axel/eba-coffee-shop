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

/**
 * URL de profil social FACULTATIVE : chaîne vide = « le commerce n'est pas sur
 * ce réseau », et non « URL invalide ». Instagram et TikTok restent obligatoires
 * (comptes historiques, affichés avec leur pseudo dans la section « Suivez
 * l'aventure ») ; Facebook / X / LinkedIn / YouTube sont opt-in et disparaissent
 * simplement du pied de page et du `sameAs` JSON-LD tant qu'ils sont vides.
 */
const optionalProfileUrl = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) => v === '' || z.string().url().safeParse(v).success,
    'URL invalide'
  );

export const contactSettingsSchema = z.object({
  address: z.string().trim().min(1).max(200),
  district: z.string().trim().min(1).max(100),
  landmark: z.string().trim().min(1).max(150),
  phone: phoneNumber,
  whatsapp: phoneNumber,
  email: z.string().trim().email('Email invalide'),
  mapsDirectionsUrl: z.string().trim().url('URL invalide').max(500),
  mapsEmbedUrl: z.string().trim().url('URL invalide').max(2000),
  /** Repère donné au client pour le champ destination de l'appli Yango (distinct
   * de `landmark`, qui est la description publique du lieu sur le site). */
  yangoLandmark: z.string().trim().min(1).max(150),
  wavePaymentNumber: phoneNumber,
  orangeMoneyPaymentNumber: phoneNumber,
  instagramHandle: z.string().trim().min(1).max(50),
  instagramUrl: z.string().trim().url('URL invalide').max(300),
  tiktokHandle: z.string().trim().min(1).max(50),
  tiktokUrl: z.string().trim().url('URL invalide').max(300),
  facebookUrl: optionalProfileUrl,
  xUrl: optionalProfileUrl,
  linkedinUrl: optionalProfileUrl,
  youtubeUrl: optionalProfileUrl,
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
  phone: '+225 27 22 00 00 00',
  whatsapp: '+225 07 00 00 00 00',
  email: 'contact@eba.ci',
  mapsDirectionsUrl:
    'https://maps.google.com/?q=Boulevard+Latrille+Cocody+Abidjan',
  mapsEmbedUrl:
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3775.551175252953!2d-3.9601476!3d5.4037600999999995!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xfc193623ac5095f%3A0x7f92b7dfdde03a30!2sEba%20coffee%20shop!5e1!3m2!1sfr!2sci!4v1780742729469!5m2!1sfr!2sci',
  yangoLandmark: 'Odyssée du vin',
  wavePaymentNumber: '+225 07 00 00 00 00',
  orangeMoneyPaymentNumber: '+225 07 00 00 00 00',
  instagramHandle: '@eba.coffeeshop',
  instagramUrl: 'https://www.instagram.com/eba.coffeeshop/',
  tiktokHandle: '@eba.coffeeshop',
  tiktokUrl: 'https://www.tiktok.com/@eba.coffeeshop',
  facebookUrl: '',
  xUrl: '',
  linkedinUrl: '',
  youtubeUrl: '',
  hashtagLabel: '#InstantEBA',
  hashtagUrl: 'https://www.instagram.com/explore/tags/InstantEBA/',
};

/** Ligne DB partielle → config effective (défauts si champ manquant/null). */
export function contactSettingsFromRow(
  row: Partial<Record<keyof ContactSettings, string | null>> | null | undefined
): ContactSettings {
  // Un `null` en base doit retomber sur le défaut, pas l'écraser : un simple
  // spread de la ligne poserait `null` sur le champ et ferait mentir le type.
  const defined = Object.fromEntries(
    Object.entries(row ?? {}).filter(([, value]) => value !== null)
  );
  return { ...DEFAULT_CONTACT_SETTINGS, ...defined };
}
