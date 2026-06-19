// lib/inventory-excel.ts
//
// Lecture/écriture de classeurs Excel (.xlsx) pour l'inventaire (export des
// références valorisées, template d'import à 3 feuilles, parsing d'import).
// Server-only (dépend de `xlsx`/SheetJS). Conformément à CLAUDE.md, ce module
// ne fait QUE de la (dé)sérialisation : la validation et l'écriture en base
// vivent dans lib/inventory-mutations.ts.

import * as XLSX from 'xlsx';
import type { InventoryItemView } from '@/lib/inventory';
import type { InventoryImportMode } from '@/lib/schemas/inventory';

const UNIT_LABELS: Record<string, string> = {
  UNIT: 'UNIT',
  KG: 'KG',
  G: 'G',
  L: 'L',
  ML: 'ML',
  BOX: 'BOX',
};

// ─── Export des références valorisées ─────────────────────────────────────────

export function buildInventoryWorkbook(items: InventoryItemView[]): Buffer {
  const headers = [
    'sku',
    'nom',
    'categorie',
    'unite',
    'quantite',
    'pmp',
    'valeur_stock',
    'stock_securite',
    'point_reappro',
    'fournisseur',
    'dernier_comptage',
  ];
  const rows = items.map((i) => [
    i.sku,
    i.name,
    i.category ?? '',
    UNIT_LABELS[i.unit] ?? i.unit,
    i.currentQuantity,
    i.avgUnitCost,
    i.stockValue,
    i.safetyStock,
    i.reorderPoint ?? '',
    i.supplier ?? '',
    i.lastCountedAt ?? '',
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventaire');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ─── Template d'import (3 feuilles + aide) ────────────────────────────────────

export function buildImportTemplateWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();

  const references = [
    [
      'sku',
      'nom',
      'categorie',
      'unite',
      'stock_securite',
      'point_reappro',
      'fournisseur',
      'quantite_initiale',
      'cout_initial',
    ],
    // SKU laissé VIDE = nouvelle référence (le système génère le code).
    ['', 'Grains Arabica', 'Café', 'KG', 5, 8, 'Torréfacteur', 20, 6000],
    ['', 'Lait entier 1L', 'Boissons', 'L', 12, 20, 'Grossiste', 30, 700],
    ['', 'Gobelet carton 25cl', 'Emballages', 'UNIT', 200, 400, 'Fournitures', 1000, 35],
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(references),
    'Références'
  );

  const count = [
    ['sku', 'quantite_comptee'],
    ['CAFE-ARABICA', 14],
    ['LAIT-ENTIER', 22],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(count), 'Comptage');

  const purchases = [
    ['sku', 'quantite', 'cout_unitaire'],
    ['CAFE-ARABICA', 10, 6200],
    ['LAIT-ENTIER', 24, 720],
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(purchases),
    'Achats'
  );

  const help = [
    ['Aide — Import inventaire EBA'],
    [''],
    ['Le SKU est GÉNÉRÉ par le système : laissez la colonne « sku » VIDE'],
    ['pour créer une nouvelle référence. Ne renseignez un SKU que pour'],
    ['cibler une référence EXISTANTE (le SKU figure dans l’export).'],
    [''],
    [
      'Feuille « Références » : crée (sku vide) ou met à jour (sku rempli) le',
    ],
    [
      'catalogue. quantite_initiale et cout_initial servent au stock d’ouverture',
    ],
    ['(à la création uniquement).'],
    [''],
    ['Feuille « Comptage » : enregistre un inventaire physique (la date est'],
    ['choisie dans la fenêtre d’import). Le SKU est requis (réf. existante).'],
    ['Le système déduit la consommation.'],
    [''],
    [
      'Feuille « Achats » : enregistre un réappro (entrées). Le SKU est requis.',
    ],
    ['Fournisseur, date, mode de paiement et dépense liée sont choisis dans la'],
    ['fenêtre d’import.'],
    [''],
    ['Unités acceptées : UNIT, KG, G, L, ML, BOX.'],
    [
      'Montants en francs CFA (entiers). Quantités décimales autorisées (kg/L).',
    ],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(help), 'Aide');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ─── Parsing d'import ─────────────────────────────────────────────────────────

/** Normalise un en-tête de colonne (accents/espaces/casse) pour le matching. */
function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

type RawRow = Record<string, unknown>;

function readSheetRows(
  buffer: Buffer,
  sheetName: string
): Record<string, unknown>[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[sheetName] ?? wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const raw = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: null });
  // Ré-indexe chaque ligne par en-tête normalisé.
  return raw.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      out[normalizeHeader(key)] = value;
    }
    return out;
  });
}

function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

export type ParsedReferenceRow = {
  sku?: string;
  name?: string;
  category?: string;
  unit?: string;
  safetyStock?: unknown;
  reorderPoint?: unknown;
  supplier?: string;
  initialQuantity?: unknown;
  initialUnitCost?: unknown;
};

export type ParsedCountRow = { sku?: string; countedQuantity?: unknown };
export type ParsedPurchaseRow = {
  sku?: string;
  quantity?: unknown;
  unitCost?: unknown;
};

/**
 * Parse le classeur selon le mode et renvoie des lignes BRUTES (clés alignées
 * sur les schémas Zod, mais non validées). La validation reste côté mutations.
 */
export function parseImportWorkbook(
  buffer: Buffer,
  mode: InventoryImportMode
): ParsedReferenceRow[] | ParsedCountRow[] | ParsedPurchaseRow[] {
  if (mode === 'references') {
    const rows = readSheetRows(buffer, 'Références');
    return rows.map<ParsedReferenceRow>((r) => ({
      sku: str(r.sku),
      name: str(r.nom) ?? str(r.name),
      category: str(r.categorie) ?? str(r.category),
      unit: str(r.unite)?.toUpperCase() ?? str(r.unit)?.toUpperCase(),
      safetyStock: r.stock_securite ?? undefined,
      reorderPoint: r.point_reappro ?? undefined,
      supplier: str(r.fournisseur) ?? str(r.supplier),
      initialQuantity: r.quantite_initiale ?? undefined,
      initialUnitCost: r.cout_initial ?? undefined,
    }));
  }
  if (mode === 'count') {
    const rows = readSheetRows(buffer, 'Comptage');
    return rows.map<ParsedCountRow>((r) => ({
      sku: str(r.sku),
      countedQuantity: r.quantite_comptee ?? r.quantite ?? undefined,
    }));
  }
  // purchases
  const rows = readSheetRows(buffer, 'Achats');
  return rows.map<ParsedPurchaseRow>((r) => ({
    sku: str(r.sku),
    quantity: r.quantite ?? undefined,
    unitCost: r.cout_unitaire ?? r.cout ?? undefined,
  }));
}

// ─── Réponse HTTP de téléchargement .xlsx ─────────────────────────────────────

export function xlsxResponse(filename: string, buffer: Buffer): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
