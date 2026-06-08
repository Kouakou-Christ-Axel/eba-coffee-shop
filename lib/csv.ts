// lib/csv.ts
//
// Génération CSV sans dépendance, pensée pour Excel en locale FR :
// - séparateur point-virgule (Excel FR découpe sur `;`)
// - fin de ligne CRLF
// - BOM UTF-8 en tête pour que les accents s'affichent correctement
//
// Les nombres sont laissés bruts (entiers FCFA) pour rester numériques dans
// le tableur ; le formatage d'affichage reste la responsabilité de l'UI.

const DELIMITER = ';';
const EOL = '\r\n';
const BOM = '﻿';

type Cell = string | number | boolean | null | undefined;

function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  const s = String(value);
  if (/[";\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Construit une chaîne CSV (avec BOM) depuis un en-tête et des lignes. */
export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCell).join(DELIMITER)
  );
  return BOM + lines.join(EOL) + EOL;
}

/** Réponse HTTP de téléchargement CSV (attachment). */
export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
