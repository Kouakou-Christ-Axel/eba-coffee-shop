'use client';

import React from 'react';
import { Button, Link } from '@heroui/react';
import { IconLayoutDashboard } from '@tabler/icons-react';
import { m, useReducedMotion } from 'framer-motion';

/**
 * Bouton flottant d'accès au dashboard, visible uniquement sous `xl` où le
 * bouton « Dashboard » de la navbar est masqué (cf. components/layouts/
 * navbar.tsx : à 1024 px la barre est déjà pleine). Réservé au staff connecté.
 *
 * Le composant ne sait plus RIEN de la session : c'est `DashboardFabMount` qui
 * décide de le monter, et qui ne l'importe qu'à ce moment-là. Sans quoi le
 * `@tabler/icons-react` de l'icône ci-dessous voyagerait dans le chunk du
 * layout public, pour un bouton qu'un visiteur anonyme ne voit jamais.
 */
export default function DashboardFab() {
  const reduceMotion = useReducedMotion();

  return (
    <m.div
      initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-40 xl:hidden"
    >
      <Button
        as={Link}
        href="/dashboard"
        color="primary"
        radius="full"
        size="lg"
        className="shadow-lg"
        startContent={<IconLayoutDashboard size={20} aria-hidden />}
        aria-label="Aller au dashboard"
      >
        Dashboard
      </Button>
    </m.div>
  );
}
