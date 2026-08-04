import { describe, it, expect } from 'vitest';
import {
  matchesOrderSearch,
  parseOrderSearchTerm,
  type SearchableOrder,
} from './search';

function makeOrder(overrides: Partial<SearchableOrder> = {}): SearchableOrder {
  return {
    reference: 'EBA-20260706-A3F9',
    dailyNumber: 3,
    customerName: 'Kouakou Axel',
    customerPhone: '+22507881234567',
    ...overrides,
  };
}

/** Raccourci : parse puis matche, en échouant si le terme est inexploitable. */
function matches(order: SearchableOrder, term: string): boolean {
  const parsed = parseOrderSearchTerm(term);
  if (!parsed) throw new Error(`terme inexploitable : ${JSON.stringify(term)}`);
  return matchesOrderSearch(order, parsed);
}

describe('parseOrderSearchTerm', () => {
  it('retourne null sur une chaîne vide ou uniquement des espaces', () => {
    expect(parseOrderSearchTerm('')).toBeNull();
    expect(parseOrderSearchTerm('   ')).toBeNull();
    expect(parseOrderSearchTerm('\n\t ')).toBeNull();
  });

  it('extrait chiffres, tokens et n° du jour', () => {
    const parsed = parseOrderSearchTerm('  #003  ');
    expect(parsed).toMatchObject({
      raw: '#003',
      digits: '003',
      dailyNumber: 3,
    });
  });

  it('ne déduit pas de n° du jour depuis un numéro de téléphone espacé', () => {
    const parsed = parseOrderSearchTerm('07 88 12');
    expect(parsed?.dailyNumber).toBeNull();
    expect(parsed?.digits).toBe('078812');
  });

  it('normalise accents, casse et espaces multiples en tokens', () => {
    const parsed = parseOrderSearchTerm('  Kouakou   AXÈL ');
    expect(parsed?.normalized).toBe('kouakou axel');
    expect(parsed?.tokens).toEqual(['kouakou', 'axel']);
  });
});

describe('matchesOrderSearch — code de retrait et référence', () => {
  it('matche le code de retrait annoncé par le livreur, insensible à la casse', () => {
    expect(matches(makeOrder(), 'a3f9')).toBe(true);
    expect(matches(makeOrder(), 'A3F9')).toBe(true);
  });

  it('matche une référence complète ou partielle', () => {
    expect(matches(makeOrder(), 'EBA-20260706-A3F9')).toBe(true);
    expect(matches(makeOrder(), 'eba-20260706')).toBe(true);
  });

  it('ne matche pas un code de retrait étranger', () => {
    expect(matches(makeOrder(), 'zzzz')).toBe(false);
  });
});

describe('matchesOrderSearch — n° du jour', () => {
  it('matche « #003 » comme « 3 » et « 003 »', () => {
    const order = makeOrder({ reference: 'EBA-20260706-WXYZ' });
    expect(matches(order, '#003')).toBe(true);
    expect(matches(order, '003')).toBe(true);
    expect(matches(order, '3')).toBe(true);
  });

  it('ne matche pas un autre n° du jour', () => {
    const order = makeOrder({
      reference: 'EBA-20260706-WXYZ',
      dailyNumber: 42,
      customerPhone: null,
    });
    expect(matches(order, '#007')).toBe(false);
  });
});

describe('matchesOrderSearch — téléphone', () => {
  const order = makeOrder({
    reference: 'EBA-20260706-WXYZ',
    dailyNumber: 42,
    customerName: null,
  });

  it('matche les quatre formes écrites d’un même numéro partiel', () => {
    expect(matches(order, '07 88 12')).toBe(true);
    expect(matches(order, '+225 07 88 12')).toBe(true);
    expect(matches(order, '0788 12')).toBe(true);
    expect(matches(order, '078812')).toBe(true);
  });

  it('matche le numéro complet stocké en E.164', () => {
    expect(matches(order, '+225 07 88 12 34 56 7')).toBe(true);
  });

  it('ne matche pas un numéro qui ne contient pas la suite de chiffres', () => {
    expect(matches(order, '09 99 99')).toBe(false);
  });

  it('n’utilise pas un terme de 1-2 chiffres pour matcher tous les téléphones', () => {
    // « 07 » est le préfixe de presque tous les mobiles ivoiriens : sous le
    // seuil, la recherche téléphone reste inactive.
    const other = makeOrder({
      // Référence volontairement sans « 7 » : on isole le critère téléphone
      // du critère « référence contains ».
      reference: 'EBA-20261213-WXYZ',
      dailyNumber: 42,
      customerName: null,
      customerPhone: '+22507990000000',
    });
    expect(matches(other, '07')).toBe(false);
    expect(matches(other, '7')).toBe(false);
  });
});

describe('matchesOrderSearch — nom du client', () => {
  const order = makeOrder({
    reference: 'EBA-20260706-WXYZ',
    dailyNumber: 42,
    customerName: 'Kouakou Axèl',
    customerPhone: null,
  });

  it('ignore les accents et la casse', () => {
    expect(matches(order, 'axel')).toBe(true);
    expect(matches(order, 'AXÈL')).toBe(true);
  });

  it('exige TOUS les mots, dans n’importe quel ordre', () => {
    expect(matches(order, 'axel kou')).toBe(true);
    expect(matches(order, 'kouakou axel')).toBe(true);
  });

  it('rejette dès qu’un mot manque', () => {
    expect(matches(order, 'axel diallo')).toBe(false);
  });

  it('ne plante pas sur une commande anonyme', () => {
    const anonymous = makeOrder({
      reference: 'EBA-20260706-WXYZ',
      dailyNumber: 42,
      customerName: null,
      customerPhone: null,
    });
    expect(matches(anonymous, 'axel')).toBe(false);
  });
});
