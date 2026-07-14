import { listInventoryCounts, listRestockBatches } from '@/lib/inventory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CountHistory } from '../count-history';
import { RestockBatches } from '../restock-batches';

export async function HistorySection() {
  const [counts, batches] = await Promise.all([
    listInventoryCounts(),
    listRestockBatches(),
  ]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique des comptages</CardTitle>
        </CardHeader>
        <CardContent>
          <CountHistory counts={counts} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Réapprovisionnements</CardTitle>
        </CardHeader>
        <CardContent>
          <RestockBatches batches={batches} />
        </CardContent>
      </Card>
    </>
  );
}
