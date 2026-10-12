export const f = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

export type PaymentMethod = 'CASH' | 'WAVE' | 'BANK' | 'OTHER';

export const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'WAVE', label: 'Wave' },
  { value: 'BANK', label: 'Banque' },
  { value: 'OTHER', label: 'Autre' },
];

const dayFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
});

export function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return dayFmt.format(new Date(Date.UTC(y, m - 1, d)));
}

export type Line = {
  itemId: string;
  quantity: string;
  unitCost: string;
  /** Le coût vient d'un achat passé, pas d'une décision. Toute saisie l'efface. */
  costIsSuggestion: boolean;
};

export type LastCost = { unitCost: number; date: string };
