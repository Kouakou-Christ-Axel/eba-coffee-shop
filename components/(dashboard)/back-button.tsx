'use client';

// Bouton « Retour » qui revient réellement en arrière (router.back), en
// conservant le contexte (filtres, page, scroll) de l'écran précédent. Retombe
// sur `fallbackHref` en cas de chargement direct / nouvel onglet (pas d'historique).

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  fallbackHref: string;
  label?: string;
  className?: string;
};

export function BackButton({
  fallbackHref,
  label = 'Retour',
  className,
}: Props) {
  const router = useRouter();

  function handleClick() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={className}
    >
      <ArrowLeft className="mr-1 h-4 w-4" />
      {label}
    </Button>
  );
}
