// lib/supplements-form.ts
//
// Logique pure de l'éditeur de suppléments (`components/(dashboard)/
// supplements-editor.tsx`), extraite du composant pour deux raisons :
//
//  1. les tests tournent en environnement `node` (pas de Testing Library) —
//     seule de la logique sans JSX est testable ;
//  2. les deux formulaires consommateurs (fiche produit et extras globaux)
//     doivent élaguer et valider EXACTEMENT de la même façon. Ils divergeaient :
//     `global-extras-form` filtrait les groupes sans nom, `product-form` non,
//     d'où un « Ajouter un groupe » puis « Enregistrer » qui échouait sur la
//     fiche produit et passait sur les extras.
//
// Les messages d'erreur sont repris MOT POUR MOT de `lib/schemas/menu.ts` :
// la validation cliente n'est qu'une avance sur le repli serveur, les deux
// doivent dire la même chose au même moment.

export type SupplementOption = {
  name: string;
  price: number;
  available: boolean;
  // Stock vendable de l'option (« goût »). `null` = illimité (par défaut).
  stockQuantity: number | null;
};

export type SupplementGroupType = 'single' | 'multiple' | 'quantity';

export type SupplementGroup = {
  name: string;
  type: SupplementGroupType;
  required: boolean;
  available: boolean;
  // Bornes sur le nombre d'options cochées ('multiple') ou sur la quantité
  // totale répartie ('quantity'). `null` = pas de borne. Ignorées si 'single'.
  minSelect: number | null;
  maxSelect: number | null;
  options: SupplementOption[];
};

/**
 * Libellé et aide de chaque type de groupe. L'aide n'est pas décorative :
 * « Quantité (répartition) », l'ancien libellé, ne dit pas ce que le client
 * verra, et c'est le type le moins évident des trois.
 */
export const GROUP_TYPES: Record<
  SupplementGroupType,
  { label: string; help: string }
> = {
  single: {
    label: 'Choix unique',
    help: 'Le client choisit une seule option.',
  },
  multiple: {
    label: 'Choix multiples',
    help: 'Le client coche autant d’options qu’il veut, dans les bornes.',
  },
  quantity: {
    label: 'Quantité à répartir',
    help: 'Le client répartit une quantité entre les options (ex. 3 parts entre 3 goûts).',
  },
};

const NAME_MAX = 80;

/**
 * Une option jamais touchée : ajoutée d'un clic puis abandonnée. On l'élague en
 * silence plutôt que de la signaler — reprocher un champ vide à quelqu'un qui
 * n'a rien saisi serait du bruit. Dès qu'un prix ou un stock y a été posé, elle
 * n'est plus vierge et son nom manquant devient une vraie erreur.
 */
function isBlankOption(o: SupplementOption): boolean {
  return o.name.trim() === '' && o.price === 0 && o.stockQuantity == null;
}

/** Un groupe vierge : pas de nom, et aucune option qui ne soit vierge. */
function isBlankGroup(g: SupplementGroup): boolean {
  return g.name.trim() === '' && g.options.every(isBlankOption);
}

/** Bornes affichables d'un groupe, ou `null` si aucune n'est posée. */
function describeBounds(g: SupplementGroup): string | null {
  if (g.type === 'single') return null;
  const { minSelect: min, maxSelect: max } = g;
  if (min == null && max == null) return null;
  if (min != null && max != null) {
    return min === max ? `${min} exactement` : `${min} à ${max}`;
  }
  return min != null ? `${min} minimum` : `${max} maximum`;
}

/**
 * Ligne de résumé d'un groupe replié. Elle doit répondre à « qu'est-ce que
 * c'est, et est-ce complet ? » sans qu'on ait à déplier : d'où le nombre
 * d'options, seul indicateur de complétude (« aucune option » = invalide).
 */
export function summarizeGroup(g: SupplementGroup): string {
  const parts: string[] = [GROUP_TYPES[g.type].label];
  if (g.required) parts.push('Obligatoire');
  const bounds = describeBounds(g);
  if (bounds) parts.push(bounds);

  const count = g.options.filter((o) => !isBlankOption(o)).length;
  parts.push(
    count === 0
      ? 'aucune option'
      : count === 1
        ? '1 option'
        : `${count} options`
  );
  return parts.join(' · ');
}

export type SupplementGroupIssues = {
  /** Messages affichés en tête du groupe. */
  group: string[];
  /** Message par option, indexé comme `group.options` ; `null` = pas d'erreur. */
  options: (string | null)[];
};

/**
 * Valide les groupes côté client, avant l'aller-retour serveur, pour pouvoir
 * rattacher chaque message au groupe et à l'option fautifs — ce que le repli
 * serveur ne permet pas : `fail()` (menu/actions.ts) agrège tous les messages
 * Zod en une seule chaîne, affichée en bas de page sans localisation.
 *
 * Les groupes vierges sont ignorés : ils seront élagués par
 * `pruneSupplementGroups`, pas soumis.
 *
 * @returns une entrée par groupe en faute, indexée par sa position.
 */
export function validateSupplementGroups(
  groups: SupplementGroup[]
): Map<number, SupplementGroupIssues> {
  const issues = new Map<number, SupplementGroupIssues>();

  groups.forEach((g, gi) => {
    if (isBlankGroup(g)) return;

    const groupIssues: string[] = [];
    const optionIssues: (string | null)[] = g.options.map(() => null);

    const name = g.name.trim();
    if (name === '') groupIssues.push('Nom requis');
    else if (name.length > NAME_MAX) {
      groupIssues.push('Nom trop long (max 80 caractères)');
    }

    // Doublons de nom : le décrément de stock au paiement résout les options
    // par nom, pas par id — deux homonymes rendent l'opération ambiguë.
    const seen = new Map<string, number>();
    g.options.forEach((o) => {
      if (isBlankOption(o)) return;
      const key = o.name.trim().toLowerCase();
      if (key === '') return;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    });
    if ([...seen.values()].some((n) => n > 1)) {
      groupIssues.push(
        'Deux options ne peuvent pas porter le même nom dans un groupe'
      );
    }

    let liveOptions = 0;
    g.options.forEach((o, oi) => {
      if (isBlankOption(o)) return;
      liveOptions++;

      const optionName = o.name.trim();
      if (optionName === '') {
        optionIssues[oi] = 'Nom requis';
        return;
      }
      if (optionName.length > NAME_MAX) {
        optionIssues[oi] = 'Nom trop long (max 80 caractères)';
        return;
      }
      if ((seen.get(optionName.toLowerCase()) ?? 0) > 1) {
        optionIssues[oi] = 'Ce nom est déjà utilisé';
        return;
      }
      if (!Number.isInteger(o.price) || o.price < 0) {
        optionIssues[oi] = 'Prix invalide';
        return;
      }
      if (
        o.stockQuantity != null &&
        (!Number.isInteger(o.stockQuantity) || o.stockQuantity < 0)
      ) {
        optionIssues[oi] = 'Stock invalide';
      }
    });

    if (liveOptions === 0) groupIssues.push('Au moins une option requise');

    if (
      g.minSelect != null &&
      g.maxSelect != null &&
      g.minSelect > g.maxSelect
    ) {
      groupIssues.push('Le minimum ne peut pas dépasser le maximum');
    }

    if (groupIssues.length > 0 || optionIssues.some(Boolean)) {
      issues.set(gi, { group: groupIssues, options: optionIssues });
    }
  });

  return issues;
}

/**
 * Forme canonique d'un groupe : champs recopiés un par un, dans un ORDRE FIXE.
 *
 * L'ordre n'est pas cosmétique. `product-form` détecte les « modifications non
 * enregistrées » en comparant deux `JSON.stringify`, dont l'un vient du mapping
 * initial de `[productId]/page.tsx` — et `JSON.stringify` est sensible à
 * l'ordre des clés. Un ordre différent rendrait le formulaire sale dès son
 * ouverture, sans que rien n'ait été saisi. La recopie explicite garantit aussi
 * qu'aucune clé étrangère (l'identifiant interne de l'éditeur, par exemple) ne
 * puisse fuir : le schéma serveur n'est pas `strict` et l'absorberait en
 * silence.
 *
 * Cet ordre doit rester celui de `[productId]/page.tsx` et de
 * `extras-globaux/page.tsx`.
 */
export function toCanonicalGroup(g: SupplementGroup): SupplementGroup {
  return {
    name: g.name,
    type: g.type,
    required: g.required,
    available: g.available,
    minSelect: g.minSelect,
    maxSelect: g.maxSelect,
    options: g.options.map((o) => ({
      name: o.name,
      price: o.price,
      available: o.available,
      stockQuantity: o.stockQuantity,
    })),
  };
}

/**
 * Prépare les groupes pour l'envoi : élague ce qui n'a jamais été saisi et
 * coupe les espaces autour des noms.
 */
export function pruneSupplementGroups(
  groups: SupplementGroup[]
): SupplementGroup[] {
  return groups
    .filter((g) => !isBlankGroup(g))
    .map((g) =>
      toCanonicalGroup({
        ...g,
        name: g.name.trim(),
        options: g.options
          .filter((o) => !isBlankOption(o))
          .map((o) => ({ ...o, name: o.name.trim() })),
      })
    );
}
