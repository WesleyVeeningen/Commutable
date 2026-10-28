import { useEffect, useState } from 'react';
import type { Theme } from '../map/theme';
import { useMediaQuery } from './useMediaQuery';

/** Follows the system setting; the header toggle overrides it for this session. */
export function useTheme(): [Theme, () => void] {
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const [override, setOverride] = useState<Theme | null>(null);
  const theme: Theme = override ?? (systemDark ? 'dark' : 'light');

  // A change in the system setting wins over an earlier manual toggle.
  useEffect(() => setOverride(null), [systemDark]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return [theme, () => setOverride(theme === 'dark' ? 'light' : 'dark')];
}
