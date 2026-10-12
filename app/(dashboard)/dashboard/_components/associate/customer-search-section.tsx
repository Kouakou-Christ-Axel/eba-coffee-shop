'use client';

import { Input } from '@heroui/react';
import { Search } from 'lucide-react';
import { formatPhoneForDisplay } from '@/lib/phone';
import { MIN_QUERY_LENGTH } from './use-associate-customer';
import type { AssociateCustomerState } from './use-associate-customer';

export function CustomerSearchSection({
  state,
  currentCustomerId,
}: {
  state: AssociateCustomerState;
  currentCustomerId: string | null;
}) {
  const {
    query,
    setQuery,
    results,
    setResults,
    searching,
    isPending,
    handleQueryChange,
    submit,
  } = state;
  return (
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
            <li className="px-3 py-2 text-sm text-default-400">Recherche…</li>
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
  );
}
