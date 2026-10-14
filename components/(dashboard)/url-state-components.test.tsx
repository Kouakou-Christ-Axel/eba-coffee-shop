// Rendu serveur des composants partagés du dashboard branchés sur nuqs : ils
// doivent se rendre sans erreur sous l'adaptateur et refléter l'URL.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { Pagination } from './pagination';
import { DateRangeFilter } from './date-range-filter';

function withUrl(search: string, node: React.ReactNode) {
  return renderToStaticMarkup(
    <NuqsTestingAdapter searchParams={search}>{node}</NuqsTestingAdapter>
  );
}

describe('Pagination (nuqs)', () => {
  it("reflète la page de l'URL", () => {
    const html = withUrl('?page=3', <Pagination totalPages={5} />);
    expect(html).toMatch(/aria-label="pagination item 3 active"/);
  });

  it('retombe sur la page 1 sans paramètre ou avec une valeur invalide', () => {
    for (const search of ['', '?page=abc']) {
      const html = withUrl(search, <Pagination totalPages={5} />);
      expect(html).toMatch(/aria-label="pagination item 1 active"/);
    }
  });

  it("n'est pas en attente au premier rendu", () => {
    expect(withUrl('', <Pagination totalPages={2} />)).toContain(
      'aria-busy="false"'
    );
  });
});

describe('DateRangeFilter (nuqs)', () => {
  it('affiche les bornes reçues du serveur', () => {
    const html = withUrl(
      '?from=2026-05-10&to=2026-05-12',
      <DateRangeFilter from="2026-05-10" to="2026-05-12" isAll={false} />
    );
    expect(html).toContain('value="2026-05-10"');
    expect(html).toContain('value="2026-05-12"');
    expect(html).toContain('aria-busy="false"');
  });

  it('vide les champs en mode « Tout »', () => {
    const html = withUrl('?range=all', <DateRangeFilter from="" to="" isAll />);
    expect(html).not.toMatch(/value="\d{4}-/);
  });
});
