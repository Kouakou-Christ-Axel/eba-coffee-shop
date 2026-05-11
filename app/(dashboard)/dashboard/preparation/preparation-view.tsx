'use client';

import { useState, useEffect, useTransition, useCallback, useRef } from 'react';
import { format, formatDistanceToNowStrict, isPast, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bell, BellOff, Check, X, Clock, Phone, StickyNote } from 'lucide-react';
import {
  getPreparationQueue,
  markOrderReady,
  cancelOrderFromKitchen,
  type PreparationOrder,
} from './actions';

const POLL_INTERVAL_MS = 20_000;
const SOUND_STORAGE_KEY = 'eba.preparation.sound-enabled';

const priceFormatter = new Intl.NumberFormat('fr-FR');

function playNewOrderChime() {
  if (typeof window === 'undefined') return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const notes: Array<{ freq: number; start: number; duration: number }> = [
    { freq: 880, start: 0, duration: 0.18 },
    { freq: 1318.51, start: 0.2, duration: 0.18 },
    { freq: 880, start: 0.55, duration: 0.18 },
    { freq: 1318.51, start: 0.75, duration: 0.3 },
  ];
  const now = ctx.currentTime;
  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = note.freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const startAt = now + note.start;
    const endAt = startAt + note.duration;
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(0.25, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
    osc.start(startAt);
    osc.stop(endAt + 0.05);
  }
  setTimeout(() => ctx.close(), 1500);
}

export function PreparationView({
  initialQueue,
}: {
  initialQueue: PreparationOrder[];
}) {
  const [queue, setQueue] = useState<PreparationOrder[]>(initialQueue);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [lastSync, setLastSync] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const knownIdsRef = useRef<Set<string>>(
    new Set(initialQueue.map((o) => o.id))
  );
  const soundEnabledRef = useRef(true);

  useEffect(() => {
    const saved = localStorage.getItem(SOUND_STORAGE_KEY);
    if (saved === 'false') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
      setSoundEnabled(false);
      soundEnabledRef.current = false;
    }
  }, []);

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEnabledRef.current = next;
    localStorage.setItem(SOUND_STORAGE_KEY, String(next));
    if (next) playNewOrderChime();
  }

  const refreshQueue = useCallback(async () => {
    const fresh = await getPreparationQueue();
    const newOrders = fresh.filter((o) => !knownIdsRef.current.has(o.id));
    if (newOrders.length > 0 && soundEnabledRef.current) {
      playNewOrderChime();
    }
    knownIdsRef.current = new Set(fresh.map((o) => o.id));
    setQueue((prev) => {
      const currentId = prev[currentIndex]?.id;
      const newIndex = currentId
        ? Math.max(
            0,
            fresh.findIndex((o) => o.id === currentId)
          )
        : 0;
      setCurrentIndex(
        newIndex === -1 ? Math.min(currentIndex, fresh.length - 1) : newIndex
      );
      return fresh;
    });
    setLastSync(new Date());
  }, [currentIndex]);

  useEffect(() => {
    const id = setInterval(refreshQueue, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refreshQueue]);

  const current = queue[currentIndex];

  function advance() {
    setQueue((prev) => prev.filter((_, i) => i !== currentIndex));
    setCurrentIndex((i) => Math.min(i, queue.length - 2));
  }

  function handleReady() {
    if (!current || isPending) return;
    const id = current.id;
    advance();
    startTransition(async () => {
      try {
        await markOrderReady(id);
      } catch {
        await refreshQueue();
      }
    });
  }

  function handleCancel() {
    if (!current || isPending) return;
    if (!confirm(`Annuler la commande ${current.reference} ?`)) return;
    const id = current.id;
    advance();
    startTransition(async () => {
      try {
        await cancelOrderFromKitchen(id);
      } catch {
        await refreshQueue();
      }
    });
  }

  if (queue.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-green-100 p-6 dark:bg-green-950">
          <Check className="h-16 w-16 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-3xl font-bold">Aucune commande en attente</h1>
        <p className="text-lg text-muted-foreground">
          Toutes les commandes du jour sont prêtes.
        </p>
        <p className="text-xs text-muted-foreground">
          Dernière synchro à {format(lastSync, 'HH:mm:ss')}
        </p>
      </div>
    );
  }

  if (!current) return null;

  const minutesUntil = differenceInMinutes(current.pickupTime, new Date());
  const isLate = isPast(current.pickupTime);
  const isSoon = !isLate && minutesUntil <= 15;

  const pickupRelative = isLate
    ? `En retard de ${formatDistanceToNowStrict(current.pickupTime, { locale: fr })}`
    : `Dans ${formatDistanceToNowStrict(current.pickupTime, { locale: fr })}`;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">
            Commande
          </span>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
            {currentIndex + 1} / {queue.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Synchro à {format(lastSync, 'HH:mm:ss')}
          </span>
          <button
            type="button"
            onClick={toggleSound}
            aria-label={
              soundEnabled
                ? 'Désactiver le son des nouvelles commandes'
                : 'Activer le son des nouvelles commandes'
            }
            title={soundEnabled ? 'Son activé' : 'Son désactivé'}
            className={`rounded-full p-2 transition-colors ${
              soundEnabled
                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {soundEnabled ? (
              <Bell className="h-4 w-4" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 py-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-3xl font-bold tracking-tight">
              {current.reference}
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {current.customerName}
            </p>
            <a
              href={`tel:${current.customerPhone}`}
              className="mt-1 inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Phone className="h-4 w-4" />
              {current.customerPhone}
            </a>
          </div>

          <div
            className={`flex flex-col items-end rounded-xl px-5 py-3 ${
              isLate
                ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100'
                : isSoon
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100'
                  : 'bg-muted'
            }`}
          >
            <div className="flex items-center gap-2 text-4xl font-bold tabular-nums">
              <Clock className="h-7 w-7" />
              {format(current.pickupTime, 'HH:mm', { locale: fr })}
            </div>
            <p className="mt-1 text-sm font-medium">{pickupRelative}</p>
          </div>
        </div>

        {current.note && (
          <div className="mb-6 flex gap-2 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/40">
            <StickyNote className="h-5 w-5 flex-shrink-0 text-amber-600" />
            <p className="text-base font-medium text-amber-900 dark:text-amber-100">
              {current.note}
            </p>
          </div>
        )}

        <div className="rounded-xl border bg-card">
          <ul className="divide-y">
            {current.items.map((item) => (
              <li key={item.cartId} className="p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold tabular-nums text-primary">
                      ×{item.quantity}
                    </span>
                    <span className="text-2xl font-semibold">
                      {item.productName}
                    </span>
                  </div>
                  <span className="text-base text-muted-foreground">
                    {priceFormatter.format(
                      (item.basePrice +
                        item.supplements.reduce((s, sup) => s + sup.price, 0)) *
                        item.quantity
                    )}{' '}
                    FCFA
                  </span>
                </div>
                {item.supplements.length > 0 && (
                  <ul className="mt-2 ml-12 space-y-1">
                    {item.supplements.map((sup, i) => (
                      <li
                        key={i}
                        className="text-lg text-muted-foreground before:mr-2 before:content-['•']"
                      >
                        <span className="font-medium text-foreground">
                          {sup.optionName}
                        </span>
                        <span className="text-sm"> ({sup.groupName})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between border-t bg-muted/30 px-5 py-4">
            <span className="text-lg font-semibold uppercase tracking-wider text-muted-foreground">
              Total
            </span>
            <span className="text-3xl font-bold tabular-nums">
              {priceFormatter.format(current.total)}{' '}
              <span className="text-xl text-muted-foreground">FCFA</span>
            </span>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 grid grid-cols-[1fr_3fr] gap-3 border-t bg-background pt-4 pb-2">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-red-200 bg-red-50 py-6 text-red-700 transition-colors hover:bg-red-100 active:bg-red-200 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/40"
        >
          <X className="h-8 w-8" strokeWidth={2.5} />
          <span className="text-lg font-bold">Annuler</span>
        </button>
        <button
          type="button"
          onClick={handleReady}
          disabled={isPending}
          className="flex flex-col items-center justify-center gap-1 rounded-xl bg-green-600 py-6 text-white shadow-lg transition-colors hover:bg-green-700 active:bg-green-800 disabled:opacity-50"
        >
          <Check className="h-10 w-10" strokeWidth={3} />
          <span className="text-2xl font-bold">Commande prête</span>
        </button>
      </div>
    </div>
  );
}
