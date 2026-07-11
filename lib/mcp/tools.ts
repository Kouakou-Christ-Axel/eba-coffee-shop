// lib/mcp/tools.ts
//
// Registre des outils (« tools ») exposés par le serveur MCP de gestion du menu.
//
// Principe : aucun outil ne réimplémente de logique métier. Chacun branche les
// fonctions existantes — `getMenuAdmin()` (lecture) et `lib/menu-mutations.ts`
// (écriture) — et réutilise les schémas Zod centralisés pour la validation des
// arguments. Conformément à CLAUDE.md, on ne redéclare pas de schémas inline :
// on importe ceux de `menu-mutations` et on les `.extend()` quand un `id` est
// requis.
//
// Le schéma Zod de chaque outil sert à deux choses :
//   1. générer le `inputSchema` JSON Schema renvoyé dans `tools/list` (via
//      `z.toJSONSchema`, natif en Zod 4) ;
//   2. valider les `arguments` reçus dans `tools/call` avant d'appeler le handler.

import { z } from 'zod';
import { getMenuAdmin } from '@/lib/menu';
import {
  getDailyStats,
  getRangeStats,
  getDailySeries,
  getTopProducts,
} from '@/lib/stats';
import { parseDateOnlyToUTC, currentMonthRange } from '@/lib/timezone';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryAvailability,
  moveCategory,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductAvailability,
  toggleProductFeatured,
  moveProduct,
  setProductStock,
  setOptionStock,
  restockProduct,
  restockOption,
  pauseProduct,
  resumeProduct,
  createCategorySchema,
  updateCategorySchema,
  productInputSchema,
  productUpdateSchema,
} from '@/lib/menu-mutations';
import { uploadProductImage, uploadReceiptImage } from '@/lib/cloudinary';
import { ALLOWED_IMAGE_MIME_TYPES, imageUrlSchema } from '@/lib/schemas/upload';
import {
  listExpenseCategories,
  listExpenses,
  getExpenseSummary,
  listExpenseArticles,
  getExpenseArticleStats,
  getExpenseArticleHistory,
  getExpenseMonthlySeries,
} from '@/lib/expenses';
import {
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  createExpense,
  updateExpense,
  deleteExpense,
  renameExpenseArticle,
  deleteExpenseArticle,
} from '@/lib/expense-mutations';
import {
  expenseCategoryInputSchema,
  expenseInputSchema,
  expenseUpdateObjectSchema,
  expenseFiltersSchema,
  expenseFrequencyFiltersSchema,
  expenseArticleRenameSchema,
} from '@/lib/schemas/expense';
import {
  listInvestmentSources,
  listInvestments,
  getInvestmentSummary,
} from '@/lib/investments';
import {
  createInvestmentSource,
  updateInvestmentSource,
  deleteInvestmentSource,
  createInvestment,
  updateInvestment,
  deleteInvestment,
} from '@/lib/investment-mutations';
import {
  investmentSourceInputSchema,
  investmentInputSchema,
  investmentObjectSchema,
  investmentFiltersSchema,
} from '@/lib/schemas/investment';
import {
  listRevenueAdjustments,
  getRevenueAdjustmentSummary,
} from '@/lib/revenue-adjustments';
import {
  createRevenueAdjustment,
  updateRevenueAdjustment,
  deleteRevenueAdjustment,
} from '@/lib/revenue-adjustment-mutations';
import {
  revenueAdjustmentInputSchema,
  revenueAdjustmentObjectSchema,
  revenueAdjustmentFiltersSchema,
} from '@/lib/schemas/revenue-adjustment';
import {
  getCashFigures,
  getCashClosing,
  listCashClosings,
} from '@/lib/cash-closing';
import { saveCashClosing } from '@/lib/cash-closing-mutations';
import { cashClosingInputSchema } from '@/lib/schemas/cash-closing';
import {
  listCustomers,
  getCustomer,
  getCustomerByPhone,
} from '@/lib/customers';
import { getLoyaltyCard, getLoyaltyCardByPhone } from '@/lib/loyalty';
import { listOrders, getOrder } from '@/lib/orders';
import {
  createCashierOrder,
  buildOrderItemsFromMenu,
  setOrderStatus,
  setOrderPayment,
  updateOrderItems,
  updateOrderDetails,
  OrderMutationError,
  type OrderItemRef,
} from '@/lib/order-mutations';
import type { CartItem } from '@/lib/cart-store';
import {
  orderTypeSchema,
  orderStatusSchema,
  paymentModeSchema,
} from '@/lib/schemas/order';
import { adjustStamps } from '@/lib/loyalty-mutations';
import {
  getLoyaltySettings,
  updateLoyaltySettings,
} from '@/lib/loyalty-settings-db';
import {
  loyaltySettingsSchema,
  type LoyaltySettings,
} from '@/lib/loyalty-settings';
import {
  listInventoryItems,
  getInventoryItem,
  getInventorySummary,
  listLowStockItems,
  listInventoryPurchases,
  listInventoryCounts,
  getInventoryCount,
} from '@/lib/inventory';
import {
  createInventoryItem,
  updateInventoryItem,
  archiveInventoryItem,
  batchRestock,
  cancelRestockBatch,
  recordInventoryCount,
} from '@/lib/inventory-mutations';
import {
  getInventorySettings,
  updateInventorySettings,
} from '@/lib/inventory-settings-db';
import {
  inventoryItemUpdateSchema,
  batchRestockSchema,
  batchCountSchema,
  inventoryFiltersSchema,
  inventoryItemInputSchema,
} from '@/lib/schemas/inventory';
import { inventorySettingsSchema } from '@/lib/inventory-settings';
import {
  getPollsAdmin,
  getPollAdmin,
  getPollResults,
  listSuggestionsAdmin,
  getSuggestion,
} from '@/lib/polls';
import {
  createPoll,
  updatePoll,
  setPollStatus,
  deletePoll,
  createPollOption,
  updatePollOption,
  movePollOption,
  deletePollOption,
  moderatePollSuggestion,
} from '@/lib/poll-mutations';
import {
  pollInputSchema,
  pollUpdateSchema,
  pollStatusUpdateSchema,
  pollOptionInputSchema,
  pollOptionUpdateSchema,
  pollSuggestionModerationSchema,
  pollFiltersSchema,
} from '@/lib/schemas/poll';
import { uploadPollOptionImage, uploadPollImage } from '@/lib/cloudinary';

// ─── Type d'un outil ────────────────────────────────────────────────────────

export type McpTool = {
  name: string;
  title: string;
  description: string;
  /** Schéma Zod des arguments. `z.object({})` = aucun argument. */
  inputSchema: z.ZodType;
  /** Outil en lecture seule (annotation MCP `readOnlyHint`). */
  readOnly: boolean;
  /**
   * Portée d'accès restreinte. `'finance'` = accessible aux rôles finance
   * (ADMIN, MANAGER, COMPTABLE) ; absent = accessible à ADMIN/MANAGER
   * uniquement (cf. `withRoleGuard` dans `app/api/mcp/route.ts`).
   */
  scope?: 'finance';
  /** Exécute l'outil. Reçoit les arguments déjà validés par `inputSchema`. */
  handler: (args: unknown) => Promise<unknown>;
};

const idSchema = z.string().min(1, 'Identifiant requis');

// Plage de dates pour les outils statistiques (jour civil Abidjan, inclusif).
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : YYYY-MM-DD');
const rangeSchema = z.object({
  from: dateOnly.describe('Date de début (incluse), format YYYY-MM-DD.'),
  to: dateOnly.describe('Date de fin (incluse), format YYYY-MM-DD.'),
});

/** Convertit la plage validée en bornes Date (UTC minuit), from ≤ to. */
function toRange(args: unknown): { from: Date; to: Date } {
  const { from, to } = args as { from: string; to: string };
  let f = parseDateOnlyToUTC(from)!;
  let t = parseDateOnlyToUTC(to)!;
  if (f.getTime() > t.getTime()) [f, t] = [t, f];
  return { from: f, to: t };
}

/**
 * Résout l'argument image d'un outil `set_*` en une URL réellement stockable
 * et affichable :
 *   • `imageBase64` (+ `mimeType`) → retraité (sharp) et écrit localement ;
 *   • `imageUrl` déjà local (`/uploads/...`) → conservé tel quel ;
 *   • `imageUrl` http(s) → **rapatrié côté serveur** puis écrit localement.
 *
 * Le rapatriement des URLs distantes est indispensable : une URL externe
 * stockée telle quelle ne s'afficherait pas (hôte hors `img-src` de la CSP et
 * hors `images.remotePatterns`). C'est aussi le seul chemin praticable depuis
 * un client de chat, qui ne peut pas ré-encoder une photo en base64.
 */
async function resolveStoredImageUrl(
  args: { imageBase64?: string; mimeType?: string; imageUrl?: string },
  fromBase64: (input: string, mimeType?: string) => Promise<string>,
  fromUrl: (url: string) => Promise<string>
): Promise<string> {
  const { imageBase64, mimeType, imageUrl } = args;
  if (imageBase64) return fromBase64(imageBase64, mimeType);
  const url = imageUrl!;
  return url.startsWith('/') ? url : fromUrl(url);
}

// ─── Définitions ──────────────────────────────────────────────────────────────

export const tools: McpTool[] = [
  // — Lecture —
  {
    name: 'get_menu',
    title: 'Lire le menu',
    description:
      'Renvoie le menu complet avec les identifiants internes (id), y compris ' +
      'les catégories et produits masqués. Utilise les `id` renvoyés ici pour ' +
      'cibler les outils de modification.',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => getMenuAdmin(),
  },

  // — Statistiques (lecture seule) —
  {
    name: 'get_daily_stats',
    scope: 'finance',
    title: 'Stats du jour',
    description:
      'Renvoie les statistiques agrégées de la journée en cours (jour civil ' +
      'Abidjan) : nombre de commandes, revenu encaissé, commandes actives/' +
      'terminées/annulées, répartition par type et par mode de paiement.',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => getDailyStats(),
  },
  {
    name: 'get_range_stats',
    scope: 'finance',
    title: 'Stats sur une période',
    description:
      'KPIs agrégés sur une plage de dates (incluse) : commandes, revenu ' +
      'encaissé (CA), panier moyen, taux d’annulation, et répartitions par ' +
      'statut, type de commande et mode de paiement. Montants en francs CFA.',
    inputSchema: rangeSchema,
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      return getRangeStats(from, to);
    },
  },
  {
    name: 'get_daily_series',
    scope: 'finance',
    title: 'Série journalière',
    description:
      'Renvoie, jour par jour sur la plage demandée (jours sans activité ' +
      'inclus à 0), le nombre de commandes et le CA encaissé. Idéal pour ' +
      'tracer une tendance.',
    inputSchema: rangeSchema,
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      return getDailySeries(from, to);
    },
  },
  {
    name: 'get_top_products',
    scope: 'finance',
    title: 'Top produits',
    description:
      'Renvoie les produits les plus vendus sur la plage (hors commandes ' +
      'annulées), triés par quantité, avec le chiffre d’affaires associé ' +
      '(net de remise). `limit` est optionnel (défaut 8).',
    inputSchema: rangeSchema.extend({
      limit: z
        .number()
        .int()
        .positive()
        .max(50)
        .optional()
        .describe('Nombre de produits à renvoyer (défaut 8, max 50).'),
    }),
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      const { limit } = args as { limit?: number };
      return getTopProducts(from, to, limit);
    },
  },

  // — Dépenses : catégories —
  {
    name: 'list_expense_categories',
    scope: 'finance',
    title: 'Lister les catégories de dépense',
    description:
      'Renvoie les catégories de dépense avec leur `id` et le nombre de ' +
      'dépenses rattachées. Utilise ces `id` pour `create_expense`.',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => listExpenseCategories(),
  },
  {
    name: 'create_expense_category',
    scope: 'finance',
    title: 'Créer une catégorie de dépense',
    description:
      'Crée une catégorie de dépense (ex. « Emballages », « Loyer »). Le nom ' +
      'doit être unique. `nature` ∈ FIXED (charges fixes : loyer, salaires, ' +
      'abonnements…) / VARIABLE (défaut — achats variables) : elle alimente le ' +
      'split fixes/variables des statistiques.',
    inputSchema: expenseCategoryInputSchema,
    readOnly: false,
    handler: (args) => createExpenseCategory(args),
  },
  {
    name: 'update_expense_category',
    scope: 'finance',
    title: 'Modifier une catégorie de dépense',
    description:
      'Met à jour une catégorie de dépense de façon PARTIELLE : `name` et/ou ' +
      '`nature` (FIXED = charge fixe, VARIABLE = achat variable).',
    inputSchema: expenseCategoryInputSchema.partial().extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return updateExpenseCategory(id, rest);
    },
  },
  {
    name: 'delete_expense_category',
    scope: 'finance',
    title: 'Supprimer une catégorie de dépense',
    description:
      'Supprime une catégorie de dépense. Refusé si des dépenses y sont ' +
      'rattachées.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteExpenseCategory((args as { id: string }).id),
  },

  // — Dépenses : opérations —
  {
    name: 'list_expenses',
    scope: 'finance',
    title: 'Lister les dépenses',
    description:
      'Renvoie les dépenses filtrées par plage de dates (`from`/`to`, ' +
      '`YYYY-MM-DD`, jour civil Abidjan), `categoryId`, `paymentMethod` ' +
      '(CASH/WAVE/BANK/OTHER) et/ou `search` (fournisseur, note, ou nom ' +
      'd’article du détail — « farine » retrouve les dépenses contenant une ' +
      'ligne « Farine T45 »), avec le total. Chaque dépense inclut ses lignes ' +
      'de détail (`items`) et porte un numéro de reçu `receiptNo` ' +
      '(DEP-YYYY-MM-NNNN, séquence remise à zéro chaque mois). Tous les ' +
      'filtres sont optionnels.',
    inputSchema: expenseFiltersSchema,
    readOnly: true,
    handler: (args) => {
      const f = args as {
        from?: string;
        to?: string;
        categoryId?: string;
        paymentMethod?: 'CASH' | 'WAVE' | 'BANK' | 'OTHER';
        search?: string;
      };
      return listExpenses({
        dateFrom: parseDateOnlyToUTC(f.from),
        dateTo: parseDateOnlyToUTC(f.to),
        categoryId: f.categoryId,
        paymentMethod: f.paymentMethod,
        search: f.search,
      });
    },
  },
  {
    name: 'get_expense_summary',
    scope: 'finance',
    title: 'Synthèse des dépenses',
    description:
      'Renvoie le total des dépenses, le split charges fixes / dépenses ' +
      'variables (`fixed`/`variable`, selon la nature des catégories) et la ' +
      'ventilation par catégorie (montant + nombre) sur une plage de dates. ' +
      'Montants en francs CFA.',
    inputSchema: rangeSchema,
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      return getExpenseSummary({ dateFrom: from, dateTo: to });
    },
  },
  {
    name: 'create_expense',
    scope: 'finance',
    title: 'Créer une dépense',
    description:
      'Enregistre une dépense, en UN SEUL appel même détaillée. `date` au ' +
      'format `YYYY-MM-DD`, `categoryId` issu de `list_expense_categories`, ' +
      '`paymentMethod` ∈ CASH/WAVE/BANK/OTHER (défaut CASH) ; `supplier` et ' +
      '`note` optionnels. DÉTAIL PAR ARTICLE (recommandé — il alimente les ' +
      'stats de fréquence) : fournis `items[]`, une ligne par article acheté ' +
      'avec `articleName` en texte libre (ex. « Farine T45 » — l’article est ' +
      'retrouvé, insensible à la casse, ou créé automatiquement ; pas d’étape ' +
      'préalable), et `quantity` + `unit` + `unitPrice`, OU directement ' +
      '`amount`. Aucun calcul à faire : le montant d’une ligne est dérivé de ' +
      'quantité × prix unitaire, et le montant total de la dépense (`amount`, ' +
      'optionnel avec `items`) est dérivé de la somme des lignes. Un numéro ' +
      'de reçu `receiptNo` (DEP-YYYY-MM-NNNN) est attribué automatiquement. ' +
      'Pour joindre une photo, utilise `set_expense_receipt` après création.',
    inputSchema: expenseInputSchema,
    readOnly: false,
    handler: (args) => createExpense(args),
  },
  {
    name: 'update_expense',
    scope: 'finance',
    title: 'Modifier une dépense',
    description:
      'Met à jour une dépense de façon PARTIELLE : ne fournis que les champs à ' +
      'modifier. `items` REMPLACE tout le détail existant (mêmes règles que ' +
      '`create_expense` ; `amount` omis = dérivé de la somme) ; `items: null` ' +
      'retire le détail. Modifier `amount` seul est refusé si la dépense a un ' +
      'détail (l’invariant somme des lignes == montant est garanti). Le numéro ' +
      'de reçu (`receiptNo`) est immuable et ne change jamais, même si la ' +
      '`date` est modifiée.',
    inputSchema: expenseUpdateObjectSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return updateExpense(id, rest);
    },
  },
  {
    name: 'delete_expense',
    scope: 'finance',
    title: 'Supprimer une dépense',
    description: 'Supprime définitivement une dépense. Action irréversible.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteExpense((args as { id: string }).id),
  },
  {
    name: 'set_expense_receipt',
    scope: 'finance',
    title: 'Joindre un justificatif à une dépense',
    description:
      'Associe une photo de justificatif à une dépense. Deux modes : (1) ' +
      '`imageUrl` — une URL http(s) est TÉLÉCHARGÉE côté serveur puis stockée ' +
      'localement (un chemin `/uploads/...` déjà local est conservé) ; (2) ' +
      '`imageBase64` (base64 brut ou data URI) + `mimeType`. Formats : ' +
      ALLOWED_IMAGE_MIME_TYPES.join(', ') +
      ' (converties automatiquement en WebP, redimensionnées, max 25 MB).',
    inputSchema: z
      .object({
        id: idSchema,
        imageBase64: z.string().min(1).optional(),
        mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES).optional(),
        imageUrl: imageUrlSchema.optional(),
      })
      .refine((v) => Boolean(v.imageBase64) || Boolean(v.imageUrl), {
        message: 'Fournis soit `imageBase64`, soit `imageUrl`.',
      }),
    readOnly: false,
    handler: async (args) => {
      const { id, ...image } = args as {
        id: string;
        imageBase64?: string;
        mimeType?: string;
        imageUrl?: string;
      };
      const url = await resolveStoredImageUrl(
        image,
        uploadReceiptImage,
        uploadReceiptImage
      );
      return updateExpense(id, { receiptUrl: url });
    },
  },

  // — Dépenses : articles & fréquence d'achat —
  {
    name: 'list_expense_articles',
    scope: 'finance',
    title: 'Lister les articles de dépense',
    description:
      'Renvoie le référentiel des articles de dépense (« Farine T45 », ' +
      '« Sucre », « Gaz »…) avec leur `id`, le nombre de lignes rattachées et ' +
      'l’éventuel lien inventaire. `search` filtre par nom (contains, ' +
      'insensible). Utile pour désambiguïser avant `get_expense_article_history` ' +
      'ou pour réutiliser un `articleId` exact — mais `create_expense` accepte ' +
      'directement `articleName` en texte libre.',
    inputSchema: z.object({
      search: z.string().trim().min(1).optional(),
    }),
    readOnly: true,
    handler: (args) =>
      listExpenseArticles((args as { search?: string }).search),
  },
  {
    name: 'get_expense_frequency',
    scope: 'finance',
    title: 'Fréquence d’achat par article',
    description:
      'Répond à « combien de fois a-t-on acheté X ? » : stats par article de ' +
      'dépense sur une plage de jours civils — nombre d’achats (dépenses ' +
      'distinctes), montant total, quantité cumulée et prix unitaire moyen ' +
      'pondéré (si unités homogènes), premier/dernier achat, intervalle moyen ' +
      'entre achats (jours) et cadence mensuelle. SANS `from`/`to`, la plage ' +
      'est LE MOIS EN COURS (Abidjan). `search` filtre par nom d’article ' +
      '(ex. « farine » → « Farine T45 »). Tri : montant total décroissant. ' +
      'Ne couvre que les dépenses détaillées (avec lignes d’articles).',
    inputSchema: expenseFrequencyFiltersSchema,
    readOnly: true,
    handler: (args) => {
      const f = args as { from?: string; to?: string; search?: string };
      const defaults = currentMonthRange();
      let from = parseDateOnlyToUTC(f.from) ?? defaults.from;
      let to = parseDateOnlyToUTC(f.to) ?? defaults.to;
      if (from.getTime() > to.getTime()) [from, to] = [to, from];
      return getExpenseArticleStats({ from, to, search: f.search });
    },
  },
  {
    name: 'get_expense_article_history',
    scope: 'finance',
    title: 'Historique d’achat d’un article',
    description:
      'Renvoie l’historique détaillé des achats d’un article de dépense ' +
      '(`articleId` issu de `list_expense_articles` ou ' +
      '`get_expense_frequency`) : chaque ligne avec quantité, prix unitaire, ' +
      'montant, et sa dépense (date, numéro de reçu, fournisseur, paiement, ' +
      'catégorie). `from`/`to` optionnels (toutes dates sinon). Ordre ' +
      'antichronologique.',
    inputSchema: z.object({
      articleId: idSchema,
      from: dateOnly.optional(),
      to: dateOnly.optional(),
    }),
    readOnly: true,
    handler: async (args) => {
      const a = args as { articleId: string; from?: string; to?: string };
      const history = await getExpenseArticleHistory(
        a.articleId,
        parseDateOnlyToUTC(a.from),
        parseDateOnlyToUTC(a.to)
      );
      if (!history) throw new Error('Article de dépense introuvable.');
      return history;
    },
  },
  {
    name: 'get_expense_monthly_series',
    scope: 'finance',
    title: 'Série mensuelle des dépenses',
    description:
      'Renvoie les dépenses par mois civil (`YYYY-MM`) sur une plage de ' +
      'dates, éclatées charges fixes / dépenses variables selon la nature des ' +
      'catégories. Les mois sans dépense figurent à zéro. Montants en francs ' +
      'CFA.',
    inputSchema: rangeSchema,
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      return getExpenseMonthlySeries(from, to);
    },
  },
  {
    name: 'rename_expense_article',
    scope: 'finance',
    title: 'Renommer un article de dépense',
    description:
      'Renomme un article du référentiel (ex. corriger « farine t45 » en ' +
      '« Farine T45 »). Toutes les lignes existantes suivent. Refusé si un ' +
      'autre article porte déjà ce nom (à normalisation près).',
    inputSchema: expenseArticleRenameSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string; name: string };
      return renameExpenseArticle(id, rest);
    },
  },
  {
    name: 'delete_expense_article',
    scope: 'finance',
    title: 'Supprimer un article de dépense',
    description:
      'Retire un article du référentiel (soft delete) : il disparaît de ' +
      'l’autocomplétion mais les lignes et statistiques existantes le ' +
      'conservent. Recréer un article du même nom le réactive.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteExpenseArticle((args as { id: string }).id),
  },

  // — Investissements : sources de financement —
  {
    name: 'list_investment_sources',
    scope: 'finance',
    title: 'Lister les sources de financement',
    description:
      'Renvoie les sources de financement (capital propre, prêt, apport ' +
      'd’associé, subvention…) avec leur `id` et le nombre d’apports rattachés. ' +
      'Utilise ces `id` pour `create_investment`.',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => listInvestmentSources(),
  },
  {
    name: 'create_investment_source',
    scope: 'finance',
    title: 'Créer une source de financement',
    description:
      'Crée une source de financement (ex. « Prêt bancaire », « Apport ' +
      'associé »). Le nom doit être unique.',
    inputSchema: investmentSourceInputSchema,
    readOnly: false,
    handler: (args) => createInvestmentSource(args),
  },
  {
    name: 'update_investment_source',
    scope: 'finance',
    title: 'Renommer une source de financement',
    description: 'Met à jour le nom d’une source de financement.',
    inputSchema: investmentSourceInputSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string; name: string };
      return updateInvestmentSource(id, rest);
    },
  },
  {
    name: 'delete_investment_source',
    scope: 'finance',
    title: 'Supprimer une source de financement',
    description:
      'Supprime une source de financement. Refusé si des apports y sont ' +
      'rattachés.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteInvestmentSource((args as { id: string }).id),
  },

  // — Investissements : apports —
  {
    name: 'list_investments',
    scope: 'finance',
    title: 'Lister les apports',
    description:
      'Renvoie les apports/financements filtrés par plage de dates ' +
      '(`from`/`to`, `YYYY-MM-DD`, jour civil Abidjan), `sourceId` et/ou ' +
      '`reimbursable`, avec le total investi, le total remboursé et le restant ' +
      'dû. Tous les filtres sont optionnels.',
    inputSchema: investmentFiltersSchema,
    readOnly: true,
    handler: (args) => {
      const f = args as {
        from?: string;
        to?: string;
        sourceId?: string;
        reimbursable?: boolean;
      };
      return listInvestments({
        dateFrom: parseDateOnlyToUTC(f.from),
        dateTo: parseDateOnlyToUTC(f.to),
        sourceId: f.sourceId,
        reimbursable: f.reimbursable,
      });
    },
  },
  {
    name: 'get_investment_summary',
    scope: 'finance',
    title: 'Synthèse des investissements',
    description:
      'Renvoie le total des apports, leur ventilation par source et le restant ' +
      'dû (apports remboursables) sur une plage de dates. Montants en francs CFA.',
    inputSchema: rangeSchema,
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      return getInvestmentSummary(from, to);
    },
  },
  {
    name: 'create_investment',
    scope: 'finance',
    title: 'Créer un apport',
    description:
      'Enregistre un apport / financement. `date` au format `YYYY-MM-DD`, ' +
      '`amount` en francs CFA entiers, `sourceId` issu de ' +
      '`list_investment_sources`. `paymentMethod` ∈ CASH/WAVE/BANK/OTHER ' +
      '(défaut CASH, canal d’entrée des fonds). `financier`, `note`, ' +
      '`documentUrl` sont optionnels. Pour un apport remboursable, mets ' +
      '`reimbursable` à true et renseigne éventuellement `amountRepaid` (≤ ' +
      '`amount`) et `dueDate`. Pour joindre une photo encodée, utilise ' +
      '`set_investment_document` après création.',
    inputSchema: investmentInputSchema,
    readOnly: false,
    handler: (args) => createInvestment(args),
  },
  {
    name: 'update_investment',
    scope: 'finance',
    title: 'Modifier un apport',
    description:
      'Met à jour un apport de façon PARTIELLE : ne fournis que les champs à ' +
      'modifier. Utile notamment pour enregistrer un remboursement via ' +
      '`amountRepaid`.',
    inputSchema: investmentObjectSchema.partial().extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return updateInvestment(id, rest);
    },
  },
  {
    name: 'delete_investment',
    scope: 'finance',
    title: 'Supprimer un apport',
    description: 'Supprime définitivement un apport. Action irréversible.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteInvestment((args as { id: string }).id),
  },
  {
    name: 'set_investment_document',
    scope: 'finance',
    title: 'Joindre un justificatif à un apport',
    description:
      'Associe une photo de justificatif à un apport. Deux modes : (1) ' +
      '`imageUrl` — une URL http(s) est TÉLÉCHARGÉE côté serveur puis stockée ' +
      'localement (un chemin `/uploads/...` déjà local est conservé) ; (2) ' +
      '`imageBase64` (base64 brut ou data URI) + `mimeType`. Formats : ' +
      ALLOWED_IMAGE_MIME_TYPES.join(', ') +
      ' (converties automatiquement en WebP, redimensionnées, max 25 MB).',
    inputSchema: z
      .object({
        id: idSchema,
        imageBase64: z.string().min(1).optional(),
        mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES).optional(),
        imageUrl: imageUrlSchema.optional(),
      })
      .refine((v) => Boolean(v.imageBase64) || Boolean(v.imageUrl), {
        message: 'Fournis soit `imageBase64`, soit `imageUrl`.',
      }),
    readOnly: false,
    handler: async (args) => {
      const { id, ...image } = args as {
        id: string;
        imageBase64?: string;
        mimeType?: string;
        imageUrl?: string;
      };
      const url = await resolveStoredImageUrl(
        image,
        uploadReceiptImage,
        uploadReceiptImage
      );
      return updateInvestment(id, { documentUrl: url });
    },
  },

  // — Régularisations de recette (ajustement manuel du CA) —
  {
    name: 'list_revenue_adjustments',
    scope: 'finance',
    title: 'Lister les régularisations de recette',
    description:
      'Renvoie les régularisations de recette (ajustements manuels du CA, sans ' +
      'commande) filtrées par plage de dates (`from`/`to`, `YYYY-MM-DD`) et/ou ' +
      '`paymentMode` (CASH/WAVE/OTHER), avec le total net. Montants signés ' +
      '(positif = recette ajoutée, négatif = retirée). Tous les filtres sont ' +
      'optionnels.',
    inputSchema: revenueAdjustmentFiltersSchema,
    readOnly: true,
    handler: (args) => {
      const f = args as {
        from?: string;
        to?: string;
        paymentMode?: 'CASH' | 'WAVE' | 'OTHER';
      };
      return listRevenueAdjustments({
        dateFrom: parseDateOnlyToUTC(f.from),
        dateTo: parseDateOnlyToUTC(f.to),
        paymentMode: f.paymentMode,
      });
    },
  },
  {
    name: 'get_revenue_adjustment_summary',
    scope: 'finance',
    title: 'Synthèse des régularisations de recette',
    description:
      'Renvoie le total net des régularisations de recette et leur ventilation ' +
      'par mode de paiement sur une plage de dates. Montants en francs CFA.',
    inputSchema: rangeSchema,
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      return getRevenueAdjustmentSummary(from, to);
    },
  },
  {
    name: 'create_revenue_adjustment',
    scope: 'finance',
    title: 'Créer une régularisation de recette',
    description:
      'Enregistre un ajustement manuel du CA SANS créer de commande (ventes non ' +
      'saisies en temps réel, anciennes commandes perdues…). `date` au format ' +
      '`YYYY-MM-DD`, `amount` en francs CFA entiers SIGNÉS (positif = ajout au ' +
      'CA, négatif = retrait), `paymentMode` ∈ CASH/WAVE/OTHER (défaut CASH ; le ' +
      'mode CASH alimente la clôture de caisse). `note` (motif) optionnelle. ' +
      'L’ajustement remonte dans les statistiques et la clôture de caisse.',
    inputSchema: revenueAdjustmentInputSchema,
    readOnly: false,
    handler: (args) => createRevenueAdjustment(args),
  },
  {
    name: 'update_revenue_adjustment',
    scope: 'finance',
    title: 'Modifier une régularisation de recette',
    description:
      'Met à jour une régularisation de recette de façon PARTIELLE : ne fournis ' +
      'que les champs à modifier.',
    inputSchema: revenueAdjustmentObjectSchema
      .partial()
      .extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return updateRevenueAdjustment(id, rest);
    },
  },
  {
    name: 'delete_revenue_adjustment',
    scope: 'finance',
    title: 'Supprimer une régularisation de recette',
    description:
      'Supprime définitivement une régularisation de recette. Action irréversible.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteRevenueAdjustment((args as { id: string }).id),
  },

  // — Clôture de caisse (espèces, journalière) —
  {
    name: 'get_cash_position',
    scope: 'finance',
    title: 'Position de caisse (espèces) d’un jour',
    description:
      'Pour un jour (`date`, `YYYY-MM-DD`), renvoie les chiffres liquides ' +
      '(ventes espèces, dépenses espèces, ventes Wave/Autre, CA total) et la ' +
      'clôture déjà enregistrée s’il y en a une. Sert à préparer une clôture.',
    inputSchema: z.object({ date: dateOnly }),
    readOnly: true,
    handler: async (args) => {
      const date = parseDateOnlyToUTC((args as { date: string }).date)!;
      const [figures, closing] = await Promise.all([
        getCashFigures(date),
        getCashClosing(date),
      ]);
      return { figures, closing };
    },
  },
  {
    name: 'get_cash_closing',
    scope: 'finance',
    title: 'Lire une clôture de caisse',
    description:
      'Renvoie la clôture enregistrée pour un jour (`date`, `YYYY-MM-DD`), ou ' +
      'null si la caisse n’a pas encore été clôturée ce jour-là.',
    inputSchema: z.object({ date: dateOnly }),
    readOnly: true,
    handler: (args) => {
      const date = parseDateOnlyToUTC((args as { date: string }).date)!;
      return getCashClosing(date);
    },
  },
  {
    name: 'list_cash_closings',
    scope: 'finance',
    title: 'Lister les clôtures de caisse',
    description:
      'Renvoie l’historique des clôtures de caisse sur une plage de dates ' +
      '(`from`/`to`, `YYYY-MM-DD`).',
    inputSchema: rangeSchema,
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      return listCashClosings(from, to);
    },
  },
  {
    name: 'save_cash_closing',
    scope: 'finance',
    title: 'Enregistrer une clôture de caisse',
    description:
      'Crée ou met à jour la clôture d’un jour (une par jour). Fournis `date` ' +
      '(`YYYY-MM-DD`), `openingFloat` (fond de caisse) et `countedCash` ' +
      '(espèces comptées), en francs CFA. La caisse théorique et l’écart sont ' +
      'recalculés automatiquement (fond + ventes espèces − dépenses espèces).',
    inputSchema: cashClosingInputSchema,
    readOnly: false,
    handler: (args) => saveCashClosing(args),
  },

  // — Commandes (écriture) —
  {
    name: 'create_order',
    title: 'Enregistrer une commande',
    description:
      'Enregistre une commande (utile pour saisir des commandes anciennes). ' +
      '`orderDate` (`YYYY-MM-DD`, jour civil Abidjan) ANTIDATE la commande ; ' +
      'omis = jour en cours. `items` référence les produits par `productId` ' +
      '(issu de `get_menu`) avec une `quantity` ; les prix, coûts et prix des ' +
      'suppléments sont résolus depuis le menu — ne les fournis pas. Les ' +
      'suppléments se désignent par `groupName` + `optionName`, avec une ' +
      '`quantity` optionnelle (défaut 1) pour les groupes type « quantity » ' +
      '(répartition, ex. 2x un goût). Le total est ' +
      'calculé côté serveur (net après remises). `orderType` ∈ ' +
      'DELIVERY/DINE_IN/TAKEAWAY (défaut TAKEAWAY). `customerName`, ' +
      '`customerPhone` (normalisé, rattache la fidélité) et `note` sont ' +
      'optionnels. Renvoie l’`id`, la `reference` et le `dailyNumber`.',
    inputSchema: z.object({
      orderDate: dateOnly
        .nullable()
        .optional()
        .describe('Jour civil d’antidatage (YYYY-MM-DD). Omis = aujourd’hui.'),
      items: z
        .array(
          z.object({
            productId: idSchema.describe('`id` produit (cf. `get_menu`).'),
            quantity: z.number().int().positive(),
            supplements: z
              .array(
                z.object({
                  groupName: z.string().min(1),
                  optionName: z.string().min(1),
                  quantity: z
                    .number()
                    .int()
                    .positive()
                    .optional()
                    .describe(
                      'Nombre de fois choisi (groupe type "quantity"). Défaut 1.'
                    ),
                })
              )
              .optional()
              .describe('Suppléments choisis (groupe + option, par nom).'),
            discount: z
              .number()
              .int()
              .nonnegative()
              .optional()
              .describe('Remise ligne (montant fixe FCFA), plafonnée.'),
            discountReason: z.string().max(120).nullable().optional(),
          })
        )
        .min(1, 'Au moins 1 article'),
      orderType: orderTypeSchema.optional(),
      customerName: z.string().trim().max(50).nullable().optional(),
      customerPhone: z.string().trim().max(30).nullable().optional(),
      note: z.string().trim().max(500).nullable().optional(),
    }),
    readOnly: false,
    handler: async (args) => {
      const a = args as {
        orderDate?: string | null;
        items: OrderItemRef[];
        orderType?: 'DELIVERY' | 'DINE_IN' | 'TAKEAWAY';
        customerName?: string | null;
        customerPhone?: string | null;
        note?: string | null;
      };
      const items = await buildOrderItemsFromMenu(a.items);
      const order = await createCashierOrder({
        items,
        orderType: a.orderType ?? 'TAKEAWAY',
        orderDate: a.orderDate ?? null,
        customerName: a.customerName ?? null,
        customerPhone: a.customerPhone ?? null,
        note: a.note ?? null,
      });
      return {
        id: order.id,
        reference: order.reference,
        dailyDate: order.dailyDate,
        dailyNumber: order.dailyNumber,
        total: order.total,
      };
    },
  },
  {
    name: 'list_orders',
    title: 'Lister les commandes',
    description:
      'Renvoie les commandes (les plus récentes d’abord) avec leur `id`, ' +
      '`dailyNumber`, `reference`, statut, état de paiement, total et client. ' +
      'Filtres optionnels : `status` (NEW/PREPARING/READY/COMPLETED/CANCELLED), ' +
      'plage de jours `from`/`to` (`YYYY-MM-DD`, jour civil Abidjan), `search` ' +
      '(référence, nom ou téléphone), `page` (20 par page). Utilise l’`id` ' +
      'renvoyé pour `set_order_status` / `mark_order_paid`.',
    inputSchema: z.object({
      status: orderStatusSchema.optional(),
      from: dateOnly.optional().describe('Jour de début (inclus), YYYY-MM-DD.'),
      to: dateOnly.optional().describe('Jour de fin (inclus), YYYY-MM-DD.'),
      search: z.string().optional(),
      page: z.number().int().positive().optional(),
    }),
    readOnly: true,
    handler: (args) => {
      const a = args as {
        status?: z.infer<typeof orderStatusSchema>;
        from?: string;
        to?: string;
        search?: string;
        page?: number;
      };
      return listOrders({
        page: a.page ?? 1,
        status: a.status,
        dateFrom: parseDateOnlyToUTC(a.from),
        dateTo: parseDateOnlyToUTC(a.to),
        search: a.search,
      });
    },
  },
  {
    name: 'set_order_status',
    title: 'Changer le statut d’une commande',
    description:
      'Fait passer une commande à un nouveau `status` ' +
      '(NEW → PREPARING → READY → COMPLETED, ou CANCELLED). « Récupérée » = ' +
      'COMPLETED. Les transitions invalides sont refusées. `id` provient de ' +
      '`list_orders`.',
    inputSchema: z.object({
      id: idSchema,
      status: orderStatusSchema,
    }),
    readOnly: false,
    handler: async (args) => {
      const { id, status } = args as {
        id: string;
        status: z.infer<typeof orderStatusSchema>;
      };
      // Le serveur MCP agit avec les pleins droits (jeton d’administration).
      await setOrderStatus(id, status, 'ADMIN');
      return { ok: true, id, status };
    },
  },
  {
    name: 'mark_order_paid',
    title: 'Encaisser une commande',
    description:
      'Marque une commande comme payée avec un `paymentMode` ∈ ' +
      'CASH/WAVE/OTHER. Encaisser une commande encore NEW la pousse aussi en ' +
      'cuisine (passe en PREPARING). `id` provient de `list_orders`.',
    inputSchema: z.object({
      id: idSchema,
      paymentMode: paymentModeSchema,
    }),
    readOnly: false,
    handler: async (args) => {
      const { id, paymentMode } = args as {
        id: string;
        paymentMode: z.infer<typeof paymentModeSchema>;
      };
      const { startedPreparation } = await setOrderPayment(
        id,
        true,
        paymentMode
      );
      return { ok: true, id, paymentMode, startedPreparation };
    },
  },
  {
    name: 'update_order',
    title: 'Modifier les détails d’une commande',
    description:
      'Met à jour de façon PARTIELLE les métadonnées d’une commande existante : ' +
      '`orderType` (DELIVERY/DINE_IN/TAKEAWAY), `pickupTime` (créneau de retrait, ' +
      'datetime ISO 8601 ou null pour walk-in), `paymentMode` (CASH/WAVE/OTHER, ou ' +
      'null si non payée) et `note`. Ne modifie ni le statut ni l’état de paiement ' +
      '(utilise `set_order_status` / `mark_order_paid`). On ne peut pas retirer le ' +
      'mode de paiement d’une commande déjà payée. `id` provient de `list_orders`.',
    inputSchema: z.object({
      id: idSchema,
      orderType: orderTypeSchema.optional(),
      pickupTime: z
        .string()
        .datetime({ message: 'Date de retrait invalide' })
        .nullable()
        .optional()
        .describe('Créneau de retrait (ISO 8601) ou null pour walk-in.'),
      paymentMode: paymentModeSchema.nullable().optional(),
      note: z.string().max(500).nullable().optional(),
    }),
    readOnly: false,
    handler: async (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      await updateOrderDetails(id, rest);
      return { ok: true, id };
    },
  },
  {
    name: 'apply_order_discount',
    title: 'Appliquer une remise à une commande',
    description:
      'Applique une remise (montant fixe FCFA) à une ou plusieurs lignes d’une ' +
      'commande existante. Chaque ligne est ciblée par son `cartId` (visible ' +
      'dans les `items` renvoyés par `list_orders`). `discount` est le montant ' +
      'retiré de la ligne (0 pour annuler une remise), plafonné à un pourcentage ' +
      'du montant de la ligne ; `reason` est un motif optionnel. Les lignes non ' +
      'citées sont inchangées. Le total de la commande est recalculé. Refusé sur ' +
      'une commande terminée ou annulée.',
    inputSchema: z.object({
      id: idSchema,
      lines: z
        .array(
          z.object({
            cartId: z
              .string()
              .min(1)
              .describe('Identifiant de ligne (cf. `items` de `list_orders`).'),
            discount: z
              .number()
              .int()
              .nonnegative()
              .describe('Montant de remise en FCFA (0 = retirer la remise).'),
            reason: z.string().max(120).nullable().optional(),
          })
        )
        .min(1, 'Au moins une ligne'),
    }),
    readOnly: false,
    handler: async (args) => {
      const { id, lines } = args as {
        id: string;
        lines: { cartId: string; discount: number; reason?: string | null }[];
      };

      const order = await getOrder(id);
      if (!order) {
        throw new OrderMutationError('Commande introuvable', 404);
      }

      const items = order.items as CartItem[];
      const byCartId = new Map(lines.map((l) => [l.cartId, l]));

      // Toutes les lignes ciblées doivent exister dans la commande.
      for (const l of lines) {
        if (!items.some((it) => it.cartId === l.cartId)) {
          throw new OrderMutationError(
            `Ligne introuvable dans la commande : ${l.cartId}`,
            400
          );
        }
      }

      const updated = items.map((it) => {
        const l = byCartId.get(it.cartId);
        if (!l) return it;
        return {
          ...it,
          discount: l.discount,
          discountReason: l.reason ?? null,
        };
      });

      const { total } = await updateOrderItems(id, updated);
      return { ok: true, id, total };
    },
  },

  // — Clients (CRM, lecture seule) —
  {
    name: 'list_customers',
    title: 'Lister / rechercher des clients',
    description:
      'Renvoie les clients (identifiés par téléphone) avec leurs stats ' +
      '(nb de commandes, total dépensé, dernière commande). `search` filtre ' +
      'par nom ou téléphone ; `page` pagine (20 par page).',
    inputSchema: z.object({
      search: z.string().optional(),
      page: z.number().int().positive().optional(),
    }),
    readOnly: true,
    handler: (args) => {
      const { search, page } = args as { search?: string; page?: number };
      return listCustomers({ search, page });
    },
  },
  {
    name: 'get_customer',
    title: 'Détail d’un client',
    description:
      'Renvoie un client avec ses stats et ses commandes récentes. Fournis ' +
      'soit `id`, soit `phone` (numéro saisi librement, normalisé ' +
      'automatiquement). Renvoie null si introuvable.',
    inputSchema: z
      .object({
        id: z.string().min(1).optional(),
        phone: z.string().min(1).optional(),
      })
      .refine((v) => Boolean(v.id) || Boolean(v.phone), {
        message: 'Fournis `id` ou `phone`.',
      }),
    readOnly: true,
    handler: async (args) => {
      const { id, phone } = args as { id?: string; phone?: string };
      if (id) return getCustomer(id);
      const found = await getCustomerByPhone(phone!);
      return found ? getCustomer(found.id) : null;
    },
  },

  // — Fidélité (carte à tampons) —
  {
    name: 'get_loyalty_card',
    title: 'Carte de fidélité d’un client',
    description:
      'Renvoie l’avancement de la carte à tampons d’un client et ses ' +
      'récompenses disponibles. Fournis `id` ou `phone` (normalisé ' +
      'automatiquement). Null si introuvable.',
    inputSchema: z
      .object({
        id: z.string().min(1).optional(),
        phone: z.string().min(1).optional(),
      })
      .refine((v) => Boolean(v.id) || Boolean(v.phone), {
        message: 'Fournis `id` ou `phone`.',
      }),
    readOnly: true,
    handler: (args) => {
      const { id, phone } = args as { id?: string; phone?: string };
      return id ? getLoyaltyCard(id) : getLoyaltyCardByPhone(phone!);
    },
  },
  {
    name: 'adjust_loyalty_stamps',
    title: 'Ajuster les tampons d’un client',
    description:
      'Ajuste manuellement le compteur de tampons (correction). `delta` peut ' +
      'être négatif (le compteur ne descend pas sous 0). Tracé au journal de ' +
      'fidélité. Fournis `id` ou `phone`.',
    inputSchema: z
      .object({
        id: z.string().min(1).optional(),
        phone: z.string().min(1).optional(),
        delta: z
          .number()
          .int()
          .refine((n) => n !== 0, 'delta non nul requis'),
        note: z.string().max(200).optional(),
      })
      .refine((v) => Boolean(v.id) || Boolean(v.phone), {
        message: 'Fournis `id` ou `phone`.',
      }),
    readOnly: false,
    handler: async (args) => {
      const { id, phone, delta, note } = args as {
        id?: string;
        phone?: string;
        delta: number;
        note?: string;
      };
      let customerId = id;
      if (!customerId) {
        const c = await getCustomerByPhone(phone!);
        if (!c) throw new Error('Client introuvable');
        customerId = c.id;
      }
      const stampCount = await adjustStamps(customerId, delta, note);
      return { customerId, stampCount };
    },
  },
  {
    name: 'get_loyalty_settings',
    title: 'Lire les réglages de fidélité',
    description:
      'Renvoie la configuration de la carte à tampons (programme actif, montant ' +
      'min, taille de carte, paliers, plafonds, règle 1/jour).',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => getLoyaltySettings(),
  },
  {
    name: 'update_loyalty_settings',
    title: 'Modifier les réglages de fidélité',
    description:
      'Met à jour la configuration de la carte à tampons. Le palier ' +
      'intermédiaire (`tier1Stamps`) doit être inférieur à la taille de la ' +
      'carte (`stampsPerCard`). Montants en francs CFA.',
    inputSchema: loyaltySettingsSchema,
    readOnly: false,
    handler: async (args) => {
      await updateLoyaltySettings(args as LoyaltySettings);
      return getLoyaltySettings();
    },
  },

  // — Catégories —
  {
    name: 'create_category',
    title: 'Créer une catégorie',
    description:
      'Crée une nouvelle catégorie de menu. Le slug et l’ordre sont générés ' +
      'automatiquement.',
    inputSchema: createCategorySchema,
    readOnly: false,
    handler: (args) => createCategory(args as { name: string }),
  },
  {
    name: 'update_category',
    title: 'Renommer une catégorie',
    description: 'Met à jour le nom d’une catégorie existante.',
    inputSchema: updateCategorySchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string; name: string };
      return updateCategory(id, rest);
    },
  },
  {
    name: 'delete_category',
    title: 'Supprimer une catégorie',
    description:
      'Supprime une catégorie et, en cascade, tous ses produits. Soft delete : ' +
      'la catégorie et ses produits sont masqués partout mais conservés en base ' +
      '(et n’apparaissent plus dans `get_menu`). Recréer une catégorie du même ' +
      'nom repart d’une catégorie neuve.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteCategory((args as { id: string }).id),
  },
  {
    name: 'toggle_category_availability',
    title: 'Afficher/masquer une catégorie',
    description:
      'Inverse la visibilité d’une catégorie sur le site public (visible ↔ ' +
      'masquée).',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => toggleCategoryAvailability((args as { id: string }).id),
  },
  {
    name: 'move_category',
    title: 'Réordonner une catégorie',
    description:
      'Déplace une catégorie d’un cran vers le haut ou vers le bas dans ' +
      'l’ordre d’affichage.',
    inputSchema: z.object({
      id: idSchema,
      direction: z.enum(['up', 'down']),
    }),
    readOnly: false,
    handler: (args) => {
      const { id, direction } = args as {
        id: string;
        direction: 'up' | 'down';
      };
      return moveCategory(id, direction);
    },
  },

  // — Produits —
  {
    name: 'create_product',
    title: 'Créer un produit',
    description:
      'Crée un produit dans une catégorie (via `categoryId`). Les prix et coûts ' +
      '(`coutMatiere`, `coutEmballage`) sont en francs CFA entiers. ' +
      '`supplementGroups` peut être un tableau vide. Chaque groupe a un `type` ' +
      '∈ single (un choix) / multiple (cases à cocher) / quantity (répartition ' +
      'd’une quantité entre options, ex. 3 parts sur 3 goûts), et peut poser ' +
      '`minSelect`/`maxSelect` (bornes sur le nombre d’options cochées ou la ' +
      'quantité totale répartie ; égaux = quantité exacte). Chaque groupe et ' +
      'chaque option (« goût ») accepte un drapeau `available` (défaut true) : ' +
      'passé à false, l’élément reste configuré mais n’est plus proposé côté ' +
      'client. ' +
      '`imageUrl` accepte un ' +
      'chemin local (`/uploads/products/...`, obtenu via `set_product_image`) ou ' +
      'une URL http(s) ; pour téléverser un fichier, utilise plutôt ' +
      '`set_product_image`.',
    inputSchema: productInputSchema,
    readOnly: false,
    handler: (args) =>
      createProduct(args as z.infer<typeof productInputSchema>),
  },
  {
    name: 'update_product',
    title: 'Modifier un produit',
    description:
      'Met à jour un produit existant de façon PARTIELLE : ne fournis que les ' +
      'champs à modifier, les autres restent inchangés. `categoryId` permet de ' +
      'déplacer le produit vers une autre catégorie. ⚠️ Si tu fournis ' +
      '`supplementGroups`, la liste entière est remplacée par celle fournie ' +
      '(omets-la pour conserver les suppléments existants).',
    inputSchema: productUpdateSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & z.infer<
        typeof productUpdateSchema
      >;
      return updateProduct(id, rest);
    },
  },
  {
    name: 'set_product_image',
    title: 'Définir l’image d’un produit',
    description:
      'Associe une image à un produit. Deux modes : (1) `imageUrl` — une URL ' +
      'http(s) publique est TÉLÉCHARGÉE côté serveur puis stockée localement ' +
      '(un chemin `/uploads/...` déjà local est conservé tel quel) ; c’est le ' +
      'moyen le plus simple depuis un chat. (2) `imageBase64` (contenu encodé ' +
      'en base64, ou data URI) + `mimeType` — utile quand on dispose des octets. ' +
      'Renvoie le produit mis à jour avec son `imageUrl`. Formats acceptés : ' +
      ALLOWED_IMAGE_MIME_TYPES.join(', ') +
      ' (converties automatiquement en WebP, redimensionnées, max 25 MB).',
    inputSchema: z
      .object({
        id: idSchema,
        imageBase64: z
          .string()
          .min(1)
          .optional()
          .describe('Image encodée en base64 (brut) ou data URI.'),
        mimeType: z
          .enum(ALLOWED_IMAGE_MIME_TYPES)
          .optional()
          .describe('Type MIME requis avec imageBase64 (sauf data URI).'),
        imageUrl: imageUrlSchema
          .optional()
          .describe('Alternative : URL/chemin d’une image déjà hébergée.'),
      })
      .refine((v) => Boolean(v.imageBase64) || Boolean(v.imageUrl), {
        message: 'Fournis soit `imageBase64`, soit `imageUrl`.',
      }),
    readOnly: false,
    handler: async (args) => {
      const { id, ...image } = args as {
        id: string;
        imageBase64?: string;
        mimeType?: string;
        imageUrl?: string;
      };
      const url = await resolveStoredImageUrl(
        image,
        uploadProductImage,
        uploadProductImage
      );
      return updateProduct(id, { imageUrl: url });
    },
  },
  {
    name: 'move_product',
    title: 'Réordonner un produit',
    description:
      'Déplace un produit d’un cran vers le haut ou vers le bas dans l’ordre ' +
      'd’affichage, au sein de sa catégorie.',
    inputSchema: z.object({
      id: idSchema,
      direction: z.enum(['up', 'down']),
    }),
    readOnly: false,
    handler: (args) => {
      const { id, direction } = args as {
        id: string;
        direction: 'up' | 'down';
      };
      return moveProduct(id, direction);
    },
  },
  {
    name: 'delete_product',
    title: 'Supprimer un produit',
    description:
      'Supprime un produit. Soft delete : le produit est masqué partout (et ' +
      'retiré de `get_menu`) mais conservé en base.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteProduct((args as { id: string }).id),
  },
  {
    name: 'toggle_product_availability',
    title: 'Afficher/masquer un produit',
    description:
      'Inverse la disponibilité d’un produit sur le site public (disponible ↔ ' +
      'indisponible).',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => toggleProductAvailability((args as { id: string }).id),
  },
  {
    name: 'toggle_product_featured',
    title: 'Mettre en avant / retirer un produit',
    description: 'Inverse le statut « mis en avant » d’un produit.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => toggleProductFeatured((args as { id: string }).id),
  },

  // — Stock & pause (produits/options) —
  //
  // Trois mécanismes distincts : stock illimité (défaut, `stockQuantity: null`),
  // stock suivi (produit ET option, décrémenté au PAIEMENT — pas à la création
  // de la commande — pour ne jamais survendre), et pause programmée (le produit
  // reste visible sur la carte avec un tag « Indisponible — retour {heure} »,
  // mais n’est pas commandable ; reprise automatique à `until`, sans action
  // manuelle). `set_*_stock` pose une valeur ABSOLUE (geste du matin) ;
  // `restock_*` AJOUTE un delta (nouvelle fournée en journée).
  {
    name: 'set_product_stock',
    title: 'Définir le stock d’un produit (absolu)',
    description:
      'Définit la quantité vendable ACTUELLE d’un produit (« définir le matin »). ' +
      '`quantity` = nombre entier ≥ 0 (quantité restante suivie, `0` = épuisé), ' +
      'ou `null`/absent pour repasser le produit en stock illimité (comportement ' +
      'par défaut, aucun suivi). Le stock est DÉCRÉMENTÉ AU PAIEMENT (validé par ' +
      'le staff), jamais à la simple création d’une commande — une commande non ' +
      'payée ne réserve rien. `id` provient de `get_menu`. Pour ajouter une ' +
      'nouvelle fournée sans écraser la valeur courante, utilise plutôt ' +
      '`restock_product`.',
    inputSchema: z.object({
      id: idSchema,
      quantity: z
        .number()
        .int()
        .nonnegative()
        .nullable()
        .optional()
        .describe('Quantité restante, ou null/absent pour illimité.'),
    }),
    readOnly: false,
    handler: (args) => {
      const { id, quantity } = args as { id: string; quantity?: number | null };
      return setProductStock(id, quantity ?? null);
    },
  },
  {
    name: 'set_option_stock',
    title: 'Définir le stock d’une option (absolu)',
    description:
      'Définit la quantité vendable ACTUELLE d’une option de supplément (un ' +
      '« goût »). Mêmes règles que `set_product_stock` : `quantity` entier ≥ 0, ' +
      'ou `null`/absent pour repasser l’option en stock illimité. Décrémenté au ' +
      'PAIEMENT (pas à la création). `id` (id d’option, pas de produit) provient ' +
      'de `get_menu` — attention, les noms d’option peuvent être dupliqués entre ' +
      'produits, cible toujours par `id`.',
    inputSchema: z.object({
      id: idSchema,
      quantity: z
        .number()
        .int()
        .nonnegative()
        .nullable()
        .optional()
        .describe('Quantité restante, ou null/absent pour illimité.'),
    }),
    readOnly: false,
    handler: (args) => {
      const { id, quantity } = args as { id: string; quantity?: number | null };
      return setOptionStock(id, quantity ?? null);
    },
  },
  {
    name: 'restock_product',
    title: 'Réapprovisionner un produit (+ fournée)',
    description:
      'AJOUTE `delta` au stock courant d’un produit (nouvelle fournée en cours ' +
      'de journée), sans écraser la valeur — au contraire de ' +
      '`set_product_stock`. `delta` peut être négatif pour corriger une saisie. ' +
      'Refusé si le produit est actuellement en stock illimité (pose d’abord ' +
      'une valeur via `set_product_stock`). `id` provient de `get_menu`.',
    inputSchema: z.object({
      id: idSchema,
      delta: z
        .number()
        .int()
        .describe('Quantité à ajouter (négatif = retirer).'),
    }),
    readOnly: false,
    handler: (args) => {
      const { id, delta } = args as { id: string; delta: number };
      return restockProduct(id, delta);
    },
  },
  {
    name: 'restock_option',
    title: 'Réapprovisionner une option (+ fournée)',
    description:
      'Équivalent de `restock_product` pour une option de supplément : AJOUTE ' +
      '`delta` au stock courant de l’option. `id` (id d’option) provient de ' +
      '`get_menu`.',
    inputSchema: z.object({
      id: idSchema,
      delta: z
        .number()
        .int()
        .describe('Quantité à ajouter (négatif = retirer).'),
    }),
    readOnly: false,
    handler: (args) => {
      const { id, delta } = args as { id: string; delta: number };
      return restockOption(id, delta);
    },
  },
  {
    name: 'pause_product',
    title: 'Mettre un produit en pause',
    description:
      'Met un produit en pause jusqu’à `until` (datetime ISO 8601) : il reste ' +
      'VISIBLE sur la carte publique avec un tag « Indisponible — retour ' +
      '{heure} », mais devient non commandable. La reprise est AUTOMATIQUE à ' +
      '`until` (calculée à la lecture, sans intervention) ; utilise ' +
      '`resume_product` pour lever la pause manuellement avant son terme. ' +
      'Différent de `toggle_product_availability`, qui masque complètement le ' +
      'produit. `id` provient de `get_menu`.',
    inputSchema: z.object({
      id: idSchema,
      until: z
        .string()
        .datetime({ message: 'Date de reprise invalide' })
        .describe('Datetime ISO 8601 de reprise automatique.'),
    }),
    readOnly: false,
    handler: (args) => {
      const { id, until } = args as { id: string; until: string };
      return pauseProduct(id, new Date(until));
    },
  },
  {
    name: 'resume_product',
    title: 'Lever la pause d’un produit',
    description:
      'Lève manuellement la pause d’un produit avant son terme naturel (efface ' +
      '`unavailableUntil`) : redevient immédiatement commandable. `id` provient ' +
      'de `get_menu`.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => resumeProduct((args as { id: string }).id),
  },

  // — Inventaire (matières premières & consommables) —
  {
    name: 'list_inventory_items',
    title: 'Lister les références d’inventaire',
    description:
      'Renvoie les références d’inventaire (matières premières et consommables) ' +
      'avec leur `id`, `sku`, unité, stock courant, PMP (prix moyen pondéré), ' +
      'valeur de stock et seuils. Filtres optionnels : `search` (nom ou SKU), ' +
      '`category`, `lowStockOnly` (uniquement les références sous le seuil) et ' +
      '`active` (true = actives, false = archivées). Utilise les `id` renvoyés ' +
      'pour cibler les autres outils d’inventaire.',
    inputSchema: inventoryFiltersSchema,
    readOnly: true,
    handler: (args) => listInventoryItems(args as never),
  },
  {
    name: 'get_inventory_item',
    title: 'Détail d’une référence d’inventaire',
    description:
      'Renvoie une référence d’inventaire avec ses achats récents et les lignes ' +
      'de comptage associées. Renvoie null si introuvable.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: true,
    handler: (args) => getInventoryItem((args as { id: string }).id),
  },
  {
    name: 'get_inventory_summary',
    title: 'Synthèse de l’inventaire',
    description:
      'Renvoie les KPIs de l’inventaire : nombre de références actives, références ' +
      'sous le seuil, valeur totale du stock (PMP) et références jamais comptées. ' +
      'Montants en francs CFA.',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => getInventorySummary(),
  },
  {
    name: 'list_low_stock_items',
    title: 'Références sous le seuil',
    description:
      'Renvoie les références d’inventaire dont le stock courant est inférieur ou ' +
      'égal au seuil (seuil de réappro ou stock de sécurité). À réapprovisionner.',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => listLowStockItems(),
  },
  {
    name: 'list_inventory_purchases',
    title: 'Lister les achats d’inventaire',
    description:
      'Renvoie les achats/réapprovisionnements d’inventaire (entrées de stock) ' +
      'filtrés par plage de dates (`from`/`to`, `YYYY-MM-DD`, jour civil Abidjan) ' +
      'et/ou `itemId`, avec le total. Tous les filtres sont optionnels. ' +
      'Quantités décimales, montants en francs CFA.',
    inputSchema: z.object({
      from: dateOnly.optional().describe('Jour de début (inclus), YYYY-MM-DD.'),
      to: dateOnly.optional().describe('Jour de fin (inclus), YYYY-MM-DD.'),
      itemId: idSchema.optional().describe('Référence ciblée (cf. liste).'),
    }),
    readOnly: true,
    handler: (args) => {
      const f = args as { from?: string; to?: string; itemId?: string };
      return listInventoryPurchases({
        dateFrom: parseDateOnlyToUTC(f.from),
        dateTo: parseDateOnlyToUTC(f.to),
        itemId: f.itemId,
      });
    },
  },
  {
    name: 'list_inventory_counts',
    title: 'Lister les comptages d’inventaire',
    description:
      'Renvoie l’historique des comptages périodiques d’inventaire (inventaires ' +
      'physiques), les plus récents d’abord.',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => listInventoryCounts(),
  },
  {
    name: 'get_inventory_count',
    title: 'Détail d’un comptage d’inventaire',
    description:
      'Renvoie le rapport d’un comptage périodique pour la période concernée : par ' +
      'référence, stock initial, entrées (achats), stock final compté, sorties ' +
      '(consommation déduite) et valorisation au PMP. Renvoie null si introuvable.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: true,
    handler: (args) => getInventoryCount((args as { id: string }).id),
  },
  {
    name: 'create_inventory_item',
    title: 'Créer une référence d’inventaire',
    description:
      'Crée une référence d’inventaire (matière première ou consommable). Le ' +
      '`sku` est GÉNÉRÉ par le système (ne pas le fournir). `name` est le ' +
      'libellé. `unit` ∈ UNIT/KG/G/L/ML/BOX (défaut ' +
      'UNIT). `safetyStock` (stock de sécurité) et `reorderPoint` (seuil de ' +
      'réappro) sont optionnels. `category`, `supplier`, `notes` optionnels. Pour ' +
      'un stock d’ouverture, renseigne `initialQuantity` et `initialUnitCost` (en ' +
      'francs CFA) — un comptage initial est créé et initialise le PMP. ' +
      'Quantités décimales.',
    inputSchema: inventoryItemInputSchema,
    readOnly: false,
    handler: (args) => createInventoryItem(args),
  },
  {
    name: 'update_inventory_item',
    title: 'Modifier une référence d’inventaire',
    description:
      'Met à jour une référence d’inventaire de façon PARTIELLE : ne fournis que ' +
      'les champs à modifier (nom, unité, catégorie, seuils, fournisseur, notes, ' +
      'statut actif). Le stock courant et le PMP ne se modifient pas ici — passe ' +
      'par un achat (`record_inventory_purchases`) ou un comptage ' +
      '(`record_inventory_count`).',
    inputSchema: inventoryItemUpdateSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return updateInventoryItem(id, rest);
    },
  },
  {
    name: 'archive_inventory_item',
    title: 'Archiver une référence d’inventaire',
    description:
      'Archive une référence d’inventaire (suppression douce : la référence est ' +
      'masquée mais son historique est conservé).',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => archiveInventoryItem((args as { id: string }).id),
  },
  {
    name: 'record_inventory_purchases',
    title: 'Enregistrer un réapprovisionnement',
    description:
      'Enregistre un réapprovisionnement par lot (entrées de stock). `date` au ' +
      'format `YYYY-MM-DD`. `lines` liste les références (`itemId`) avec une ' +
      '`quantity` (décimale) et un `unitCost` (coût unitaire en francs CFA) ; le ' +
      'stock et le PMP de chaque référence sont mis à jour. `supplier` optionnel. ' +
      'Si `createExpense` est true, une dépense liée du montant total est créée ' +
      '(fournis alors `expenseCategoryId`), détaillée automatiquement par ' +
      'article (une ligne par achat — elle alimente `get_expense_frequency`). ' +
      'Renvoie le lot créé.',
    inputSchema: batchRestockSchema,
    readOnly: false,
    handler: (args) => batchRestock(args),
  },
  {
    name: 'cancel_restock_batch',
    title: 'Annuler un lot de réapprovisionnement',
    description:
      'Annule un lot de réapprovisionnement entier : restaure le stock et le PMP ' +
      'antérieurs de chaque référence et supprime la dépense liée éventuelle. ' +
      'Refusé si un comptage postérieur au lot existe. `batchId` provient de ' +
      'l’historique des achats/lots.',
    inputSchema: z.object({ batchId: idSchema }),
    readOnly: false,
    handler: (args) =>
      cancelRestockBatch((args as { batchId: string }).batchId),
  },
  {
    name: 'record_inventory_count',
    title: 'Enregistrer un comptage d’inventaire',
    description:
      'Enregistre un comptage périodique (inventaire physique). `date` au format ' +
      '`YYYY-MM-DD`, `label` optionnel. `lines` liste les références (`itemId`) ' +
      'avec la quantité réellement comptée (décimale). La consommation de la ' +
      'période est déduite automatiquement (stock initial + achats − stock final) ' +
      'et le stock courant est aligné sur le compté.',
    inputSchema: batchCountSchema,
    readOnly: false,
    handler: (args) => recordInventoryCount(args),
  },
  {
    name: 'get_inventory_settings',
    title: 'Lire les réglages d’inventaire',
    description:
      'Renvoie la configuration du module d’inventaire (rappel de comptage ' +
      'périodique, fréquence, etc.).',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => getInventorySettings(),
  },
  {
    name: 'update_inventory_settings',
    title: 'Modifier les réglages d’inventaire',
    description:
      'Met à jour la configuration du module d’inventaire. Renvoie les réglages ' +
      'mis à jour.',
    inputSchema: inventorySettingsSchema,
    readOnly: false,
    handler: async (args) => {
      await updateInventorySettings(args);
      return getInventorySettings();
    },
  },

  // — Sondages (moteur générique de vote) —
  {
    name: 'list_polls',
    title: 'Lister les sondages',
    description:
      'Renvoie les sondages avec leur `id`, statut, nombre d’options, de votes ' +
      'et de suggestions en attente. Filtrable par `status` (DRAFT/OPEN/CLOSED) ' +
      'et `search` (titre).',
    inputSchema: pollFiltersSchema,
    readOnly: true,
    handler: (args) =>
      getPollsAdmin(args as Parameters<typeof getPollsAdmin>[0]),
  },
  {
    name: 'get_poll',
    title: 'Lire un sondage',
    description:
      'Renvoie le détail d’un sondage : ses options (y compris supprimées), le ' +
      'décompte des votes par option et le nombre de suggestions en attente.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: true,
    handler: (args) => getPollAdmin((args as { id: string }).id),
  },
  {
    name: 'get_poll_results',
    title: 'Lire les résultats d’un sondage',
    description:
      'Renvoie le décompte des votes par option (nombre + pourcentage) et le ' +
      'total de votes pour un sondage.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: true,
    handler: (args) => getPollResults((args as { id: string }).id),
  },
  {
    name: 'create_poll',
    title: 'Créer un sondage',
    description:
      'Crée un sondage générique avec ses options (au moins 2). `allowSuggestions` ' +
      'active la collecte de suggestions de la communauté sur ce sondage. ' +
      '`resultsVisibility` ∈ LIVE (résultats visibles pendant le vote) / ' +
      'AFTER_CLOSE (défaut, résultats visibles seulement une fois clôturé). Le ' +
      'sondage est créé en statut DRAFT — utilise `set_poll_status` pour l’ouvrir.',
    inputSchema: pollInputSchema,
    readOnly: false,
    handler: (args) => createPoll(args),
  },
  {
    name: 'update_poll',
    title: 'Modifier un sondage',
    description:
      'Met à jour les champs scalaires d’un sondage de façon PARTIELLE (titre, ' +
      'description, allowSuggestions, resultsVisibility, opensAt, closesAt). Les ' +
      'options se gèrent via `create_poll_option`/`update_poll_option`/ ' +
      '`move_poll_option`/`delete_poll_option`.',
    inputSchema: pollUpdateSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return updatePoll(id, rest);
    },
  },
  {
    name: 'set_poll_status',
    title: 'Ouvrir/clôturer un sondage',
    description:
      'Change le statut d’un sondage : DRAFT (préparation, peut déjà collecter ' +
      'des suggestions), OPEN (vote ouvert) ou CLOSED (clôturé, résultats figés).',
    inputSchema: pollStatusUpdateSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as {
        id: string;
        status: 'DRAFT' | 'OPEN' | 'CLOSED';
      };
      return setPollStatus(id, rest);
    },
  },
  {
    name: 'delete_poll',
    title: 'Supprimer un sondage',
    description:
      'Supprime définitivement un sondage. Refusé si le sondage n’est pas en ' +
      'DRAFT ou a déjà reçu des votes — clôture-le à la place avec `set_poll_status`.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deletePoll((args as { id: string }).id),
  },
  {
    name: 'set_poll_image',
    title: 'Illustrer un sondage',
    description:
      'Associe une image de couverture à un sondage. Deux modes : (1) `imageUrl` — ' +
      'une URL http(s) est TÉLÉCHARGÉE côté serveur puis stockée localement (un ' +
      'chemin `/uploads/...` déjà local est conservé) ; (2) `imageBase64` (base64 ' +
      'brut ou data URI) + `mimeType`. Formats : ' +
      ALLOWED_IMAGE_MIME_TYPES.join(', ') +
      ' (converties automatiquement en WebP, redimensionnées, max 25 MB).',
    inputSchema: z
      .object({
        id: idSchema,
        imageBase64: z.string().min(1).optional(),
        mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES).optional(),
        imageUrl: imageUrlSchema.optional(),
      })
      .refine((v) => Boolean(v.imageBase64) || Boolean(v.imageUrl), {
        message: 'Fournis soit `imageBase64`, soit `imageUrl`.',
      }),
    readOnly: false,
    handler: async (args) => {
      const { id, ...image } = args as {
        id: string;
        imageBase64?: string;
        mimeType?: string;
        imageUrl?: string;
      };
      const url = await resolveStoredImageUrl(
        image,
        uploadPollImage,
        uploadPollImage
      );
      return updatePoll(id, { imageUrl: url });
    },
  },
  {
    name: 'create_poll_option',
    title: 'Ajouter une option à un sondage',
    description:
      'Ajoute une option de vote à un sondage existant (`pollId`). `label` ' +
      'requis, `description`/`imageUrl` optionnels.',
    inputSchema: pollOptionInputSchema.extend({ pollId: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { pollId, ...rest } = args as { pollId: string } & Record<
        string,
        unknown
      >;
      return createPollOption(pollId, rest);
    },
  },
  {
    name: 'update_poll_option',
    title: 'Modifier une option de sondage',
    description:
      'Met à jour une option de façon PARTIELLE (label, description, imageUrl).',
    inputSchema: pollOptionUpdateSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return updatePollOption(id, rest);
    },
  },
  {
    name: 'move_poll_option',
    title: 'Réordonner une option de sondage',
    description:
      'Déplace une option d’un cran (haut/bas) dans l’ordre d’affichage de son ' +
      'sondage.',
    inputSchema: z.object({
      id: idSchema,
      direction: z.enum(['up', 'down']),
    }),
    readOnly: false,
    handler: (args) => {
      const { id, direction } = args as {
        id: string;
        direction: 'up' | 'down';
      };
      return movePollOption(id, direction);
    },
  },
  {
    name: 'delete_poll_option',
    title: 'Supprimer une option de sondage',
    description:
      'Retire une option d’un sondage (suppression douce : les votes déjà ' +
      'enregistrés sur cette option sont conservés).',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deletePollOption((args as { id: string }).id),
  },
  {
    name: 'set_poll_option_image',
    title: 'Illustrer une option de sondage',
    description:
      'Associe une image à une option de sondage. Deux modes : (1) `imageUrl` — ' +
      'une URL http(s) est TÉLÉCHARGÉE côté serveur puis stockée localement (un ' +
      'chemin `/uploads/...` déjà local est conservé) ; (2) `imageBase64` (base64 ' +
      'brut ou data URI) + `mimeType`. Formats : ' +
      ALLOWED_IMAGE_MIME_TYPES.join(', ') +
      ' (converties automatiquement en WebP, redimensionnées, max 25 MB).',
    inputSchema: z
      .object({
        id: idSchema,
        imageBase64: z.string().min(1).optional(),
        mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES).optional(),
        imageUrl: imageUrlSchema.optional(),
      })
      .refine((v) => Boolean(v.imageBase64) || Boolean(v.imageUrl), {
        message: 'Fournis soit `imageBase64`, soit `imageUrl`.',
      }),
    readOnly: false,
    handler: async (args) => {
      const { id, ...image } = args as {
        id: string;
        imageBase64?: string;
        mimeType?: string;
        imageUrl?: string;
      };
      const url = await resolveStoredImageUrl(
        image,
        uploadPollOptionImage,
        uploadPollOptionImage
      );
      return updatePollOption(id, { imageUrl: url });
    },
  },
  {
    name: 'list_poll_suggestions',
    title: 'Lister les suggestions de la communauté',
    description:
      'Renvoie les suggestions (pâtisseries proposées par les clients) ' +
      'filtrables par `pollId` et `status` (PENDING/APPROVED/REJECTED). Utilise ' +
      '`moderate_poll_suggestion` pour approuver/rejeter.',
    inputSchema: z.object({
      pollId: idSchema.optional(),
      status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
      page: z.number().int().positive().optional(),
    }),
    readOnly: true,
    handler: (args) => listSuggestionsAdmin(args as Record<string, unknown>),
  },
  {
    name: 'get_poll_suggestion',
    title: 'Lire une suggestion',
    description: 'Renvoie le détail d’une suggestion de la communauté.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: true,
    handler: (args) => getSuggestion((args as { id: string }).id),
  },
  {
    name: 'moderate_poll_suggestion',
    title: 'Approuver/rejeter une suggestion',
    description:
      'Modère une suggestion PENDING. `decision: "approve"` la promeut en ' +
      'véritable option de vote sur son sondage. `decision: "reject"` la rejette ' +
      '(nécessite `rejectionReason`). Refusé si la suggestion est déjà modérée.',
    inputSchema: pollSuggestionModerationSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return moderatePollSuggestion(id, rest);
    },
  },
];

export const toolsByName = new Map(tools.map((t) => [t.name, t]));

/**
 * Noms des outils accessibles au rôle COMPTABLE (finance uniquement).
 * Utilisé par `withRoleGuard` dans `app/api/mcp/route.ts` pour restreindre
 * `tools/list`/`tools/call`.
 */
export const FINANCE_TOOL_NAMES = new Set(
  tools.filter((t) => t.scope === 'finance').map((t) => t.name)
);

/**
 * Noms des outils accessibles au rôle ANALYSTE (lecture seule, tous
 * domaines). Utilisé par `withRoleGuard` dans `app/api/mcp/route.ts` pour
 * restreindre `tools/list`/`tools/call` aux outils annotés `readOnly: true`.
 */
export const READ_ONLY_TOOL_NAMES = new Set(
  tools.filter((t) => t.readOnly).map((t) => t.name)
);
