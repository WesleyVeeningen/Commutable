import type { Resolution } from '../core/types';
import { heatGradient } from '../core/scale';
import { legendLabels, type Distribution } from '../core/weekly';
import type { Theme } from '../map/theme';

interface Props {
  theme: Theme;
  dist: Distribution | null;
  resolution: Resolution;
  downgraded: boolean;
  onResolution: (r: Resolution) => void;
  /** Hidden in the collapsed mobile sheet to save room */
  showDetail: boolean;
}

export function Legend({ theme, dist, resolution, downgraded, onResolution, showDetail }: Props) {
  const [lo, mid, hi] = dist && dist.sorted.length ? legendLabels(dist) : ['–', '–', '–'];
  return (
    <div className="flex flex-col gap-2.5 border-t border-line px-[22px] pt-4 pb-5">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-bold">Weekly travel time</span>
        <span className="text-xs text-muted">hours per week</span>
      </div>
      <div className="h-3 rounded-xl" style={{ background: heatGradient(theme === 'dark') }} />
      <div className="flex justify-between text-xs font-semibold text-muted tabular-nums">
        <span>{lo}</span>
        <span>{mid}</span>
        <span>{hi}</span>
      </div>
      {showDetail && (
        <div className="mt-1 flex items-center justify-between gap-3">
          <span
            className="text-xs text-muted"
            title={downgraded ? 'Your places are spread out, so fine detail would need too many requests' : undefined}
          >
            {downgraded ? 'Map detail (fine needs a smaller area)' : 'Map detail'}
          </span>
          <div
            className="grid grid-cols-2 gap-0.5 rounded-[10px] border border-line bg-sunk p-0.5"
            role="radiogroup"
            aria-label="Map detail"
          >
            {(['coarse', 'fine'] as const).map((r) => (
              <button
                key={r}
                role="radio"
                aria-checked={resolution === r}
                onClick={() => onResolution(r)}
                className={`h-7 rounded-lg border-none px-3 text-xs font-semibold capitalize transition-colors ${
                  resolution === r ? 'bg-accent text-accent-ink' : 'bg-transparent text-ink hover:bg-panel'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
