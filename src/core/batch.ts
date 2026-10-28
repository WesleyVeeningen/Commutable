import { isRetryable, TravelError } from './errors';

export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error('chunk size must be ≥ 1');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

export const sleep: Sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new TravelError('aborted', 'Aborted'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new TravelError('aborted', 'Aborted'));
      },
      { once: true },
    );
  });

export interface RetryOptions {
  retries: number;
  baseDelayMs: number;
  sleep: Sleep;
  signal?: AbortSignal;
}

/** Retry rate-limit / network / 5xx errors with exponential backoff. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isRetryable(e) || attempt >= opts.retries) throw e;
      const hinted = e instanceof TravelError ? e.retryAfterMs : undefined;
      await opts.sleep(hinted ?? opts.baseDelayMs * 2 ** attempt, opts.signal);
    }
  }
}

/** Run async tasks with at most `concurrency` in flight; rejects on first failure. */
export async function runPool(tasks: (() => Promise<void>)[], concurrency: number): Promise<void> {
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < tasks.length) {
      const task = tasks[next++];
      try {
        await task();
      } catch (e) {
        failed = true;
        throw e;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
}
