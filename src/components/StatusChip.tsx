import type { CSSProperties, ReactNode } from 'react';
import { Icon } from './Icon';

export type ChipContent =
  | { kind: 'loading'; text: string }
  | { kind: 'info'; icon: string; text: string }
  | { kind: 'error'; text: string; onRetry?: () => void };

export function StatusChip({ content, style }: { content: ChipContent; style: CSSProperties }) {
  let body: ReactNode;
  if (content.kind === 'loading') {
    body = (
      <>
        <div className="relative h-1 w-[72px] flex-none overflow-hidden rounded bg-sunk">
          <div
            className="absolute inset-y-0 left-0 w-[40%] rounded bg-accent"
            style={{ animation: 'bar 1.1s ease-in-out infinite' }}
          />
        </div>
        <span className="truncate">{content.text}</span>
      </>
    );
  } else if (content.kind === 'info') {
    body = (
      <>
        <Icon name={content.icon} size={18} className="text-accent" />
        <span className="truncate">{content.text}</span>
      </>
    );
  } else {
    body = (
      <>
        <Icon name="error" size={18} className="text-danger" />
        <span className="min-w-0 truncate">{content.text}</span>
        {content.onRetry && (
          <button
            onClick={content.onRetry}
            className="pointer-events-auto -my-1 -mr-2 h-8 flex-none rounded-full border-none bg-accent px-3.5 text-[13px] font-bold text-accent-ink"
          >
            Retry
          </button>
        )}
      </>
    );
  }
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute top-5 z-10 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-2.5 rounded-full bg-panel px-4 py-2.5 text-sm font-medium whitespace-nowrap text-ink shadow-panel"
      style={style}
    >
      {body}
    </div>
  );
}
