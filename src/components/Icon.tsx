import type { CSSProperties } from 'react';

/** Material Symbols Rounded glyph. */
export function Icon({
  name,
  size = 20,
  fill = false,
  className = '',
  style,
}: {
  name: string;
  size?: number;
  fill?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={`icon ${fill ? 'icon-fill' : ''} ${className}`}
      style={{ fontSize: size, ...style }}
    >
      {name}
    </span>
  );
}
