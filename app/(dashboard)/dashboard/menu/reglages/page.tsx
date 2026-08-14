import { getMenuSettings } from '@/lib/menu-settings-db';
import { MenuPdfField } from './menu-pdf-field';

// Page d'administration : données live, jamais prérendue. Même convention que
// les autres pages de la section menu.
export const dynamic = 'force-dynamic';

// La carte PDF vivait en tête de `/dashboard/menu`, au-dessus des catégories.
// C'est un réglage qu'on touche deux fois par an, posé sur le chemin de la
// tâche quotidienne (gérer catégories et produits) : il repoussait la liste
// sous la ligne de flottaison sans jamais rien apporter. Il a donc sa page.
export default async function MenuSettingsPage() {
  const menuSettings = await getMenuSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Menu — Réglages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          La carte au format PDF proposée au téléchargement sur le site public.
          Elle ne remplace pas le menu en ligne : les catégories et produits
          restent la source de ce que les clients commandent.
        </p>
      </div>

      <MenuPdfField initialUrl={menuSettings.menuPdfUrl} />
    </div>
  );
}
