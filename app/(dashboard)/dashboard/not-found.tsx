import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border bg-card py-16 text-center">
      <div className="rounded-full bg-muted p-6">
        <FileQuestion className="h-12 w-12 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Cette page du tableau de bord n&apos;existe pas ou plus.
      </p>
      <Button asChild variant="outline">
        <Link href="/dashboard">Retour au tableau de bord</Link>
      </Button>
    </div>
  );
}
