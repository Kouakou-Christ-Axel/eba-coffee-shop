import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';

/** Libellé + contrôle + aide/erreur. */
export function Field({
  id,
  label,
  help,
  hint,
  error,
  required = false,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  /** Compteur discret aligné à droite du libellé (ex. « 42/120 »). */
  hint?: string;
  error?: string;
  /** Écrit en toutes lettres : l'astérisque supposerait une légende qui n'existe pas ici. */
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="gap-1.5">
          {label}
          <span
            className={
              required
                ? 'text-xs font-normal text-destructive'
                : 'text-xs font-normal text-muted-foreground'
            }
          >
            {required ? 'obligatoire' : 'optionnel'}
          </span>
        </Label>
        {hint && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      {children}
      {help && !error && (
        <p className="text-xs text-muted-foreground">{help}</p>
      )}
      {error && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
