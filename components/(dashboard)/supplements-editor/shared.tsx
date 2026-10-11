import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

/**
 * Interrupteur sur une ligne bordée (cible tactile large). `Label` et `Switch` sont frères :
 * imbriquer le `Switch` (un `<button role="switch">`) dans un `<label>` provoquerait une double bascule.
 */
export function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 sm:min-h-9">
      <Label htmlFor={id} className="cursor-pointer font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
