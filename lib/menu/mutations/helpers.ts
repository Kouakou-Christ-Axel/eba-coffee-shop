export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Trie et dédoublonne une liste de jours (0..6) — évite les doublons/ordre
// arbitraire en base pour `ProductSchedule.days`.
export function dedupeDays(days: number[]): number[] {
  return [...new Set(days)].sort((a, b) => a - b);
}

export function assertSameSet(
  orderedIds: string[],
  currentIds: string[],
  what: string
) {
  const ordered = new Set(orderedIds);
  if (
    ordered.size !== orderedIds.length ||
    ordered.size !== currentIds.length ||
    currentIds.some((id) => !ordered.has(id))
  ) {
    throw new Error(
      `La liste des ${what} a changé entre-temps. Rechargez la page avant de réordonner.`
    );
  }
}
