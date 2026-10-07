// lib/mcp/tools/contact.ts
//
// Outils MCP — contact (extrait de lib/mcp/tools.ts, sans changement de comportement).

import { z } from 'zod';
import {
  getContactSettings,
  updateContactSettings,
} from '@/lib/contact-settings-db';
import {
  contactSettingsSchema,
  type ContactSettings,
} from '@/lib/contact-settings';
import type { McpTool } from './types';

export const contactTools: McpTool[] = [
  {
    name: 'get_contact_settings',
    toolset: 'contact',
    title: 'Lire les coordonnées du commerce',
    description:
      'Renvoie les coordonnées publiques du commerce : adresse, quartier, ' +
      'repère, horaires, téléphone, WhatsApp Business, email, liens Maps ' +
      '(itinéraire + carte embarquée), réseaux sociaux (Instagram et TikTok ' +
      'obligatoires ; Facebook, X, LinkedIn et YouTube facultatifs — une ' +
      'chaîne vide signifie « pas de compte ») et hashtag.',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => getContactSettings(),
  },
  {
    name: 'update_contact_settings',
    toolset: 'contact',
    title: 'Modifier les coordonnées du commerce',
    description:
      'Met à jour les coordonnées publiques du commerce (adresse, téléphone, ' +
      'WhatsApp Business, email, liens Maps, réseaux sociaux). Le numéro ' +
      'WhatsApp doit être un numéro ivoirien valide — le lien wa.me est ' +
      'dérivé automatiquement, ne pas le stocker séparément. Les liens ' +
      'Facebook / X / LinkedIn / YouTube sont facultatifs : envoyer une chaîne ' +
      'vide retire le réseau du pied de page et du balisage `sameAs`.',
    inputSchema: contactSettingsSchema,
    readOnly: false,
    handler: async (args) => {
      await updateContactSettings(args as ContactSettings);
      return getContactSettings();
    },
  },
];
