'use client';

// Pile de toasts du dashboard, sous deux formes :
//
// 1. Toast d'ANNULATION (10 s), pour tout changement de statut/paiement en
//    caisse : `pushUndo({ message, onUndo })`. Le contexte doit être monté une
//    seule fois AU-DESSUS des cartes de commande
//    (`app/(dashboard)/dashboard/caisse/caisse-view.tsx`) : celles-ci peuvent
//    démonter quand la file SSE déplace une commande d'onglet, mais le toast
//    doit survivre à ce démontage.
// 2. Toast de RETOUR simple (4 s), succès ou erreur, sans bouton « Annuler » :
//    `pushUndo({ message, variant: 'success' | 'error' })` — `onUndo` omis.
//    Utilisé par la section menu (`app/(dashboard)/dashboard/menu/layout.tsx`).
//
// Plusieurs toasts simultanés supportés (un caissier peut enchaîner plusieurs
// actions).

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Toast avec bouton « Annuler » : laisse le temps de se raviser. */
const UNDO_DURATION_MS = 10_000;
/** Toast de simple retour (succès/erreur) : juste le temps de le lire. */
const FEEDBACK_DURATION_MS = 4_000;
const ERROR_DISPLAY_MS = 4_000;

type ToastState = 'active' | 'undoing' | 'error';
export type ToastVariant = 'success' | 'error';

type Toast = {
  id: string;
  message: string;
  durationMs: number;
  onUndo?: () => Promise<void> | void;
  variant: ToastVariant;
  state: ToastState;
  error?: string;
};

type PushUndoArgs = {
  message: string;
  durationMs?: number;
  /** Omis = toast de simple retour, sans bouton « Annuler ». */
  onUndo?: () => Promise<void> | void;
  /** Couleur du message. Ignoré quand `onUndo` est fourni. */
  variant?: ToastVariant;
};

type UndoToastContextValue = {
  pushUndo: (args: PushUndoArgs) => void;
  /** Raccourci lisible pour un toast sans annulation. */
  pushToast: (message: string, variant?: ToastVariant) => void;
};

const UndoToastContext = createContext<UndoToastContextValue | null>(null);

/** Accès au toast d'annulation depuis une action caisse (paiement, statut). */
export function useUndoToast(): UndoToastContextValue {
  const ctx = useContext(UndoToastContext);
  if (!ctx) {
    throw new Error('useUndoToast doit être utilisé dans <UndoToastProvider>');
  }
  return ctx;
}

export function UndoToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const pushUndo = useCallback(
    ({ message, durationMs, onUndo, variant = 'success' }: PushUndoArgs) => {
      const id = crypto.randomUUID();
      const ms =
        durationMs ?? (onUndo ? UNDO_DURATION_MS : FEEDBACK_DURATION_MS);
      setToasts((prev) => [
        ...prev,
        { id, message, durationMs: ms, onUndo, variant, state: 'active' },
      ]);
      const timer = setTimeout(() => removeToast(id), ms);
      timers.current.set(id, timer);
    },
    [removeToast]
  );

  const pushToast = useCallback(
    (message: string, variant: ToastVariant = 'success') =>
      pushUndo({ message, variant }),
    [pushUndo]
  );

  async function handleUndoClick(toast: Toast) {
    if (!toast.onUndo) return;
    const timer = timers.current.get(toast.id);
    if (timer) clearTimeout(timer);
    setToasts((prev) =>
      prev.map((t) => (t.id === toast.id ? { ...t, state: 'undoing' } : t))
    );
    try {
      await toast.onUndo();
      removeToast(toast.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Échec de l’annulation';
      setToasts((prev) =>
        prev.map((t) =>
          t.id === toast.id ? { ...t, state: 'error', error: message } : t
        )
      );
      const errTimer = setTimeout(
        () => removeToast(toast.id),
        ERROR_DISPLAY_MS
      );
      timers.current.set(toast.id, errTimer);
    }
  }

  return (
    <UndoToastContext.Provider value={{ pushUndo, pushToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={cn(
                'pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-xl border-2 bg-card px-4 py-3 shadow-lg',
                t.state === 'error' || t.variant === 'error'
                  ? 'border-destructive/50'
                  : 'border-border'
              )}
            >
              <div className="flex items-center gap-3">
                <p
                  className={cn(
                    'min-w-0 flex-1 text-sm font-medium',
                    t.state === 'error' || t.variant === 'error'
                      ? 'text-destructive'
                      : 'text-foreground'
                  )}
                >
                  {t.state === 'error'
                    ? (t.error ?? 'Échec de l’annulation')
                    : t.message}
                </p>
                {t.onUndo && t.state !== 'error' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={t.state === 'undoing'}
                    onClick={() => handleUndoClick(t)}
                  >
                    Annuler
                  </Button>
                )}
                <button
                  type="button"
                  aria-label="Fermer"
                  className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"
                  onClick={() => removeToast(t.id)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {t.state === 'active' && (
                <div
                  aria-hidden="true"
                  className="undo-toast-bar absolute inset-x-0 bottom-0 h-0.5 origin-left bg-muted-foreground/50"
                  style={{ animationDuration: `${t.durationMs}ms` }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </UndoToastContext.Provider>
  );
}
