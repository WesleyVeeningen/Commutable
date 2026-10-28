import { MODES } from '../core/modes';
import type { Place } from '../core/types';
import { Icon } from '../components/Icon';

export function PlaceMarker({ place }: { place: Place }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="grid h-[30px] w-[30px] place-items-center rounded-full border-2 border-panel bg-accent text-accent-ink"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,.18)' }}
      >
        <Icon name={MODES[place.mode].icon} size={18} fill />
      </div>
      <div
        className="rounded-full bg-panel px-[9px] py-1 text-xs font-semibold whitespace-nowrap text-ink"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,.12)' }}
      >
        {place.name}
      </div>
    </div>
  );
}

/** Teardrop pin with drop animation and two pings (design: pdrop + ping). */
export function PinMarker() {
  return (
    <div className="relative h-0 w-0">
      <div
        className="absolute rounded-full"
        style={{ left: -9, top: -4, width: 18, height: 8, background: 'rgba(0,0,0,.25)', filter: 'blur(2px)' }}
      />
      <div
        className="absolute rounded-full border-2 border-ink"
        style={{ left: -22, top: -22, width: 44, height: 44, animation: 'ping 1.4s ease-out .35s 2 both' }}
      />
      <div
        className="absolute box-border grid place-items-center border-[3px] border-panel bg-ink"
        style={{
          left: -15,
          top: -36,
          width: 30,
          height: 30,
          borderRadius: '50% 50% 50% 0',
          boxShadow: '0 4px 12px rgba(0,0,0,.25)',
          animation: 'pdrop .5s cubic-bezier(.3,1.4,.5,1) both',
        }}
      >
        <div className="h-2 w-2 rounded-full bg-panel" />
      </div>
    </div>
  );
}
