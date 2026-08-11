// lib/text.test.ts

import { describe, it, expect } from 'vitest';
import { foldText } from './text';

describe('foldText', () => {
  it('retire les diacritiques et passe en minuscules', () => {
    expect(foldText('Kouakou Axèl')).toBe('kouakou axel');
    expect(foldText('Crêpe Sucrée')).toBe('crepe sucree');
    expect(foldText('ÉCLAIR')).toBe('eclair');
  });

  it('laisse intact un texte déjà replié', () => {
    expect(foldText('bissap')).toBe('bissap');
  });

  it('préserve les espaces et la ponctuation', () => {
    expect(foldText('Chou x2 — café')).toBe('chou x2 — cafe');
  });
});
