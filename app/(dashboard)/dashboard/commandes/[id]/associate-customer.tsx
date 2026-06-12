'use client';

// Modale d'association d'un client à une commande existante (page de détail).
// Trois chemins :
//   - rechercher et sélectionner un client déjà enregistré (CRM) ;
//   - saisir un téléphone (+ nom) pour un nouveau client / lien direct ;
//   - détacher la commande (la rendre anonyme) si elle est déjà liée.
//
// Branche la server action `setOrderCustomerAction` (qui revalide la page de
// détail et la fiche client). La recherche réutilise GET /api/customers/search.

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
import { UserPlus, UserCog, Search, X } from 'lucide-react';
import { formatPhoneForDisplay } from '@/lib/phone';
import { setOrderCustomerAction } from '../actions';

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

type CustomerHit = {
  id: string;
  name: string | null;
  phone: string;
};

type Props = {
  orderId: string;
  /** Client déjà lié (fiche CRM), null si commande anonyme. */
  currentCustomerId: string | null;
  currentName: string | null;
  currentPhone: string | null;
};

export function AssociateCustomer({
  orderId,
  currentCustomerId,
  currentName,
  currentPhone,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerHit[]>([]);
  const [searching, setSearching] = useState(false);

  // Saisie manuelle (client non trouvé).
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
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
    setIsOpen(false);
    resetState();
  }

  function runSearch(term: string) {
    const q = term.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    fetch(`/api/customers/search?q=${encodeURIComponent(q)}`)
      .then((res) => (res.ok ? res.json() : { customers: [] }))
      .then((data: { customers?: CustomerHit[] }) => {
        setResults(data.customers ?? []);
      })
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(next), DEBOUNCE_MS);
  }

  function submit(input: Parameters<typeof setOrderCustomerAction>[1]) {
    setError(null);
    startTransition(async () => {
      try {
        await setOrderCustomerAction(orderId, input);
        setIsOpen(false);
        resetState();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur serveur');
      }
    });
  }

  const isLinked = currentCustomerId !== null;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="flat"
        startContent={
          isLinked ? (
            <UserCog className="h-4 w-4" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )
        }
        onPress={() => setIsOpen(true)}
      >
        {isLinked ? 'Modifier le client' : 'Associer un client'}
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        size="lg"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Associer un client
            <span className="text-sm font-normal text-default-500">
              {isLinked
                ? `Actuellement : ${currentName || 'Sans nom'} · ${
                    currentPhone ? formatPhoneForDisplay(currentPhone) : '—'
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
                        disabled={isPending || hit.id === currentCustomerId}
                        onClick={() => submit({ customerId: hit.id })}
                        className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-default-100 disabled:opacity-50"
                      >
                        <span className="font-medium">
                          {hit.name || 'Sans nom'}
                          {hit.id === currentCustomerId && ' (lié)'}
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

            {/* Saisie manuelle (nouveau client / lien direct par téléphone) */}
            <div className="space-y-2 border-t border-default-200 pt-4">
              <p className="text-sm font-medium text-default-600">
                Ou saisir un nouveau client
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
                Associer ce client
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
    </>
  );
}
