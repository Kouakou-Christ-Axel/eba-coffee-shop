import { createLoader, type SearchParams } from 'nuqs/server';
import {
  parseDateOnlyToUTC,
  startOfMonthDateString,
  todayDateString,
} from '@/lib/timezone';
import { jekoParsers } from './search-params';

const loadJekoSearchParams = createLoader(jekoParsers);

/**
 * Compte et plage de la page Jèko. Défaut : tous les comptes, du 1er du mois à
 * aujourd'hui (le plafond de Jèko est mensuel). `range=all` : l'appelant résout
 * la borne basse (première date connue), `fromStr` vaut alors le 1er du mois.
 */
export function parseJekoSearchParams(params: SearchParams) {
  const raw = loadJekoSearchParams(params);
  const today = todayDateString();
  const isAll = raw.range === 'all';
  const defaultFrom = startOfMonthDateString(today);

  let fromStr = defaultFrom;
  let toStr = today;
  if (!isAll) {
    if (parseDateOnlyToUTC(raw.from ?? undefined)) fromStr = raw.from!;
    if (parseDateOnlyToUTC(raw.to ?? undefined)) toStr = raw.to!;
    if (fromStr > toStr) [fromStr, toStr] = [toStr, fromStr];
  }
  return { account: raw.account, isAll, today, fromStr, toStr };
}
