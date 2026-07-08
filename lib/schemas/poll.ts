// lib/schemas/poll.ts
//
// Schémas Zod centralisés pour les sondages (moteur générique de vote).
// Réutilisés par les server actions publiques/dashboard et le serveur MCP.
// Conformément à CLAUDE.md : pas de redéclaration inline ailleurs.

import { z } from 'zod';
import {
  POLL_TITLE_MAX,
  POLL_DESCRIPTION_MAX,
  POLL_OPTION_LABEL_MAX,
  POLL_OPTION_DESCRIPTION_MAX,
  POLL_SUGGESTION_LABEL_MAX,
  POLL_SUGGESTION_DESCRIPTION_MAX,
  POLL_SUGGESTION_SUBMITTER_NAME_MAX,
  POLL_REJECTION_REASON_MAX,
  POLL_VOTER_TOKEN_MAX,
  ORDER_CUSTOMER_PHONE_MAX,
} from '@/config/constants';
import { imageUrlSchema } from '@/lib/schemas/upload';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const pollStatusSchema = z.enum(['DRAFT', 'OPEN', 'CLOSED']);
export type PollStatusInput = z.infer<typeof pollStatusSchema>;

export const pollResultsVisibilitySchema = z.enum(['LIVE', 'AFTER_CLOSE']);
export type PollResultsVisibilityInput = z.infer<
  typeof pollResultsVisibilitySchema
>;

export const pollSuggestionStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
]);
export type PollSuggestionStatusInput = z.infer<
  typeof pollSuggestionStatusSchema
>;

// ─── Options de sondage ────────────────────────────────────────────────────────

export const pollOptionInputSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Libellé requis')
    .max(POLL_OPTION_LABEL_MAX, 'Libellé trop long'),
  description: z
    .string()
    .trim()
    .max(POLL_OPTION_DESCRIPTION_MAX, 'Description trop longue')
    .nullable()
    .optional(),
  imageUrl: imageUrlSchema.nullable().optional(),
});

export type PollOptionInput = z.infer<typeof pollOptionInputSchema>;

export const pollOptionUpdateSchema = pollOptionInputSchema
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Au moins un champ à mettre à jour est requis',
  });

export type PollOptionUpdateInput = z.infer<typeof pollOptionUpdateSchema>;

// ─── Sondage ────────────────────────────────────────────────────────────────────

export const pollInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Titre requis')
      .max(POLL_TITLE_MAX, 'Titre trop long'),
    description: z
      .string()
      .trim()
      .max(POLL_DESCRIPTION_MAX, 'Description trop longue')
      .nullable()
      .optional(),
    allowSuggestions: z.boolean().default(false),
    resultsVisibility: pollResultsVisibilitySchema.default('AFTER_CLOSE'),
    opensAt: z.iso.datetime({ offset: true }).nullable().optional(),
    closesAt: z.iso.datetime({ offset: true }).nullable().optional(),
    options: z
      .array(pollOptionInputSchema)
      .min(2, 'Au moins 2 options requises'),
  })
  .refine(
    (v) =>
      !v.opensAt || !v.closesAt || new Date(v.opensAt) < new Date(v.closesAt),
    {
      message: 'La date de clôture doit être après la date d’ouverture',
      path: ['closesAt'],
    }
  );

export type PollInput = z.infer<typeof pollInputSchema>;

// Mise à jour partielle : champs scalaires seulement (les options se gèrent à
// part via les mutations dédiées de PollOption, comme MenuCategory/Product).
export const pollUpdateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Titre requis')
      .max(POLL_TITLE_MAX, 'Titre trop long')
      .optional(),
    description: z
      .string()
      .trim()
      .max(POLL_DESCRIPTION_MAX, 'Description trop longue')
      .nullable()
      .optional(),
    allowSuggestions: z.boolean().optional(),
    resultsVisibility: pollResultsVisibilitySchema.optional(),
    opensAt: z.iso.datetime({ offset: true }).nullable().optional(),
    closesAt: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Au moins un champ à mettre à jour est requis',
  })
  .refine(
    (v) =>
      !v.opensAt || !v.closesAt || new Date(v.opensAt) < new Date(v.closesAt),
    {
      message: 'La date de clôture doit être après la date d’ouverture',
      path: ['closesAt'],
    }
  );

export type PollUpdateInput = z.infer<typeof pollUpdateSchema>;

// Transition de statut, isolée du reste du formulaire (ouvrir/clôturer).
export const pollStatusUpdateSchema = z.object({
  status: pollStatusSchema,
});

export type PollStatusUpdateInput = z.infer<typeof pollStatusUpdateSchema>;

// Filtres de liste (dashboard).
export const pollFiltersSchema = z.object({
  status: pollStatusSchema.optional(),
  search: z.string().trim().min(1).optional(),
  page: z.number().int().positive().optional(),
});

export type PollFiltersInput = z.infer<typeof pollFiltersSchema>;

// ─── Suggestions de la communauté ─────────────────────────────────────────────

export const pollSuggestionSubmitSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Nom requis')
    .max(POLL_SUGGESTION_LABEL_MAX, 'Nom trop long'),
  description: z
    .string()
    .trim()
    .max(POLL_SUGGESTION_DESCRIPTION_MAX, 'Description trop longue')
    .optional(),
  imageUrl: imageUrlSchema.nullable().optional(),
  submitterPhone: z
    .string()
    .trim()
    .max(ORDER_CUSTOMER_PHONE_MAX, 'Numéro trop long')
    .optional(),
  submitterName: z
    .string()
    .trim()
    .max(POLL_SUGGESTION_SUBMITTER_NAME_MAX, 'Nom trop long')
    .optional(),
});

export type PollSuggestionSubmitInput = z.infer<
  typeof pollSuggestionSubmitSchema
>;

export const pollSuggestionModerationSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    rejectionReason: z
      .string()
      .trim()
      .max(POLL_REJECTION_REASON_MAX, 'Motif trop long')
      .optional(),
  })
  .refine((v) => v.decision !== 'reject' || !!v.rejectionReason, {
    message: 'Motif de rejet requis',
    path: ['rejectionReason'],
  });

export type PollSuggestionModerationInput = z.infer<
  typeof pollSuggestionModerationSchema
>;

// ─── Vote ──────────────────────────────────────────────────────────────────────
//
// Un votant s'identifie par téléphone (dédup forte, réutilise la clé
// canonique Customer.phone) et/ou par un token anonyme généré côté client
// (dédup faible, cookie/localStorage) — au moins l'un des deux est requis.

export const castVoteSchema = z
  .object({
    optionId: z.string().min(1, 'Option requise'),
    phone: z
      .string()
      .trim()
      .max(ORDER_CUSTOMER_PHONE_MAX, 'Numéro trop long')
      .optional(),
    voterToken: z
      .string()
      .trim()
      .max(POLL_VOTER_TOKEN_MAX, 'Identifiant invalide')
      .optional(),
  })
  .refine((v) => !!v.phone || !!v.voterToken, {
    message: 'Téléphone ou identifiant anonyme requis',
    path: ['voterToken'],
  });

export type CastVoteInput = z.infer<typeof castVoteSchema>;
