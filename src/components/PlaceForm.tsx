import { useState } from 'react';
import { MODE_ORDER, MODES, TRIPS_DEFAULT, TRIPS_MAX, TRIPS_MIN } from '../core/modes';
import type { Address, LngLat, Mode, Place } from '../core/types';
import type { PlaceDraft } from '../hooks/usePlaces';
import { AddressSearch, inputClass } from './AddressSearch';
import { Icon } from './Icon';

interface Props {
  editing: Place | null;
  focus?: LngLat;
  onSave: (draft: PlaceDraft) => void;
  onCancel: () => void;
}

export function PlaceForm({ editing, focus, onSave, onCancel }: Props) {
  const [name, setName] = useState(editing?.name ?? '');
  const [query, setQuery] = useState(editing?.address.label ?? '');
  const [address, setAddress] = useState<Address | null>(editing?.address ?? null);
  const [mode, setMode] = useState<Mode>(editing?.mode ?? 'bike');
  const [trips, setTrips] = useState(editing?.tripsPerWeek ?? TRIPS_DEFAULT);

  const canSave = name.trim().length > 0 && address !== null;
  const save = () => canSave && onSave({ name: name.trim(), address: address!, mode, tripsPerWeek: trips });

  return (
    <form
      className="mt-3 flex flex-col gap-4 rounded-[20px] bg-sunk p-[18px]"
      style={{ animation: 'cardin .25s ease both' }}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="text-base font-bold">{editing ? 'Edit place' : 'Add a place'}</div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-muted">Name</span>
        <input
          autoFocus={!editing}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Work, Gym, Mum’s"
          maxLength={40}
          className={inputClass}
        />
      </label>

      <AddressSearch
        query={query}
        focus={focus}
        onQueryChange={(q) => {
          setQuery(q);
          setAddress(null); // typing clears the selection; a pick is required
        }}
        onSelect={(a) => {
          setAddress(a);
          setQuery(a.label);
        }}
      />

      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="How you get there">
        <span className="text-[13px] font-semibold text-muted">How you get there</span>
        <div className="grid grid-cols-3 gap-1 rounded-[14px] border border-line bg-panel p-1">
          {MODE_ORDER.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`flex h-10 items-center justify-center gap-1.5 rounded-[10px] border-none text-sm font-semibold transition-colors ${
                mode === m ? 'bg-accent text-accent-ink' : 'bg-transparent text-ink hover:bg-sunk'
              }`}
            >
              <Icon name={MODES[m].icon} size={19} />
              <span>{MODES[m].label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-muted">Trips per week</span>
          <span className="text-xs text-muted">Counted there and back</span>
        </div>
        <div className="flex items-center gap-1 rounded-[14px] border border-line bg-panel p-1">
          <StepButton
            icon="remove"
            label="Fewer trips"
            disabled={trips <= TRIPS_MIN}
            onClick={() => setTrips((t) => Math.max(TRIPS_MIN, t - 1))}
          />
          <span className="min-w-11 text-center text-base font-bold tabular-nums" aria-live="polite">
            {trips}×
          </span>
          <StepButton
            icon="add"
            label="More trips"
            disabled={trips >= TRIPS_MAX}
            onClick={() => setTrips((t) => Math.min(TRIPS_MAX, t + 1))}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-[42px] rounded-xl border-none bg-transparent px-4 text-sm font-semibold text-muted hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSave}
          className="h-[42px] rounded-xl border-none bg-accent px-[18px] text-sm font-bold text-accent-ink disabled:cursor-default disabled:opacity-45"
        >
          {editing ? 'Save changes' : 'Add place'}
        </button>
      </div>
    </form>
  );
}

function StepButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-9 w-9 place-items-center rounded-[10px] border-none bg-transparent p-0 text-ink hover:bg-sunk disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
    >
      <Icon name={icon} size={20} />
    </button>
  );
}
