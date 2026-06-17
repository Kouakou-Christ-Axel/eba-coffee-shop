'use client';

// Recherche d'un client existant depuis la caisse, PAR NOM OU TÉLÉPHONE.
// Champ texte (clavier complet, contrairement à un champ `tel`), avec
// autocomplétion : en tapant un nom ou un numéro, la liste des clients
// correspondants s'affiche ; un clic remplit téléphone + nom de la commande
// (via `onSelect`). La saisie manuelle d'un nouveau client reste possible via
// les champs Téléphone / Nom en dessous.
//
// Recherche : GET /api/customers/search (réutilise `listCustomers`, qui cherche
// déjà par nom OU chiffres du téléphone).

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatPhoneForDisplay } from '@/lib/phone';

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

type CustomerHit = {
  id: string;
  name: string | null;
  phone: string;
};

type Props = {
  onSelect: (customer: { name: string | null; phone: string }) => void;
};

export function CustomerSearchSelect({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerHit[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (blurTimer.current) clearTimeout(blurTimer.current);
      abortRef.current?.abort();
    };
  }, []);

  function runSearch(term: string) {
    const q = term.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setOpen(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fetch(`/api/customers/search?q=${encodeURIComponent(q)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : { customers: [] }))
      .then((data: { customers?: CustomerHit[] }) => {
        const hits = data.customers ?? [];
        setResults(hits);
        setActiveIndex(-1);
        setOpen(hits.length > 0);
      })
      .catch(() => {
        // Erreur réseau / requête annulée : pas de suggestions.
      });
  }

  function handleChange(next: string) {
    setQuery(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(next), DEBOUNCE_MS);
  }

  function handleSelect(hit: CustomerHit) {
    if (timer.current) clearTimeout(timer.current);
    onSelect({ name: hit.name, phone: hit.phone });
    // Feedback : on affiche le client retenu dans le champ de recherche.
    setQuery(
      hit.name
        ? `${hit.name} · ${formatPhoneForDisplay(hit.phone)}`
        : formatPhoneForDisplay(hit.phone)
    );
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < results.length) {
        e.preventDefault();
        handleSelect(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id="customer-search"
        type="search"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        placeholder="Rechercher un client (nom ou téléphone)…"
        autoComplete="off"
        className="pl-8"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-card py-1 text-sm shadow-md"
        >
          {results.map((hit, index) => (
            <li
              key={hit.id}
              role="option"
              aria-selected={index === activeIndex}
            >
              <button
                type="button"
                // onMouseDown : se déclenche avant le blur de l'input.
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(hit);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex w-full flex-col items-start px-3 py-1.5 text-left ${
                  index === activeIndex ? 'bg-accent' : ''
                }`}
              >
                <span className="font-medium">{hit.name || 'Sans nom'}</span>
                <span className="text-xs text-muted-foreground">
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
