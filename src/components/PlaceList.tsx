import { MODES } from '../core/modes';
import type { Place } from '../core/types';
import { Icon } from './Icon';

interface Props {
  places: Place[];
  editingId: string | null;
  onEdit: (p: Place) => void;
  onDelete: (p: Place) => void;
}

export function PlaceList({ places, editingId, onEdit, onDelete }: Props) {
  const trips = places.reduce((s, p) => s + p.tripsPerWeek, 0);
  return (
    <>
      <div className="mt-1.5 mb-2.5 flex items-baseline justify-between">
        <h2 className="text-[13px] font-bold tracking-[.06em] text-muted uppercase">Your places</h2>
        <span className="text-[13px] text-muted">
          {trips} {trips === 1 ? 'trip' : 'trips'} / week
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {places.map((p) => (
          <li
            key={p.id}
            className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-[18px] bg-sunk p-3"
            style={{ outline: editingId === p.id ? '2px solid var(--accent)' : 'none', outlineOffset: -2 }}
          >
            <div className="grid h-[42px] w-[42px] place-items-center rounded-[14px] bg-panel text-accent">
              <Icon name={MODES[p.mode].icon} size={22} />
            </div>
            <div className="flex min-w-0 flex-col gap-[3px]">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[15px] font-bold">{p.name}</span>
                <span className="flex-none rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                  {p.tripsPerWeek}× / week
                </span>
              </div>
              <span className="truncate text-[13px] text-muted" title={p.address.label}>
                {p.address.label}
              </span>
            </div>
            <div className="flex gap-0.5">
              <IconButton icon="edit" label={`Edit ${p.name}`} onClick={() => onEdit(p)} />
              <IconButton icon="delete" label={`Delete ${p.name}`} onClick={() => onDelete(p)} danger />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function IconButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`grid h-[34px] w-[34px] place-items-center rounded-[10px] border-none bg-transparent p-0 text-muted transition-colors hover:bg-panel ${
        danger ? 'hover:text-danger' : 'hover:text-ink'
      }`}
    >
      <Icon name={icon} size={19} />
    </button>
  );
}
