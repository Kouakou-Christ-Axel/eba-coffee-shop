'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Le panneau (et son code) ne se charge qu'à la première ouverture.
const AssistantPanel = dynamic(() => import('./assistant-panel'), {
  ssr: false,
});

/** Bouton discret de l'en-tête (pas de bouton flottant). Raccourci : Ctrl/Cmd+K. */
export function AssistantButton() {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  const toggle = React.useCallback((value: boolean) => {
    setMounted(true);
    setOpen(value);
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggle(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Ouvrir l'assistant"
        title="Assistant (Ctrl+K)"
        className="size-11"
        onClick={() => toggle(true)}
      >
        <Sparkles className="text-primary" />
      </Button>
      {mounted && <AssistantPanel open={open} onOpenChange={setOpen} />}
    </>
  );
}
