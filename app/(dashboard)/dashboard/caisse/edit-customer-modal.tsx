'use client';

// Modale d'édition des infos client d'une commande caisse (CASHIER_PLUS).
// Trois chemins, comme la modale ADMIN équivalente
// (`/dashboard/commandes/[id]/associate-customer.tsx`) mais branchée sur la
// route caisse `PATCH /api/caisse/orders/:id/customer` :
//   - rechercher et sélectionner un client déjà enregistré (CRM) ;
//   - saisir un téléphone (+ nom) pour un nouveau client / lien direct ;
//   - détacher la commande (la rendre anonyme) si elle est déjà liée.

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from '@heroui/react';
import { Search, X } from 'lucide-react';
import { formatPhoneForDisplay } from '@/lib/phone';
import type { CashierOrder } from '@/lib/cashier-queue';

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

type CustomerHit = {
  id: string;
  name: string | null;
  phone: string;
};

type SetCustomerInput =
  | { customerId: string | null }
  | { phone: string; name: string | null };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  order: CashierOrder;
};

export function EditCustomerModal({ isOpen, onClose, order }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerHit[]>([]);
  const [searching, setSearching] = useState(false);

  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      abort.current?.abort();
    };
  }, []);

  function resetState() {
    setQuery('');
    setResults([]);
    setManualPhone('');
    setManualName('');
    setError(null);
  }

  function handleClose() {
    if (isPending) return;
    resetState();
    onClose();
  }

  function runSearch(term: string) {
    const q = term.trim();
    // Une requête plus ancienne mais plus lente écrasait sinon un résultat
    // plus récent (le sélecteur de `caisse/new` annule déjà correctement).
    abort.current?.abort();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setSearching(true);
    fetch(`/api/customers/search?q=${encodeURIComponent(q)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : { customers: [] }))
      .then((data: { customers?: CustomerHit[] }) => {
        setResults(data.customers ?? []);
        setSearching(false);
      })
      .catch(() => {
        // Requête annulée : une plus récente est en vol, on lui laisse la main
        // (y compris l'extinction de l'indicateur « Recherche… »).
        if (controller.signal.aborted) return;
        setResults([]);
        setSearching(false);
      });
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(next), DEBOUNCE_MS);
  }

  function submit(input: SetCustomerInput) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/caisse/orders/${order.id}/customer`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          let msg = `Erreur ${res.status}`;
          try {
            const data = (await res.json()) as { error?: string };
            if (typeof data.error === 'string') msg = data.error;
          } catch {
            // ignore
          }
          setError(msg);
          return;
        }
        resetState();
        onClose();
      } catch {
        setError('Erreur réseau');
      }
    });
  }

  const isLinked = order.customerId !== null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      placement="center"
      size="lg"
      scrollBehavior="inside"
      isDismissable={!isPending}
      hideCloseButton={isPending}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span className="text-base font-semibold">Modifier le client</span>
          <span className="text-sm font-normal text-default-500">
            Commande #{String(order.dailyNumber).padStart(3, '0')} ·{' '}
            {isLinked
              ? `${order.customerName || 'Sans nom'} · ${
                  order.customerPhone
                    ? formatPhoneForDisplay(order.customerPhone)
                    : '—'
                }`
              : 'Commande anonyme'}
          </span>
        </ModalHeader>

        <ModalBody className="gap-4">
          {error && (
            <p className="rounded-medium bg-danger-50 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {/* Recherche d'un client existant */}
          <div className="space-y-2">
            <Input
              label="Rechercher un client"
              placeholder="Nom ou téléphone"
              value={query}
              onValueChange={handleQueryChange}
              startContent={<Search className="h-4 w-4 text-default-400" />}
              isClearable
              onClear={() => {
                setQuery('');
                setResults([]);
              }}
              autoComplete="off"
            />
            {query.trim().length >= MIN_QUERY_LENGTH && (
              <ul className="max-h-56 divide-y divide-default-100 overflow-auto rounded-medium border border-default-200">
                {searching && (
                  <li className="px-3 py-2 text-sm text-default-400">
                    Recherche…
                  </li>
                )}
                {!searching && results.length === 0 && (
                  <li className="px-3 py-2 text-sm text-default-400">
                    Aucun client trouvé
                  </li>
                )}
                {results.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      disabled={isPending || hit.id === order.customerId}
                      onClick={() => submit({ customerId: hit.id })}
                      className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-default-100 disabled:opacity-50"
                    >
                      <span className="font-medium">
                        {hit.name || 'Sans nom'}
                        {hit.id === order.customerId && ' (lié)'}
                      </span>
                      <span className="text-xs text-default-500">
                        {formatPhoneForDisplay(hit.phone)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Saisie manuelle (nouveau client / correction du nom-téléphone) */}
          <div className="space-y-2 border-t border-default-200 pt-4">
            <p className="text-sm font-medium text-default-600">
              Ou saisir / corriger les infos
            </p>
            <Input
              label="Nom (optionnel)"
              value={manualName}
              onValueChange={setManualName}
              autoComplete="off"
            />
            <Input
              label="Téléphone"
              type="tel"
              inputMode="tel"
              placeholder="07 88 12 34 56"
              value={manualPhone}
              onValueChange={setManualPhone}
              autoComplete="off"
            />
            <Button
              type="button"
              color="primary"
              isDisabled={manualPhone.trim().length === 0}
              isLoading={isPending}
              onPress={() =>
                submit({
                  phone: manualPhone.trim(),
                  name: manualName.trim() || null,
                })
              }
            >
              Enregistrer
            </Button>
          </div>
        </ModalBody>

        <ModalFooter className="justify-between">
          {isLinked ? (
            <Button
              type="button"
              color="danger"
              variant="light"
              startContent={<X className="h-4 w-4" />}
              isDisabled={isPending}
              onPress={() => submit({ customerId: null })}
            >
              Détacher
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            variant="flat"
            isDisabled={isPending}
            onPress={handleClose}
          >
            Fermer
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
