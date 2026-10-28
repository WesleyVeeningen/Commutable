import { useEffect, useId, useRef, useState } from 'react';
import { userMessage } from '../core/errors';
import type { Address, LngLat } from '../core/types';
import { geocoder } from '../services';
import { Icon } from './Icon';

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (a: Address) => void;
  /** Bias results towards this point (e.g. the map centre) */
  focus?: LngLat;
}

export const inputClass =
  'h-11 w-full box-border rounded-xl border border-line-strong bg-panel px-3.5 text-[15px] font-medium text-ink outline-none transition-shadow focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]';

export function AddressSearch({ query, onQueryChange, onSelect, focus }: Props) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const listId = useId();
  const focusRef = useRef(focus);
  focusRef.current = focus;

  const q = query.trim();
  useEffect(() => {
    if (q.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      geocoder
        .autocomplete(q, focusRef.current, ctrl.signal)
        .then((r) => {
          setResults(r);
          setError(null);
          setActive(0);
        })
        .catch((e) => !ctrl.signal.aborted && setError(userMessage(e)))
        .finally(() => !ctrl.signal.aborted && setLoading(false));
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const pick = (a: Address) => {
    onSelect(a);
    setOpen(false);
  };

  const show = open && q.length > 0;

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={`${listId}-input`} className="text-[13px] font-semibold text-muted">
        Address
      </label>
      <div className="relative">
        <Icon name="search" size={20} className="pointer-events-none absolute top-3 left-3 text-muted" />
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={show}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          placeholder="Search an address or place"
          className={`${inputClass} pl-10`}
          onChange={(e) => {
            onQueryChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!show || !results.length) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => (i + 1) % results.length);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => (i - 1 + results.length) % results.length);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              pick(results[active]);
            } else if (e.key === 'Escape') setOpen(false);
          }}
        />
      </div>
      {show && (
        <div
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-10 mt-1.5 flex flex-col rounded-[14px] border border-line bg-panel p-1.5 shadow-panel"
        >
          {results.map((a, i) => (
            <button
              key={`${a.lng},${a.lat},${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(a)}
              className={`flex items-center gap-2.5 rounded-[10px] border-none px-2.5 py-[9px] text-left text-ink ${
                i === active ? 'bg-sunk' : 'bg-transparent'
              }`}
            >
              <Icon name="location_on" size={18} className="text-muted" />
              <span className="flex min-w-0 flex-col gap-px">
                <span className="truncate text-sm font-semibold">{a.label}</span>
                {a.area && <span className="truncate text-xs text-muted">{a.area}</span>}
              </span>
            </button>
          ))}
          {!results.length && (
            <div className="p-2.5 text-[13px] text-muted">
              {error ?? (loading || q.length < 2 ? 'Searching…' : 'No matches. Try a street or area name.')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
