'use client';

import { Bike, CheckCheck, ChefHat, Loader2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { priceFormatter } from '@/config/menu';
import { orderRef } from '@/lib/orders/customer-groups';
import type { TabKey } from '../../urgency';
import type { GroupActions } from './use-group-actions';

const spinner = <Loader2 className="mr-2 h-5 w-5 animate-spin" />;

/** Actions en lot, propres à l'onglet : on ne propose que la prochaine étape du groupe. */
export function GroupActionsBar({
  tab,
  actions,
}: {
  tab: TabKey;
  actions: GroupActions;
}) {
  const {
    summary: s,
    pendingAction,
    isPending,
    setIsPayOpen,
    handleMarkAllReady,
    handleCompleteAll,
    handleRequestDriverAll,
    driverLink,
    driver,
    withoutDriver,
    handleApplyDriver,
  } = actions;

  const showDriver =
    tab !== 'to-pay' && (s.driverTargets.length > 0 || s.deliveries.length > 0);
  const driverRequestedAll =
    s.deliveries.length > 0 && s.driverTargets.length === 0;

  const driverTone =
    'w-full border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/50 dark:text-amber-100';

  return (
    <div className="mt-3 flex flex-col gap-2">
      {tab === 'to-pay' && s.payable.length > 0 && (
        <Button
          type="button"
          size="lg"
          className="h-14 w-full text-base"
          disabled={isPending}
          onClick={() => setIsPayOpen(true)}
        >
          {pendingAction === 'pay' ? (
            spinner
          ) : (
            <Wallet className="mr-2 h-5 w-5" />
          )}
          Encaisser tout ({priceFormatter.format(s.amountToPay)} F)
        </Button>
      )}

      {tab === 'to-pay' && s.blockedByDeposit.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Acompte requis avant encaissement, à traiter commande par commande :{' '}
          {s.blockedByDeposit.map(orderRef).join(', ')}
        </p>
      )}

      {tab === 'in-progress' && s.preparing.length > 0 && (
        <Button
          type="button"
          size="lg"
          className="h-14 w-full text-base"
          disabled={isPending}
          onClick={handleMarkAllReady}
        >
          {pendingAction === 'ready' ? (
            spinner
          ) : (
            <ChefHat className="mr-2 h-5 w-5" />
          )}
          Tout marquer prêt ({s.preparing.length})
        </Button>
      )}

      {showDriver &&
        (driverRequestedAll ? (
          <p className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <Bike className="h-4 w-4" aria-hidden />
            Livreur demandé pour tout le groupe
          </p>
        ) : driverLink ? (
          <Button asChild variant="outline" size="lg" className={driverTone}>
            <a
              href={driverLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                if (!isPending) handleRequestDriverAll();
              }}
            >
              <Bike className="mr-1.5 h-4 w-4" />
              Demander le livreur ({s.driverTargets.length}{' '}
              {s.driverTargets.length > 1 ? 'commandes' : 'commande'})
            </a>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className={driverTone}
            disabled={isPending}
            onClick={handleRequestDriverAll}
          >
            <Bike className="mr-1.5 h-4 w-4" />
            Demander le livreur ({s.driverTargets.length})
          </Button>
        ))}

      {showDriver && driver && withoutDriver.length > 0 && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isPending}
          onClick={handleApplyDriver}
        >
          Même livreur ({driver.name}) pour {withoutDriver.length} autre
          {withoutDriver.length > 1 ? 's' : ''}
        </Button>
      )}

      {tab === 'ready' && s.handable.length > 0 && (
        <Button
          type="button"
          size="lg"
          className="h-14 w-full text-base"
          disabled={isPending}
          onClick={() => void handleCompleteAll()}
        >
          {pendingAction === 'complete' ? (
            spinner
          ) : (
            <CheckCheck className="mr-2 h-5 w-5" />
          )}
          Tout marquer récupéré ({s.handable.length}/{s.total})
        </Button>
      )}
    </div>
  );
}
