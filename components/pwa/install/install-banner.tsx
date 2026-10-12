import { Button } from '@heroui/react';
import { IconDeviceMobile, IconDownload, IconX } from '@tabler/icons-react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';

export function InstallBanner({
  visible,
  onInstall,
  onDismiss,
}: {
  visible: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const initial = reduceMotion ? false : { y: 120, opacity: 0 };
  const animate = reduceMotion ? {} : { y: 0, opacity: 1 };
  const exit = reduceMotion ? {} : { y: 120, opacity: 0 };

  return (
    <AnimatePresence>
      {visible && (
        <m.div
          initial={initial}
          animate={animate}
          exit={exit}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
          role="dialog"
          aria-label="Installer l'application EBA Coffee Shop"
        >
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-large border border-default-200 bg-background/95 p-3 shadow-lg backdrop-blur">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-medium bg-primary/10 text-primary">
              <IconDeviceMobile size={24} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                Installer l&apos;app EBA
              </p>
              <p className="truncate text-xs text-default-500">
                Accès rapide depuis votre écran d&apos;accueil.
              </p>
            </div>
            <Button
              color="primary"
              size="sm"
              radius="md"
              startContent={<IconDownload size={16} aria-hidden />}
              onPress={onInstall}
            >
              Installer
            </Button>
            <Button
              isIconOnly
              size="sm"
              radius="full"
              variant="light"
              aria-label="Fermer"
              onPress={onDismiss}
            >
              <IconX size={16} aria-hidden />
            </Button>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
