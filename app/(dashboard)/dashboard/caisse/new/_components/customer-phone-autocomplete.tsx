'use client';

// Champ « Téléphone » de la caisse avec autocomplétion des clients déjà
// enregistrés. En tapant un numéro OU un nom, une liste de clients correspondants
// s'affiche sous le champ ; un clic remplit téléphone + prénom (via
// `onSelectCustomer`). La saisie libre (client inconnu) reste possible.
//
// Recherche : GET /api/customers/search (réutilise `listCustomers`). Debounce et
// wrapper `relative` calqués sur `dashboard/clients/customer-search.tsx`.

import { useEffect, useRef, useState } from 'react';
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
  value: string;
  onChange: (value: string) => void;
  onSelectCustomer: (customer: { name: string | null; phone: string }) => void;
  required?: boolean;
};

export function CustomerPhoneAutocomplete({
  value,
  onChange,
  onSelectCustomer,
  required,
}: Props) {
  const [results, setResults] = useState<CustomerHit[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Évite de relancer une recherche / rouvrir la liste juste après une sélection.
  const skipNextSearch = useRef(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, []);

  function runSearch(term: string) {
    const q = term.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setOpen(false);
      return;
    }
    const controller = new AbortController();
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
        // Erreur réseau / requête annulée : on n'affiche pas de suggestions.
      });
  }

  function handleChange(next: string) {
    onChange(next);
    if (timer.current) clearTimeout(timer.current);
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    timer.current = setTimeout(() => runSearch(next), DEBOUNCE_MS);
  }

  function handleSelect(hit: CustomerHit) {
    if (timer.current) clearTimeout(timer.current);
    skipNextSearch.current = true;
    onSelectCustomer({ name: hit.name, phone: hit.phone });
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
      <Input
        id="customer-phone"
        type="tel"
        inputMode="tel"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        onBlur={() => {
          // Délai : laisse le clic sur une suggestion se déclencher avant la
          // fermeture.
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        placeholder="07 88 12 34 56"
        autoComplete="off"
        required={required}
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
                // onMouseDown plutôt que onClick : se déclenche avant le blur de
                // l'input, donc la sélection passe même si l'input perd le focus.
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
