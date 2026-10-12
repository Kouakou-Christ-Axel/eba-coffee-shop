import { Bike, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getOrderProgress } from '@/lib/orders/progress';
import type { CashierOrder } from '@/lib/cashier-queue';

/** Fil d'Ariane du parcours : Reçue → En cuisine → Prête → Récupérée. */
export function OrderProgress({ order }: { order: CashierOrder }) {
  const { steps, cancelled } = getOrderProgress(order);
  const showDriver = order.orderType === 'DELIVERY' && order.driverRequested;
  return (
    <ol
      aria-label="Progression de la commande"
      className={cn('mt-3 flex items-start', cancelled && 'opacity-50')}
    >
      {steps.map((step, i) => (
        <li
          key={step.key}
          aria-current={step.state === 'current' ? 'step' : undefined}
          className="relative flex min-w-0 flex-1 flex-col items-center gap-1"
        >
          {i > 0 && (
            <span
              aria-hidden="true"
              className={cn(
                'absolute top-2.5 right-1/2 h-0.5 w-full -translate-y-1/2 transition-colors motion-reduce:transition-none',
                step.state === 'todo' ? 'bg-border' : 'bg-primary'
              )}
            />
          )}
          <span
            className={cn(
              'relative flex h-5 w-5 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-colors motion-reduce:transition-none',
              step.state === 'done' &&
                'border-primary bg-primary text-primary-foreground',
              step.state === 'current' &&
                'border-primary bg-background text-primary ring-4 ring-primary/20',
              step.state === 'todo' &&
                'border-border bg-background text-muted-foreground'
            )}
          >
            {step.state === 'done' ? (
              <Check className="h-3 w-3" aria-hidden="true" />
            ) : (
              i + 1
            )}
          </span>
          <span
            className={cn(
              'max-w-full truncate text-[11px] leading-tight',
              step.state === 'current'
                ? 'font-bold text-foreground'
                : 'text-muted-foreground',
              cancelled && 'line-through'
            )}
          >
            {step.label}
          </span>
          {showDriver && step.key === 'PREPARING' && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
              <Bike className="h-3 w-3" aria-hidden="true" />
              Livreur
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
