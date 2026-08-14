// lib/fuzzy-search.ts
//
// Recherche floue partagée de l'app, au-dessus de Fuse.js. C'EST le point
// d'entrée unique : ne pas réécrire de `filter(...toLowerCase().includes(...))`
// dans un composant — une recherche maison est systématiquement sensible aux
// accents, à l'ordre des mots et aux fautes de frappe.
//
// Trois choix structurants, tous nécessaires :
//
//   1. Normalisation — Fuse ne replie AUCUN diacritique. On passe chaque valeur
//      indexée et chaque requête dans `foldText` (la normalisation déjà
//      partagée par `lib/orders/search.ts` et `lib/menu-display.ts`), sinon
//      « cafe » ne trouve pas « Café ».
//   2. `ignoreLocation` — sans lui, Fuse pénalise lourdement un match qui n'est
//      pas en début de chaîne, ce qui est inutilisable sur des noms d'articles.
//   3. Recherche en DEUX passes — la syntaxe étendue de Fuse (`'token`) donne
//      un ET entre tokens, donc l'indépendance à l'ordre des mots
//      (« farine t45 » trouve « T45 Farine »), mais elle est exacte et ne
//      tolère aucune faute de frappe. On retombe donc sur une recherche floue
//      classique quand la passe étendue ne rend rien.
//
// Pur : aucune dépendance Prisma ni React, utilisable serveur comme client.

import Fuse, { type IFuseOptions } from 'fuse.js';
import { foldText } from '@/lib/text';

/** Champ indexé, avec son poids relatif (défaut Fuse : 1). */
export type FuzzyKey<T> = { name: keyof T & string; weight?: number };

export type FuzzyHit<T> = {
  item: T;
  /** Score Fuse : 0 = correspondance parfaite, 1 = très mauvaise. */
  score: number;
};

export type FuzzyIndex<T> = {
  /** Résultats triés du meilleur au moins bon. Requête vide ⇒ `[]`. */
  search(query: string, limit?: number): FuzzyHit<T>[];
};

/** Tolérance par défaut : assez lâche pour absorber une faute de frappe, assez
 *  stricte pour ne pas ramener n'importe quoi sur une requête sans rapport. */
const DEFAULT_THRESHOLD = 0.35;
const DEFAULT_MIN_MATCH_CHAR_LENGTH = 2;

/** Caractères réservés par la syntaxe étendue de Fuse (`^$!'|=`). Les échapper
 *  n'est pas prévu par la lib : on les retire du token, ce qui dégrade au pire
 *  la précision d'un caractère. */
function sanitizeToken(token: string): string {
  return token.replace(/[\^$!'|=]/g, '');
}

/** Requête foldée puis découpée en tokens exploitables. */
function tokenize(query: string): string[] {
  return foldText(query)
    .split(/\s+/)
    .map(sanitizeToken)
    .filter((token) => token.length > 0);
}

/**
 * Construit un index de recherche floue sur `items`.
 *
 * À MÉMOÏSER côté client (`useMemo` sur la référence du tableau) : l'indexation
 * parcourt tout le corpus et n'a aucune raison d'être refaite à chaque frappe.
 */
export function createFuzzyIndex<T>(
  items: readonly T[],
  options: {
    keys: FuzzyKey<T>[];
    /** 0 = correspondance exacte exigée, 1 = tout passe. Défaut 0.35. */
    threshold?: number;
    /** Longueur minimale d'un fragment retenu. Défaut 2. */
    minMatchCharLength?: number;
  }
): FuzzyIndex<T> {
  const shared: IFuseOptions<T> = {
    keys: options.keys,
    threshold: options.threshold ?? DEFAULT_THRESHOLD,
    minMatchCharLength:
      options.minMatchCharLength ?? DEFAULT_MIN_MATCH_CHAR_LENGTH,
    ignoreLocation: true,
    includeScore: true,
    // Normalise TOUT ce qui est indexé. `getFn` peut recevoir un tableau quand
    // le champ est multi-valué : on replie chaque entrée.
    getFn: (obj, path) => {
      const value = Fuse.config.getFn(obj, path);
      if (Array.isArray(value)) return value.map(foldText);
      return typeof value === 'string' ? foldText(value) : '';
    },
  };

  // Deux instances : la syntaxe étendue change l'interprétation de la requête,
  // elle ne peut pas être activée à la volée sur une instance unique.
  const extended = new Fuse(items as T[], {
    ...shared,
    useExtendedSearch: true,
  });
  const loose = new Fuse(items as T[], shared);

  return {
    search(query, limit) {
      const tokens = tokenize(query);
      if (tokens.length === 0) return [];

      // Passe 1 — ET entre tokens : indépendante de l'ordre des mots.
      const andQuery = tokens.map((token) => `'${token}`).join(' ');
      let results = extended.search(andQuery, limit ? { limit } : undefined);

      // Passe 2 — repli flou : c'est elle qui rattrape les fautes de frappe.
      if (results.length === 0) {
        results = loose.search(tokens.join(' '), limit ? { limit } : undefined);
      }

      return results.map((result) => ({
        item: result.item,
        score: result.score ?? 0,
      }));
    },
  };
}
