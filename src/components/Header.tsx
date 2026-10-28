import type { Theme } from '../map/theme';
import { Icon } from './Icon';

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="26" height="28" viewBox="0 0 26 28" aria-hidden="true">
        <polygon points="13,1 25,8 25,20 13,27 1,20 1,8" fill="var(--accent)" />
        <circle cx="13" cy="14" r="4" fill="var(--panel)" />
      </svg>
      <span className="text-xl font-bold tracking-[-0.02em]">Commutable</span>
    </div>
  );
}

export function Header({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  return (
    <div className="flex items-center justify-between px-[22px] pt-[18px] pb-3.5">
      <Logo />
      <button
        onClick={onToggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="grid h-[38px] w-[38px] place-items-center rounded-full border border-line-strong bg-transparent p-0 text-ink transition-colors hover:bg-sunk"
      >
        <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} size={20} />
      </button>
    </div>
  );
}
