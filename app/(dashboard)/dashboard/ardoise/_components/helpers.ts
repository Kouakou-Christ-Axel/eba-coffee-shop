import { startOfDay } from 'date-fns';

export const priceFmt = new Intl.NumberFormat('fr-FR');
export const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Libellés des statuts « en cours » (même convention locale que /dashboard/clients/[id]). */
export const IN_FLIGHT_LABELS: Record<string, string> = {
  NEW: 'Nouvelle',
  PREPARING: 'En cours',
  READY: 'Prête',
};

/** Ancienneté d'une dette, en français court : « aujourd'hui », « 3 jours ». */
export function formatDebtAge(from: Date, now: Date): string {
  const days = Math.floor(
    (startOfDay(now).getTime() - startOfDay(from).getTime()) / 86_400_000
  );
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 31) return `il y a ${days} jours`;
  const months = Math.floor(days / 30);
  return `il y a ${months} mois`;
}
