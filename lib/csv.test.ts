// lib/csv.test.ts
import { describe, it, expect } from 'vitest';
import { toCsv } from '@/lib/csv';

const BOM = '﻿';

describe('toCsv', () => {
  it('génère un en-tête + lignes séparés par ; et CRLF, avec BOM', () => {
    const csv = toCsv(['A', 'B'], [['1', '2']]);
    expect(csv).toBe(`${BOM}A;B\r\n1;2\r\n`);
  });

  it('échappe les champs contenant ; " ou retour ligne', () => {
    const csv = toCsv(
      ['col'],
      [['a;b'], ['dit "salut"'], ['ligne1\nligne2']]
    );
    expect(csv).toContain('"a;b"');
    expect(csv).toContain('"dit ""salut"""');
    expect(csv).toContain('"ligne1\nligne2"');
  });

  it('rend les booléens en Oui/Non et les vides pour null/undefined', () => {
    const csv = toCsv(['p', 'n', 'v'], [[true, false, null]]);
    expect(csv).toBe(`${BOM}p;n;v\r\nOui;Non;\r\n`);
  });

  it('laisse les nombres bruts (numériques pour le tableur)', () => {
    const csv = toCsv(['total'], [[1500]]);
    expect(csv).toBe(`${BOM}total\r\n1500\r\n`);
  });
});
