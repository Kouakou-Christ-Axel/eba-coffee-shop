'use client';

import React from 'react';
import { Button, Link } from '@heroui/react';
import { IconLayoutDashboard } from '@tabler/icons-react';
import { motion, useReducedMotion } from 'framer-motion';
import { authClient } from '@/lib/auth-client';

// Mêmes rôles que la navbar (cf. components/layouts/navbar.tsx) : accès staff.
const DASHBOARD_ROLES = ['ADMIN', 'CASHIER', 'KITCHEN'];

/**
 * Bouton flottant d'accès au dashboard, visible uniquement sur mobile/tablette
 * (`lg:hidden`) où le bouton « Dashboard » de la navbar est masqué. Réservé au
 * staff connecté.
 */
export default function DashboardFab() {
  const reduceMotion = useReducedMotion();
  const { data: session } = authClient.useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const hasDashboardAccess = !!userRole && DASHBOARD_ROLES.includes(userRole);

  if (!hasDashboardAccess) return null;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-40 lg:hidden"
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
    </motion.div>
  );
}
