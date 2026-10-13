import { priceFmt } from './format';

export function InvestmentTotals({
  total,
  totalOutstanding,
}: {
  total: number;
  totalOutstanding: number;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm">
      {totalOutstanding > 0 && (
        <span className="text-muted-foreground">
          Restant dû :{' '}
          <span className="font-semibold tabular-nums text-foreground">
            {priceFmt.format(totalOutstanding)} F
          </span>
        </span>
      )}
      <span className="text-muted-foreground">
        Total investi :{' '}
        <span className="font-bold tabular-nums text-foreground">
          {priceFmt.format(total)} F
        </span>
      </span>
    </div>
  );
}
