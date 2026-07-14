import { Download, FileSpreadsheet } from 'lucide-react';
import { listExpenseCategories } from '@/lib/expenses';
import { Button } from '@/components/ui/button';
import { ImportDialog } from '../import-dialog';

export async function ToolbarSection() {
  const expenseCats = await listExpenseCategories();
  const expenseCategories = expenseCats.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <a href="/api/export/inventory">
          <Download className="mr-1.5 h-4 w-4" />
          Exporter Excel
        </a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href="/api/inventory/import-template">
          <FileSpreadsheet className="mr-1.5 h-4 w-4" />
          Modèle d&apos;import
        </a>
      </Button>
      <ImportDialog expenseCategories={expenseCategories} />
    </div>
  );
}
