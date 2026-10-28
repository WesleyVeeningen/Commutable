export type TravelErrorKind =
  | 'config' // no API key
  | 'auth' // key rejected
  | 'rate-limit' // 429: per-minute or daily quota
  | 'too-large' // request exceeds server limits (ORS 6004)
  | 'unroutable' // a location can't be snapped to the network (ORS 6010)
  | 'network'
  | 'server'
  | 'aborted';

export class TravelError extends Error {
  readonly kind: TravelErrorKind;
  readonly retryAfterMs?: number;
  constructor(kind: TravelErrorKind, message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'TravelError';
    this.kind = kind;
    this.retryAfterMs = retryAfterMs;
  }
}

export const isRetryable = (e: unknown): boolean =>
  e instanceof TravelError && (e.kind === 'rate-limit' || e.kind === 'network' || e.kind === 'server');

export function userMessage(e: unknown): string {
  if (!(e instanceof TravelError)) return 'Something went wrong while calculating travel times.';
  switch (e.kind) {
    case 'config':
      return 'Add VITE_ORS_API_KEY to your .env file to calculate travel times.';
    case 'auth':
      return 'OpenRouteService rejected the API key. Check VITE_ORS_API_KEY.';
    case 'rate-limit':
      return 'OpenRouteService rate limit reached. Wait a minute and retry.';
    case 'network':
      // ORS sends 403/429 responses without CORS headers, so the browser reports
      // a bad key or an exhausted quota as a network failure too.
      return 'Can’t reach OpenRouteService. Check your connection and API key, or wait a minute if you hit the rate limit.';
    default:
      return 'OpenRouteService couldn’t calculate travel times.';
  }
}
