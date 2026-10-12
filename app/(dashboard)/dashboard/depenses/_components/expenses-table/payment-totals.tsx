import { priceFmt } from './format';

export function PaymentTotals({
  byPaymentMethod,
  total,
}: {
  byPaymentMethod: [string, number][];
  total: number;
}) {
  return (
    <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {byPaymentMethod.map(([label, amount]) => (
          <span key={label}>
            {label} :{' '}
            <span className="font-medium tabular-nums text-foreground">
              {priceFmt.format(amount)} F
            </span>
          </span>
        ))}
      </div>
      <div className="flex justify-end gap-2 text-sm">
        <span className="text-muted-foreground">Total :</span>
        <span className="font-bold tabular-nums">
          {priceFmt.format(total)} F
        </span>
      </div>
    </div>
  );
}
