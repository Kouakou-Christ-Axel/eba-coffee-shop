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
import { parseDateOnlyToUTC } from '@/lib/timezone';
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
  createCategorySchema,
  updateCategorySchema,
  productInputSchema,
  productUpdateSchema,
} from '@/lib/menu-mutations';
import {
  saveProductImageFromBase64,
  saveReceiptImageFromBase64,
} from '@/lib/uploads';
import { ALLOWED_IMAGE_MIME_TYPES, imageUrlSchema } from '@/lib/schemas/upload';
import {
  listExpenseCategories,
  listExpenses,
  getExpenseSummary,
} from '@/lib/expenses';
import {
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  createExpense,
  updateExpense,
  deleteExpense,
} from '@/lib/expense-mutations';
import {
  expenseCategoryInputSchema,
  expenseInputSchema,
  expenseFiltersSchema,
} from '@/lib/schemas/expense';
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

// ─── Type d'un outil ────────────────────────────────────────────────────────

export type McpTool = {
  name: string;
  title: string;
  description: string;
  /** Schéma Zod des arguments. `z.object({})` = aucun argument. */
  inputSchema: z.ZodType;
  /** Outil en lecture seule (annotation MCP `readOnlyHint`). */
  readOnly: boolean;
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
    title: 'Créer une catégorie de dépense',
    description:
      'Crée une catégorie de dépense (ex. « Emballages », « Loyer »). Le nom ' +
      'doit être unique.',
    inputSchema: expenseCategoryInputSchema,
    readOnly: false,
    handler: (args) => createExpenseCategory(args),
  },
  {
    name: 'update_expense_category',
    title: 'Renommer une catégorie de dépense',
    description: 'Met à jour le nom d’une catégorie de dépense.',
    inputSchema: expenseCategoryInputSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string; name: string };
      return updateExpenseCategory(id, rest);
    },
  },
  {
    name: 'delete_expense_category',
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
    title: 'Lister les dépenses',
    description:
      'Renvoie les dépenses filtrées par plage de dates (`from`/`to`, ' +
      '`YYYY-MM-DD`, jour civil Abidjan) et/ou `categoryId`, avec le total. ' +
      'Tous les filtres sont optionnels.',
    inputSchema: expenseFiltersSchema,
    readOnly: true,
    handler: (args) => {
      const f = args as { from?: string; to?: string; categoryId?: string };
      return listExpenses({
        dateFrom: parseDateOnlyToUTC(f.from),
        dateTo: parseDateOnlyToUTC(f.to),
        categoryId: f.categoryId,
      });
    },
  },
  {
    name: 'get_expense_summary',
    title: 'Synthèse des dépenses',
    description:
      'Renvoie le total des dépenses et leur ventilation par catégorie sur ' +
      'une plage de dates. Montants en francs CFA.',
    inputSchema: rangeSchema,
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      return getExpenseSummary(from, to);
    },
  },
  {
    name: 'create_expense',
    title: 'Créer une dépense',
    description:
      'Enregistre une dépense. `date` au format `YYYY-MM-DD`, `amount` en ' +
      'francs CFA entiers, `categoryId` issu de `list_expense_categories`. ' +
      '`paymentMethod` ∈ CASH/WAVE/BANK/OTHER (défaut CASH). `supplier`, ' +
      '`note` et `receiptUrl` sont optionnels ; pour joindre une photo encodée, ' +
      'utilise `set_expense_receipt` après création.',
    inputSchema: expenseInputSchema,
    readOnly: false,
    handler: (args) => createExpense(args),
  },
  {
    name: 'update_expense',
    title: 'Modifier une dépense',
    description:
      'Met à jour une dépense de façon PARTIELLE : ne fournis que les champs à ' +
      'modifier.',
    inputSchema: expenseInputSchema.partial().extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return updateExpense(id, rest);
    },
  },
  {
    name: 'delete_expense',
    title: 'Supprimer une dépense',
    description: 'Supprime définitivement une dépense. Action irréversible.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteExpense((args as { id: string }).id),
  },
  {
    name: 'set_expense_receipt',
    title: 'Joindre un justificatif à une dépense',
    description:
      'Associe une photo de justificatif à une dépense. Deux modes : (1) ' +
      '`imageBase64` (base64 brut ou data URI) + `mimeType` — stockée ' +
      'localement ; (2) `imageUrl` (chemin `/uploads/...` ou URL http(s)). ' +
      'Formats : ' +
      ALLOWED_IMAGE_MIME_TYPES.join(', ') +
      ' (max 5 MB).',
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
      const { id, imageBase64, mimeType, imageUrl } = args as {
        id: string;
        imageBase64?: string;
        mimeType?: string;
        imageUrl?: string;
      };
      const url = imageBase64
        ? await saveReceiptImageFromBase64(imageBase64, mimeType)
        : imageUrl!;
      return updateExpense(id, { receiptUrl: url });
    },
  },

  // — Clôture de caisse (espèces, journalière) —
  {
    name: 'get_cash_position',
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
      'suppléments se désignent par `groupName` + `optionName`. Le total est ' +
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
      'Supprime une catégorie et, par cascade, tous ses produits. Action ' +
      'irréversible.',
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
      '`supplementGroups` peut être un tableau vide. `imageUrl` accepte un ' +
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
      'Associe une image à un produit. Deux modes : (1) téléverser un fichier en ' +
      'fournissant `imageBase64` (contenu encodé en base64, ou data URI) + ' +
      '`mimeType` — l’image est stockée localement ; (2) référencer une image ' +
      'existante via `imageUrl` (chemin `/uploads/...` ou URL http(s)). Renvoie ' +
      'le produit mis à jour avec son `imageUrl`. Formats acceptés : ' +
      ALLOWED_IMAGE_MIME_TYPES.join(', ') +
      ' (max 5 MB).',
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
      const { id, imageBase64, mimeType, imageUrl } = args as {
        id: string;
        imageBase64?: string;
        mimeType?: string;
        imageUrl?: string;
      };
      const url = imageBase64
        ? await saveProductImageFromBase64(imageBase64, mimeType)
        : imageUrl!;
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
    description: 'Supprime définitivement un produit. Action irréversible.',
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
];

export const toolsByName = new Map(tools.map((t) => [t.name, t]));
