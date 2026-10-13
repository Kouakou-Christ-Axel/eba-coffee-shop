import { ClipboardList } from 'lucide-react';

export function StartPanel({
  total,
  onStart,
}: {
  total: number;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border p-8 text-center">
      <ClipboardList className="size-8 text-muted-foreground" />
      <div>
        <p className="font-medium">{total} références à compter</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Votre saisie est conservée sur cet appareil : vous pouvez verrouiller
          le téléphone et reprendre plus tard.
        </p>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="h-11 rounded-md bg-primary px-6 font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Commencer le comptage
      </button>
    </div>
  );
}
