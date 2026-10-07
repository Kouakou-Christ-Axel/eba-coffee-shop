// lib/mcp/tools/expense-purchases.ts
//
// Outils MCP — expense-purchases (extrait de lib/mcp/tools.ts, sans changement de comportement).

import { z } from 'zod';
import {
  preparePurchase,
  confirmPurchase,
  prepareOtherExpense,
  confirmOtherExpense,
} from '@/lib/purchase-drafts';
import {
  preparePurchaseSchema,
  confirmPurchaseSchema,
  prepareOtherExpenseSchema,
  confirmExpenseDraftSchema,
} from '@/lib/schemas/purchase';
import type { McpTool } from './types';

export const expensePurchasesTools: McpTool[] = [
  // — Dépenses : achats en deux temps (brouillon → confirmation) —
  //
  // Aucun outil n'écrit un achat en un seul appel : `prepare_purchase` /
  // `prepare_other_expense` produisent un brouillon persisté (TTL réglable,
  // `ExpenseSettings.draftTtlMinutes`) accompagné d'un récapitulatif et
  // d'avertissements, à valider explicitement par l'utilisateur avant
  // `confirm_purchase` / `confirm_other_expense`. `create_expense` reste
  // disponible mais est déprécié pour les achats fournisseur (cf. sa
  // description).
  {
    name: 'prepare_purchase',
    toolset: 'finance',
    scope: 'finance',
    title: 'Préparer un achat (brouillon)',
    description:
      'Prépare un brouillon d’achat détaillé (une ou plusieurs lignes) : ' +
      'rapproche chaque ligne au référentiel d’articles (`articleId` connu, ou ' +
      '`articleName`/`rawLabel` à rapprocher — SANS jamais créer d’article à ' +
      'cette étape), calcule les montants/quantités dérivables et produit des ' +
      'avertissements de vigilance : ligne non rapprochée ou ambiguë ' +
      '(`UNMATCHED_LINE`/`AMBIGUOUS_LINE`), prix unitaire anormalement élevé ' +
      '(`PRICE_ABERRANT`), somme des lignes ne correspondant pas au ' +
      '`totalAmount` indiqué (`SUM_MISMATCH`), doublon suspecté même ' +
      'fournisseur/même montant/même jour (`DUPLICATE_SUSPECTED`), article ' +
      'habituellement acheté en gros (`BULK_RECHUTE`), ou libellé libre ' +
      'récurrent à référencer (`RECURRENCE_SUGGEST`). N’écrit RIEN de définitif ' +
      '(ni dépense, ni article) — le brouillon est persisté avec une durée de ' +
      'vie limitée (`expiresAt`). Après cet appel, présente TOUJOURS le ' +
      'récapitulatif (summary) et les avertissements (warnings) à l’utilisateur ' +
      'et attends sa confirmation explicite avant d’appeler confirm_purchase.',
    inputSchema: preparePurchaseSchema,
    readOnly: false,
    handler: (args) => preparePurchase(args),
  },
  {
    name: 'confirm_purchase',
    toolset: 'finance',
    scope: 'finance',
    title: 'Confirmer un achat (brouillon → dépense)',
    description:
      'Confirme un brouillon d’achat créé par `prepare_purchase` (`draftId`) et ' +
      'enregistre la dépense correspondante (avec son détail par article, via ' +
      'le même moteur que `create_expense`). Échoue si le brouillon est ' +
      'inexistant, expiré ou déjà confirmé. `resolutions` (optionnel) permet, ' +
      'PAR INDEX de ligne (l’index dans le tableau `lines` fourni à ' +
      '`prepare_purchase`) : de choisir explicitement l’article (`articleId` ou ' +
      '`articleName`) pour les lignes ambiguës ou non rapprochées, de décocher ' +
      'des lignes (`excluded: true`, ex. doublon confirmé) et de corriger les ' +
      'quantités/prix/montant (`formatQty`, `formatSize`, `unitPrice`, ' +
      '`amount`) avant l’enregistrement définitif.',
    inputSchema: confirmPurchaseSchema,
    readOnly: false,
    handler: (args) => {
      const { draftId, resolutions } = args as {
        draftId: string;
        resolutions?: NonNullable<
          z.infer<typeof confirmPurchaseSchema>['resolutions']
        >;
      };
      return confirmPurchase(draftId, resolutions);
    },
  },
  {
    name: 'prepare_other_expense',
    toolset: 'finance',
    scope: 'finance',
    title: 'Préparer une dépense simple (brouillon)',
    description:
      'Prépare un brouillon de dépense « globale », sans détail par article ' +
      '(loyer, facture, abonnement…) : valide les champs et persiste un ' +
      'brouillon (`expiresAt`) sans rien écrire de définitif. Après cet appel, ' +
      'présente TOUJOURS le récapitulatif (summary) et les avertissements ' +
      '(warnings) à l’utilisateur et attends sa confirmation explicite avant ' +
      'd’appeler confirm_other_expense.',
    inputSchema: prepareOtherExpenseSchema,
    readOnly: false,
    handler: (args) => prepareOtherExpense(args),
  },
  {
    name: 'confirm_other_expense',
    toolset: 'finance',
    scope: 'finance',
    title: 'Confirmer une dépense simple (brouillon → dépense)',
    description:
      'Confirme un brouillon de dépense simple créé par `prepare_other_expense` ' +
      '(`draftId`) et enregistre la dépense. Échoue si le brouillon est ' +
      'inexistant, expiré ou déjà confirmé. Pas de lignes à résoudre (dépense ' +
      'globale) : aucune `resolutions` possible à cette étape.',
    inputSchema: confirmExpenseDraftSchema,
    readOnly: false,
    handler: (args) =>
      confirmOtherExpense((args as { draftId: string }).draftId),
  },
];
