import { cn } from '@/lib/utils';

/**
 * Message « aucune donnée » d'un graphe.
 *
 * Vit dans le wrapper (et non dans l'implémentation) pour qu'un graphe vide
 * ne déclenche pas le téléchargement du chunk `recharts`.
 */
export function ChartEmpty({
  className,
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center px-4 text-center text-sm text-muted-foreground',
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}
