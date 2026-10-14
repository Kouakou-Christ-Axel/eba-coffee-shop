/**
 * Une couleur stable par client groupé, pour reconnaître d'un coup d'œil les
 * tickets qui partent ensemble. Volontairement hors vert / orange / rouge /
 * indigo : ces teintes portent déjà le sens (prête, à encaisser, en retard,
 * programmée) et ne doivent pas être confondues avec un groupe.
 */
const PALETTE = [
  {
    border: 'border-violet-400 dark:border-violet-600',
    bg: 'bg-violet-50/70 dark:bg-violet-950/25',
    chip: 'bg-violet-600 text-white',
  },
  {
    border: 'border-sky-400 dark:border-sky-600',
    bg: 'bg-sky-50/70 dark:bg-sky-950/25',
    chip: 'bg-sky-600 text-white',
  },
  {
    border: 'border-fuchsia-400 dark:border-fuchsia-600',
    bg: 'bg-fuchsia-50/70 dark:bg-fuchsia-950/25',
    chip: 'bg-fuchsia-600 text-white',
  },
  {
    border: 'border-cyan-400 dark:border-cyan-600',
    bg: 'bg-cyan-50/70 dark:bg-cyan-950/25',
    chip: 'bg-cyan-700 text-white',
  },
] as const;

export function groupColor(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
