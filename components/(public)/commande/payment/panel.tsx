'use client';

import { m, useReducedMotion } from 'framer-motion';

export function Panel({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <m.div
      key={id}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={className}
    >
      {children}
    </m.div>
  );
}

export const SUCCESS_BOX =
  'mt-4 flex items-center gap-3 rounded-lg bg-success/15 px-3 py-3';
export const SUCCESS_TEXT =
  'text-sm font-medium text-success-700 dark:text-success';
