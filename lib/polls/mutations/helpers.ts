/** Les dates sont des ISO string dans les schémas (JSON Schema MCP) : converties ici, à l'écriture. */
export function toDateOrNull(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}
