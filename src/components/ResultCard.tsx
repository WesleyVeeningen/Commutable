import type { CSSProperties } from 'react';
import { userMessage } from '../core/errors';
import { MODES } from '../core/modes';
import { heatCss } from '../core/scale';
import { formatMinutes, quickerThan, scalePosition, type Distribution } from '../core/weekly';
import type { PinResult } from '../hooks/usePin';
import type { Theme } from '../map/theme';
import { Icon } from './Icon';

interface Props {
  result: PinResult;
  dist: Distribution | null;
  theme: Theme;
  style: CSSProperties;
  onClose: () => void;
}

export function ResultCard({ result, dist, theme, style, onClose }: Props) {
  const { status, breakdown, areaName } = result;
  const total = breakdown?.totalMin ?? null;
  const rows = breakdown?.rows ?? [];
  const maxWk = Math.max(1, ...rows.map((r) => r.weeklyMin ?? 0));

  let rank: string | null = null;
  if (total !== null && dist && dist.sorted.length) {
    const pct = Math.round(quickerThan(total, dist) * 100);
    rank = pct >= 50 ? `Quicker than ${pct}% of the map` : `Slower than ${100 - pct}% of the map`;
  }

  return (
    <section
      aria-label="Travel time for this spot"
      className="absolute z-20 box-border max-h-[calc(100%-24px)] overflow-auto rounded-3xl border border-line bg-panel px-[22px] pt-5 pb-3.5 shadow-panel"
      style={{ animation: 'cardin .35s ease both', ...style }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-muted">
          <Icon name="location_on" size={16} />
          <span className="truncate">{areaName ? `Near ${areaName}` : 'This spot'}</span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid h-8 w-8 flex-none place-items-center rounded-full border-none bg-sunk p-0 text-muted hover:text-ink"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      {status === 'error' ? (
        <div className="mt-3 mb-2 flex flex-col items-start gap-3 text-sm text-muted">
          <span>{userMessage(result.error)}</span>
          <button
            onClick={result.retry}
            className="h-9 rounded-xl border-none bg-accent px-4 text-sm font-bold text-accent-ink"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="mt-2.5 flex items-baseline gap-2">
            {status === 'loading' ? (
              <span className="my-1 h-[38px] w-40 animate-pulse rounded-xl bg-sunk" />
            ) : (
              <span className="text-[46px] leading-none font-bold tracking-[-0.03em]">
                {total === null ? 'No route' : formatMinutes(total)}
              </span>
            )}
            {total !== null && <span className="text-[17px] font-medium text-muted">/ week</span>}
          </div>
          <div className="mt-3 flex min-h-[18px] items-center gap-2 text-[13px] text-muted">
            {status === 'loading' && <span>Getting exact travel times…</span>}
            {status === 'ready' && total === null && <span>At least one place can’t be reached from here.</span>}
            {rank && total !== null && dist && (
              <>
                <span
                  className="h-2.5 w-2.5 flex-none rounded-full"
                  style={{ background: heatCss(scalePosition(total, dist), theme === 'dark') }}
                />
                <span>{rank}</span>
              </>
            )}
          </div>

          <div className="mt-4 mb-1.5 h-px bg-line" />
          {rows.map((r) => (
            <div key={r.place.id} className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 py-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-accent-soft text-accent">
                <Icon name={MODES[r.place.mode].icon} size={18} />
              </div>
              <div className="flex min-w-0 flex-col gap-[5px]">
                <div className="truncate text-sm font-semibold">{r.place.name}</div>
                <div className="h-1 overflow-hidden rounded bg-sunk">
                  <div
                    className="h-full rounded bg-accent transition-[width] duration-300"
                    style={{
                      width: `${r.weeklyMin === null ? 0 : Math.max(4, Math.round((r.weeklyMin / maxWk) * 100))}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-muted">
                  {r.place.tripsPerWeek}× ·{' '}
                  {r.oneWayMin === null ? 'no route' : `${Math.round(r.oneWayMin)} min each way`}
                </div>
              </div>
              <div className="text-[15px] font-bold tabular-nums">
                {r.weeklyMin === null ? '–' : formatMinutes(r.weeklyMin)}
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
