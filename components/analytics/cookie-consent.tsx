'use client';

// components/analytics/cookie-consent.tsx
//
// Bannière de consentement cookies (RGPD). Décalque volontaire de
// components/pwa/install-pwa.tsx : même ancrage `fixed bottom`, mêmes
// composants HeroUI, même respect de `prefers-reduced-motion`, même
// enregistrement auprès de `bottom-banner-store` pour que le bouton panier
// flottant de /carte se décale au lieu d'être recouvert.
//
// N'est montée que si NEXT_PUBLIC_GTM_ID est configuré (cf. app/(public)/layout.tsx) :
// sans conteneur, rien n'est chargé et il n'y a rien à faire consentir.

import React from 'react';
import NextLink from 'next/link';
import { Button } from '@heroui/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { IconCookie } from '@tabler/icons-react';
import { useBottomBannerStore } from '@/lib/bottom-banner-store';
import { useConsentStore } from '@/lib/consent-store';
import { readConsentStatus, writeConsent } from '@/lib/consent-storage';
import { updateConsent } from '@/lib/analytics';

export function CookieConsent() {
  const reduceMotion = useReducedMotion();
  const status = useConsentStore((s) => s.status);
  const setStatus = useConsentStore((s) => s.setStatus);
  const setPrompting = useConsentStore((s) => s.setPrompting);
  // Le choix vit dans localStorage : illisible au rendu serveur. On ne rend
  // donc rien avant le premier effet, sinon mismatch d'hydratation (même garde
  // que checkout-page.tsx via useCartHydration).
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setStatus(readConsentStatus());
    setMounted(true);
  }, [setStatus]);

  const isVisible = mounted && status === 'pending';

  // Signale aux autres bandeaux « fixed bottom » (installation PWA, carte PDF)
  // qu'ils doivent s'effacer, et au bouton panier flottant qu'il doit remonter.
  React.useEffect(() => {
    setPrompting(isVisible);
    useBottomBannerStore.getState().setVisible('cookie-consent', isVisible);
    return () => {
      setPrompting(false);
      useBottomBannerStore.getState().setVisible('cookie-consent', false);
    };
  }, [isVisible, setPrompting]);

  const decide = React.useCallback(
    (accepted: boolean) => {
      writeConsent(accepted);
      updateConsent(accepted);
      setStatus(accepted ? 'granted' : 'denied');
    },
    [setStatus]
  );

  const initial = reduceMotion ? false : { y: 120, opacity: 0 };
  const animate = reduceMotion ? {} : { y: 0, opacity: 1 };
  const exit = reduceMotion ? {} : { y: 120, opacity: 0 };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={initial}
          animate={animate}
          exit={exit}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
          role="dialog"
          aria-live="polite"
          aria-label="Consentement aux cookies de mesure d'audience"
        >
          <div className="mx-auto flex max-w-2xl flex-col gap-3 rounded-large border border-default-200 bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-medium bg-primary/10 text-primary">
              <IconCookie size={24} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                On peut mesurer votre visite&nbsp;?
              </p>
              <p className="mt-0.5 text-xs text-default-500">
                Ces statistiques anonymes nous aident à améliorer la carte et le
                site. Rien n&apos;est déposé sans votre accord.{' '}
                <NextLink
                  href="/cookies"
                  className="underline underline-offset-2 transition-colors hover:text-primary"
                >
                  En savoir plus
                </NextLink>
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                radius="md"
                variant="bordered"
                onPress={() => decide(false)}
              >
                Refuser
              </Button>
              <Button
                color="primary"
                size="sm"
                radius="md"
                onPress={() => decide(true)}
              >
                Tout accepter
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CookieConsent;
