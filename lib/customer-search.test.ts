// lib/customer-search.test.ts
import { describe, it, expect } from 'vitest';
import { searchCustomers, type CustomerSearchable } from '@/lib/customer-search';

function customer(
  id: string,
  name: string | null,
  phone: string
): CustomerSearchable {
  return { id, name, phone };
}

const CORPUS: CustomerSearchable[] = [
  customer('1', 'Kouakou Axel', '2250700000001'),
  customer('2', 'Aïcha Koné', '2250700000002'),
  customer('3', 'Yao Serge', '2250700000003'),
  customer('4', null, '2250700000004'),
];

describe('searchCustomers', () => {
  it('requête vide ⇒ []', () => {
    expect(searchCustomers(CORPUS, '')).toEqual([]);
    expect(searchCustomers(CORPUS, '   ')).toEqual([]);
  });

  it('catalogue vide ⇒ []', () => {
    expect(searchCustomers([], 'axel')).toEqual([]);
  });

  it('trouve malgré l’accent', () => {
    expect(searchCustomers(CORPUS, 'aicha').map((c) => c.id)).toContain('2');
  });

  it('trouve malgré l’ordre des mots', () => {
    expect(searchCustomers(CORPUS, 'axel kouakou').map((c) => c.id)).toContain(
      '1'
    );
  });

  it('tolère une faute de frappe', () => {
    expect(searchCustomers(CORPUS, 'kouakuo axel').map((c) => c.id)).toContain(
      '1'
    );
  });

  it('trouve par chiffres de téléphone (match exact, pas flou)', () => {
    const hits = searchCustomers(CORPUS, '0700000003');
    expect(hits.map((c) => c.id)).toContain('3');
  });

  it('un match téléphone passe avant un match nom', () => {
    const withOverlap: CustomerSearchable[] = [
      customer('a', 'Serge', '2250700000009'),
      customer('b', 'Autre', '2250709000000'),
    ];
    // "9000000" matche le téléphone de b ; le nom de a ne contient rien de tel.
    const hits = searchCustomers(withOverlap, '9000000');
    expect(hits[0]?.id).toBe('b');
  });

  it('ne renvoie pas de doublon quand nom et téléphone matchent tous les deux', () => {
    const hits = searchCustomers(
      [customer('1', 'Kouakou Axel', '2250700000001')],
      'axel'
    );
    expect(hits).toHaveLength(1);
  });

  it('un client sans nom ne fait pas planter la recherche', () => {
    expect(() => searchCustomers(CORPUS, 'zzz')).not.toThrow();
    expect(searchCustomers(CORPUS, 'zzz')).toEqual([]);
  });

  it('ne mute pas le tableau source', () => {
    const source = [...CORPUS];
    searchCustomers(source, 'axel');
    expect(source.map((c) => c.id)).toEqual(CORPUS.map((c) => c.id));
  });
});
