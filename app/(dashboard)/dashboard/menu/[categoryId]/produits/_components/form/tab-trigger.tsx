import type { ReactNode } from 'react';
import { TabsTrigger } from '@/components/ui/tabs';
import type { TabValue } from '@/lib/menu/product-form-completeness';

/** Onglet avec pastille d'erreur (rouge, bloquante) ou d'avertissement (ambre) et mention « optionnel ». */
export function TabTrigger({
  value,
  hasError,
  hasWarning = false,
  optional = false,
  children,
}: {
  value: TabValue;
  hasError: boolean;
  hasWarning?: boolean;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    // `h-8` explicite : la hauteur native se résout contre la liste, passée en `auto` pour le repli.
    <TabsTrigger value={value} className="h-8 gap-1.5">
      {children}
      {optional && (
        <span className="text-xs font-normal text-muted-foreground">
          optionnel
        </span>
      )}
      {hasError ? (
        <span
          aria-label="contient une erreur"
          className="size-1.5 rounded-full bg-destructive"
        />
      ) : (
        hasWarning && (
          <span
            aria-label="contient un avertissement"
            className="size-1.5 rounded-full bg-amber-500"
          />
        )
      )}
    </TabsTrigger>
  );
}
