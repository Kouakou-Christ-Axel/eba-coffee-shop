'use client';

import { AlertTriangle } from 'lucide-react';
import { pickFirstCriticalTab, type TabKey } from '../urgency';

type Props = {
  counts: Record<TabKey, { total: number; critical: number }>;
  activeTab: TabKey;
  onSeeClick: () => void;
};

export function AlertBanner({ counts, activeTab, onSeeClick }: Props) {
  const parts: string[] = [];
  if (counts['to-pay'].critical > 0)
    parts.push(`${counts['to-pay'].critical} à encaisser`);
  if (counts.ready.critical > 0)
    parts.push(
      `${counts.ready.critical} prête${counts.ready.critical > 1 ? 's' : ''}`
    );
  if (counts['in-progress'].critical > 0)
    parts.push(`${counts['in-progress'].critical} en cours`);

  const targetCriticals: Record<TabKey, number> = {
    'to-pay': counts['to-pay'].critical,
    'in-progress': counts['in-progress'].critical,
    ready: counts.ready.critical,
  };
  const target = pickFirstCriticalTab(targetCriticals);
  const showSeeButton = target !== null && target !== activeTab;

  return (
    <div
      role="alert"
      className="animate-in slide-in-from-top-2 fade-in-0 flex items-center gap-2 rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
    >
      <AlertTriangle
        className="h-5 w-5 shrink-0 animate-pulse"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold">Action urgente</p>
        <p className="text-xs">{parts.join(' · ')} ont dépassé le seuil</p>
      </div>
      {showSeeButton && (
        <button
          type="button"
          onClick={onSeeClick}
          className="shrink-0 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700"
        >
          Voir
        </button>
      )}
    </div>
  );
}
