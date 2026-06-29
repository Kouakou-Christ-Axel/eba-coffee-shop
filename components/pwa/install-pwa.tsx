'use client';

import React from 'react';
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  useDisclosure,
} from '@heroui/react';
import {
  IconDownload,
  IconShare3,
  IconSquareRoundedPlus,
  IconDotsVertical,
  IconX,
  IconDeviceMobile,
} from '@tabler/icons-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

// Événement non standard exposé par Chromium pour l'installation des PWA.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'eba-pwa-install-dismissed';
// On ne re-propose pas l'installation avant ce délai après un rejet.
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours
const SHOW_DELAY_MS = 4000;

type Platform = 'android' | 'ios' | 'desktop' | 'unknown';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  const isIpadOS =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iphone|ipad|ipod/.test(ua) || isIpadOS) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

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

export default function InstallPwa() {
  const reduceMotion = useReducedMotion();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [platform, setPlatform] = React.useState<Platform>('unknown');
  const [showBanner, setShowBanner] = React.useState(false);
  const deferredPromptRef = React.useRef<BeforeInstallPromptEvent | null>(null);

  // Enregistrement du service worker (une seule fois).
  React.useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silencieux : un échec d'enregistrement ne doit pas casser l'app.
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  React.useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;

    const detected = detectPlatform();
    setPlatform(detected);

    let delayTimer: ReturnType<typeof setTimeout> | undefined;

    // Android / desktop Chromium : on capture l'invite native.
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      setShowBanner(true);
    };

    // Quand l'app est installée, on masque tout.
    const onInstalled = () => {
      setShowBanner(false);
      onOpenChange(); // ferme la modale si ouverte
      try {
        window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        /* noop */
      }
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // iOS ne déclenche pas `beforeinstallprompt` : on affiche la bannière
    // tuto après un court délai pour ne pas gêner l'arrivée sur le site.
    if (detected === 'ios') {
      delayTimer = setTimeout(() => setShowBanner(true), SHOW_DELAY_MS);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      if (delayTimer) clearTimeout(delayTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = React.useCallback(() => {
    setShowBanner(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
  }, []);

  const handleInstallClick = React.useCallback(async () => {
    // iOS : pas d'API d'installation → on ouvre le tutoriel.
    if (platform === 'ios' || !deferredPromptRef.current) {
      onOpen();
      return;
    }
    const promptEvent = deferredPromptRef.current;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    deferredPromptRef.current = null;
    setShowBanner(false);
    if (outcome === 'dismissed') {
      try {
        window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        /* noop */
      }
    }
  }, [platform, onOpen]);

  const initial = reduceMotion ? false : { y: 120, opacity: 0 };
  const animate = reduceMotion ? {} : { y: 0, opacity: 1 };
  const exit = reduceMotion ? {} : { y: 120, opacity: 0 };

  return (
    <>
      <AnimatePresence>
        {showBanner && (
          <motion.div
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
                onPress={handleInstallClick}
              >
                Installer
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

      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        placement="center"
        backdrop="blur"
        scrollBehavior="inside"
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Installer EBA Coffee Shop
                <span className="text-sm font-normal text-default-500">
                  {platform === 'ios'
                    ? 'Sur iPhone / iPad avec Safari'
                    : 'Sur votre appareil'}
                </span>
              </ModalHeader>
              <ModalBody className="pb-6">
                {platform === 'ios' ? (
                  <IosSteps />
                ) : platform === 'android' ? (
                  <AndroidSteps />
                ) : (
                  <DesktopSteps />
                )}
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}

function Step({
  index,
  icon,
  children,
}: {
  index: number;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {index}
      </span>
      <span className="flex flex-wrap items-center gap-1.5 pt-0.5 text-sm text-foreground">
        {children}
        {icon}
      </span>
    </li>
  );
}

function IosSteps() {
  return (
    <ol className="space-y-4">
      <Step
        index={1}
        icon={<IconShare3 size={18} className="text-primary" aria-hidden />}
      >
        Ouvrez le site dans <strong>Safari</strong>, puis touchez le bouton
        <strong>Partager</strong>
      </Step>
      <Step
        index={2}
        icon={
          <IconSquareRoundedPlus
            size={18}
            className="text-primary"
            aria-hidden
          />
        }
      >
        Faites défiler et choisissez{' '}
        <strong>« Sur l&apos;écran d&apos;accueil »</strong>
      </Step>
      <Step index={3}>
        Touchez <strong>Ajouter</strong> en haut à droite. L&apos;icône EBA
        apparaît sur votre écran d&apos;accueil&nbsp;!
      </Step>
    </ol>
  );
}

function AndroidSteps() {
  return (
    <ol className="space-y-4">
      <Step
        index={1}
        icon={
          <IconDotsVertical size={18} className="text-primary" aria-hidden />
        }
      >
        Dans <strong>Chrome</strong>, touchez le menu (les trois points en haut
        à droite)
      </Step>
      <Step index={2}>
        Choisissez <strong>« Installer l&apos;application »</strong> (ou «
        Ajouter à l&apos;écran d&apos;accueil »)
      </Step>
      <Step index={3}>
        Confirmez avec <strong>Installer</strong>. L&apos;app EBA apparaît avec
        vos autres applications&nbsp;!
      </Step>
    </ol>
  );
}

function DesktopSteps() {
  return (
    <ol className="space-y-4">
      <Step
        index={1}
        icon={<IconDownload size={18} className="text-primary" aria-hidden />}
      >
        Dans la barre d&apos;adresse (Chrome / Edge), cliquez sur l&apos;icône
        d&apos;installation
      </Step>
      <Step index={2}>
        Cliquez sur <strong>Installer</strong> dans la fenêtre qui apparaît.
      </Step>
      <Step index={3}>
        EBA s&apos;ouvre alors dans sa propre fenêtre, comme une application.
      </Step>
    </ol>
  );
}
