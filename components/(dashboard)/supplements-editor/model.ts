import {
  toCanonicalGroup,
  type SupplementGroup,
  type SupplementOption,
} from '@/lib/supplements-form';

// Miroir interne à identité stable : `uid` sert de `key` React (une clé par position gardait le prix de l'option
// supprimée). Il ne sort JAMAIS par `onChange` : product-form compare l'état à son snapshot par JSON.
//
// `stockTouched` : le stock affiché date du chargement ; on ne le renvoie que s'il a été touché ici,
// pour ne pas écraser les décréments survenus depuis.
export type UiOption = SupplementOption & {
  uid: string;
  stockTouched: boolean;
};
export type UiGroup = Omit<SupplementGroup, 'options'> & {
  uid: string;
  options: UiOption[];
};

let uidSeq = 0;
function nextUid(): string {
  uidSeq += 1;
  return `s${uidSeq}`;
}

export function toUiGroup(g: SupplementGroup): UiGroup {
  return {
    ...g,
    uid: nextUid(),
    options: g.options.map((o) => ({
      ...o,
      uid: nextUid(),
      stockTouched: false,
    })),
  };
}

// `toCanonicalGroup` recopie les champs un par un (aucune fuite de `uid`, ordre des clés stable pour le snapshot JSON).
// Le stock n'est envoyé que si `stockTouched` ; sinon `undefined` = « ne pas toucher » (`syncSupplementGroups`).
export function fromUiGroup(g: UiGroup): SupplementGroup {
  return {
    ...toCanonicalGroup(g),
    options: g.options.map((o) => ({
      name: o.name,
      price: o.price,
      available: o.available,
      stockQuantity: o.stockTouched ? o.stockQuantity : undefined,
    })),
  };
}

export function emptyGroup(): UiGroup {
  return {
    uid: nextUid(),
    name: '',
    type: 'single',
    required: false,
    available: true,
    minSelect: null,
    maxSelect: null,
    options: [emptyOption()],
  };
}

export function emptyOption(): UiOption {
  return {
    uid: nextUid(),
    name: '',
    price: 0,
    available: true,
    stockQuantity: null,
    // Option neuve : rien à écraser en base ; `true` évite de perdre un stock saisi puis « non touché » (ex. ligne dupliquée).
    stockTouched: true,
  };
}
