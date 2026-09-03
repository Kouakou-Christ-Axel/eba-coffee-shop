'use client';

// components/(public)/carte/_components/closed-precommande-modal.tsx
//
// Popup « on est fermé » sur la carte publique : signale d'abord clairement
// la fermeture, puis pousse à précommander pour le prochain jour d'ouverture
// (retrait par défaut à DEFERRED_PICKUP_DEFAULT_TIME, 11h). Copie volontairement
// courte et un seul emoji — cible mobile, lecture en diagonale.
//
// Ne s'affiche QUE si la boutique est fermée À L'INSTANT (`/api/shop-status`,
// backé par `isShopOpenNow`) — jamais figé côté serveur (la page /carte est en
// ISR), pour ne pas rater le moment exact de l'ouverture/fermeture. Une seule
// apparition par jour fermé (clé localStorage datée) : re-fermer la page ne
// doit pas re-harceler le visiteur qui a déjà vu le message aujourd'hui.

import { useEffect, useState } from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react';
import { Moon } from 'lucide-react';
import { todayDateString } from '@/lib/timezone';
import { DEFERRED_PICKUP_DEFAULT_TIME } from '@/config/constants';

const SHOW_DELAY_MS = 1200;

function dismissedKey(): string {
  return `eba-closed-precommande-${todayDateString()}`;
}

export function ClosedPrecommandeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        if (localStorage.getItem(dismissedKey())) return;
        const res = await fetch('/api/shop-status');
        if (!res.ok) return;
        const data = (await res.json()) as { openNow: boolean };
        if (cancelled || data.openNow) return;
        setTimeout(() => {
          if (!cancelled) setOpen(true);
        }, SHOW_DELAY_MS);
      } catch {
        // Best-effort : une panne du endpoint ne doit jamais bloquer la carte.
      }
    }
    check();

    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    localStorage.setItem(dismissedKey(), '1');
    setOpen(false);
  }

  return (
    <Modal
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) dismiss();
      }}
      placement="center"
      backdrop="blur"
      size="sm"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col items-center gap-3 pt-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Moon className="h-6 w-6" />
          </span>
          On est fermé
        </ModalHeader>
        <ModalBody className="text-center">
          <p className="text-sm text-foreground/70">
            On est fermé pour l&apos;instant 🌙 — commande maintenant, on te
            prépare ça dès l&apos;ouverture, à partir de{' '}
            {DEFERRED_PICKUP_DEFAULT_TIME} !
          </p>
        </ModalBody>
        <ModalFooter className="pb-6">
          <Button color="primary" className="w-full" onPress={dismiss}>
            Voir la carte
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
