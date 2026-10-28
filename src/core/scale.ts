/** Heat scale from the design: green → yellow → red, interpolated in OKLCH. */
const STOPS: [number, number, number][] = [
  [0.8, 0.12, 150],
  [0.87, 0.13, 95],
  [0.69, 0.15, 35],
];

export function heatOklch(t: number, dark: boolean): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  const i = t < 0.5 ? 0 : 1;
  const u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  return [a[0] + (b[0] - a[0]) * u - (dark ? 0.08 : 0), a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

/** CSS oklch() string — for DOM elements. */
export function heatCss(t: number, dark: boolean): string {
  const [l, c, h] = heatOklch(t, dark);
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;
}

/** #rrggbb — for MapLibre paint properties, which don't parse oklch(). */
export function heatHex(t: number, dark: boolean): string {
  return oklchToHex(...heatOklch(t, dark));
}

/** Gradient for the legend bar, through 5 stops. */
export function heatGradient(dark: boolean): string {
  const stops = [0, 0.25, 0.5, 0.75, 1].map((t) => heatCss(t, dark));
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

export function oklchToHex(l: number, c: number, hDeg: number): string {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3,
    M = m_ ** 3,
    S = s_ ** 3;
  const r = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const bl = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;
  const enc = (x: number) => {
    const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${enc(r)}${enc(g)}${enc(bl)}`;
}
