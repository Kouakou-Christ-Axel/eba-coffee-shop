export function AdvanceOrderNotice({
  minAdvanceOrderDays,
  precommandePure,
  soldOutRestricted,
}: {
  minAdvanceOrderDays: number;
  precommandePure: boolean;
  soldOutRestricted: boolean;
}) {
  if (minAdvanceOrderDays <= 0) return null;
  if (precommandePure) {
    return (
      <p className="text-xs text-foreground/60">
        Choisis ton heure de retrait pour demain.
      </p>
    );
  }
  if (soldOutRestricted) {
    return (
      <p className="text-xs text-foreground/60">
        Un article de votre panier est épuisé aujourd&apos;hui : il sera préparé
        pour le jour que vous choisissez, à partir de demain.
      </p>
    );
  }
  return (
    <p className="text-xs text-foreground/60">
      Un article de votre panier doit être commandé au moins{' '}
      {minAdvanceOrderDays} jour
      {minAdvanceOrderDays > 1 ? 's' : ''} à l&apos;avance.
    </p>
  );
}

export function ScheduleRestrictedNotice() {
  return (
    <p className="text-xs text-foreground/60">
      Un article de votre panier n&apos;est disponible que certains jours — les
      autres sont masqués ci-dessous.
    </p>
  );
}
