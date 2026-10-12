import React from 'react';
import { useDisclosure } from '@heroui/react';
import { useBottomBannerStore } from '@/lib/bottom-banner-store';
import { useIsConsentPrompting } from '@/lib/consent-store';
import {
  SHOW_DELAY_MS,
  detectPlatform,
  isStandalone,
  markDismissed,
  wasRecentlyDismissed,
  type BeforeInstallPromptEvent,
  type Platform,
} from './platform';

export function useInstallPwa() {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [platform, setPlatform] = React.useState<Platform>('unknown');
  const [showBanner, setShowBanner] = React.useState(false);
  const deferredPromptRef = React.useRef<BeforeInstallPromptEvent | null>(null);
  // La bannière cookies passe en premier : seul l'affichage attend, la
  // capture de `beforeinstallprompt` continue.
  const consentPrompting = useIsConsentPrompting();

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
      if (delayTimer) clearTimeout(delayTimer);
    };

    // Quand l'app est installée, on masque tout.
    const onInstalled = () => {
      setShowBanner(false);
      onOpenChange(); // ferme la modale si ouverte
      markDismissed();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // iOS ne déclenche jamais `beforeinstallprompt`, et Android peut ne jamais
    // l'émettre (navigateur in-app, heuristiques…) : instructions manuelles
    // après un court délai.
    if (detected === 'ios' || detected === 'android') {
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
    markDismissed();
  }, []);

  const isBannerVisible = showBanner && !consentPrompting;

  // Décale le bouton panier flottant (/carte) au-dessus du bandeau.
  React.useEffect(() => {
    useBottomBannerStore.getState().setVisible('pwa-install', isBannerVisible);
    return () =>
      useBottomBannerStore.getState().setVisible('pwa-install', false);
  }, [isBannerVisible]);

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
    if (outcome === 'dismissed') markDismissed();
  }, [platform, onOpen]);

  return {
    isOpen,
    onOpenChange,
    platform,
    isBannerVisible,
    dismiss,
    handleInstallClick,
  };
}
