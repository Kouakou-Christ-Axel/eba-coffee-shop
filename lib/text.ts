// lib/text.ts
//
// Normalisation de texte partagée par les recherches de l'app (commandes au
// comptoir, carte publique). Centralisée ici parce qu'une recherche qui replie
// les accents d'un côté mais pas de l'autre donne deux comportements différents
// pour la même frappe.

/** Minuscules sans diacritiques : « Kouakou Axèl » → « kouakou axel ». */
export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}
