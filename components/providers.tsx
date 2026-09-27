'use client';
import React, { ReactNode, useEffect } from 'react';
import { HeroUIProvider } from '@heroui/react';
import { LazyMotion, domAnimation } from 'framer-motion';
import { markChunkLoadHealthy } from '@/lib/chunk-error';

// `LazyMotion` + `domAnimation` : le jeu de fonctionnalités RÉDUIT de Framer
// Motion, celui que HeroUI charge déjà pour ses propres transitions (navbar,
// modales, ripple des boutons). Sans ce provider, chaque `motion.div` de notre
// code tire à lui seul le bundle COMPLET — drag et layout animations compris,
// que le site vitrine n'utilise nulle part — en plus du jeu réduit de HeroUI.
// On payait donc les deux.
//
// La contrepartie : sous ce provider, on écrit `m.div` et non `motion.div`
// (cf. https://motion.dev/docs/react-reduce-bundle-size). `domAnimation` couvre
// `animate`, `exit`/`AnimatePresence`, `variants`, `whileInView`, `whileHover`,
// `whileTap`, `whileFocus` — soit tout ce qu'emploie le site public.
//
// Ce qu'il NE couvre PAS : `drag` et `layout`. Un composant qui en a besoin
// garde `motion` (il fonctionne toujours, il embarque simplement ses propres
// fonctionnalités) — c'est le cas de `carte/_components/portion-composer.tsx`,
// déjà isolé dans un chunk chargé à la demande, et des tables réordonnables du
// dashboard.
function Providers({ children }: { children: ReactNode }) {
  // Une page qui monte avec succès prouve que ses chunks sont bien servis :
  // on réarme la protection contre les boucles de rechargement (cf.
  // lib/chunk-error.ts) pour qu'un futur déploiement puisse de nouveau
  // déclencher un rechargement automatique sur `ChunkLoadError`.
  useEffect(() => {
    markChunkLoadHealthy();
  }, []);

  return (
    <LazyMotion features={domAnimation}>
      <HeroUIProvider>{children}</HeroUIProvider>
    </LazyMotion>
  );
}

export default Providers;
