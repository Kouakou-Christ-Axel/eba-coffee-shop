export function Mini({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-2 text-lg font-bold tabular-nums ${alert ? 'text-destructive' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}
