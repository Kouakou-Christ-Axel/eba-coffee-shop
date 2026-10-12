export function CountProgress({
  entered,
  total,
}: {
  entered: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((entered / total) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium tabular-nums" aria-live="polite">
          {entered} / {total} comptées
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {pct} %
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
