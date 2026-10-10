export function memoTtl<T>(load: () => Promise<T>, ttlMs: number) {
  let value: T | null = null;
  let expiresAt = 0;
  let inflight: Promise<T> | null = null;

  return async (): Promise<T> => {
    if (value !== null && Date.now() < expiresAt) return value;
    if (inflight) return inflight;

    inflight = load()
      .then((result) => {
        value = result;
        expiresAt = Date.now() + ttlMs;
        return result;
      })
      .finally(() => {
        inflight = null;
      });

    return inflight;
  };
}
