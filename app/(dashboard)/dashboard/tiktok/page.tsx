import { requireRoleOrAnalyst } from '@/lib/auth-helpers';
import { getTiktokVideosAdmin } from '@/lib/tiktok';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TiktokTable } from './tiktok-table';

export const dynamic = 'force-dynamic';

export default async function TiktokPage() {
  await requireRoleOrAnalyst(['ADMIN']);

  const videos = await getTiktokVideosAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vidéos TikTok</h1>
        <p className="text-sm text-muted-foreground">
          Gère les vidéos TikTok embarquées dans la section « Suivez
          l’aventure » de l’accueil.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Toutes les vidéos</CardTitle>
        </CardHeader>
        <CardContent>
          <TiktokTable videos={videos} />
        </CardContent>
      </Card>
    </div>
  );
}
