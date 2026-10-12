import { cn } from '@/lib/utils';

export function Chip({
  active,
  onClick,
  label,
  done,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  done?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-10 shrink-0 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-muted',
        active &&
          'border-primary bg-primary/10 text-primary hover:bg-primary/15',
        !active && done && 'text-muted-foreground'
      )}
    >
      {label}
    </button>
  );
}
