'use client';

// Barre d'action fixe, même patron que `caisse/new/_components/order-bottom-bar.tsx`
// (le parent réserve la place avec `pb-28`). Sur téléphone, le clavier numérique
// couvre le bas de l'écran : la barre doit rester atteignable sans scroller, et
// respecter la zone système.

export function CountBottomBar({
  entered,
  total,
  disabled,
  onValidate,
}: {
  entered: number;
  total: number;
  disabled: boolean;
  onValidate: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur">
      <button
        type="button"
        onClick={onValidate}
        disabled={disabled}
        className="flex h-12 w-full items-center justify-between rounded-md bg-primary px-4 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        <span>Valider l&apos;inventaire</span>
        <span className="tabular-nums">
          {entered} / {total}
        </span>
      </button>
    </div>
  );
}
