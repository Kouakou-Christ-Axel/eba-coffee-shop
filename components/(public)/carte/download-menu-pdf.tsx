'use client';

import React from 'react';
import { Button, Link } from '@heroui/react';
import { IconDownload, IconFileTypePdf, IconX } from '@tabler/icons-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

// Même principe que components/pwa/install-pwa.tsx : bannière flottante
// proposant une action, avec mémorisation du rejet (localStorage + TTL) pour
// ne pas re-solliciter l'utilisateur à chaque visite.

const DISMISS_KEY = 'eba-menu-pdf-dismissed';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours
const SHOW_DELAY_MS = 1500;

function wasRecentlyDismissed(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

type Props = {
  pdfUrl: string;
};

export default function DownloadMenuPdf({ pdfUrl }: Props) {
  const reduceMotion = useReducedMotion();
  const [showBanner, setShowBanner] = React.useState(false);

  React.useEffect(() => {
    if (wasRecentlyDismissed()) return;
    const delayTimer = setTimeout(() => setShowBanner(true), SHOW_DELAY_MS);
    return () => clearTimeout(delayTimer);
  }, []);

  const dismiss = React.useCallback(() => {
    setShowBanner(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
  }, []);

  const initial = reduceMotion ? false : { y: 120, opacity: 0 };
  const animate = reduceMotion ? {} : { y: 0, opacity: 1 };
  const exit = reduceMotion ? {} : { y: 120, opacity: 0 };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={initial}
          animate={animate}
          exit={exit}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          // Décalée au-dessus de `bottom-0` (au lieu d'y coller comme
          // components/pwa/install-pwa.tsx) pour éviter le chevauchement
          // exact si la bannière d'installation PWA (même position, même
          // z-index) s'affiche en même temps sur cette page.
          className="fixed inset-x-0 bottom-24 z-50 px-3 sm:px-4"
          role="dialog"
          aria-label="Télécharger la carte au format PDF"
        >
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-large border border-default-200 bg-background/95 p-3 shadow-lg backdrop-blur">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-medium bg-primary/10 text-primary">
              <IconFileTypePdf size={24} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                Notre carte en PDF
              </p>
              <p className="truncate text-xs text-default-500">
                Consultez-la hors ligne ou partagez-la facilement.
              </p>
            </div>
            <Button
              as={Link}
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              color="primary"
              size="sm"
              radius="md"
              startContent={<IconDownload size={16} aria-hidden />}
              onPress={dismiss}
            >
              Télécharger
            </Button>
            <Button
              isIconOnly
              size="sm"
              radius="full"
              variant="light"
              aria-label="Fermer"
              onPress={dismiss}
            >
              <IconX size={16} aria-hidden />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
