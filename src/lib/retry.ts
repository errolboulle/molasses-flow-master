// Retry transient failures (network blips, 5xx) with exponential backoff.
// Returns the resolved value or throws the last error.

const isTransient = (err: any): boolean => {
  if (!err) return false;
  const msg = String(err?.message ?? err).toLowerCase();
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("timeout") || msg.includes("fetch failed")) return true;
  const code = err?.status ?? err?.code;
  if (code === 408 || code === 429) return true;
  if (typeof code === "number" && code >= 500 && code < 600) return true;
  // PostgREST returns these on transient infra issues
  if (err?.code === "PGRST301" || err?.code === "57P03") return true;
  return false;
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseMs?: number } = {}
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseMs = opts.baseMs ?? 400;
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1 || !isTransient(err)) break;
      const delay = baseMs * Math.pow(2, i) + Math.random() * 100;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
