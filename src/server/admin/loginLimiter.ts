export function createLoginLimiter(maximum = 5, windowMs = 15 * 60 * 1000, capacity = 2048) {
  const attempts = new Map<string, { count: number; expires: number }>();
  return {
    consume(address: string, now = Date.now()): boolean {
      for (const [key, entry] of attempts) if (entry.expires <= now) attempts.delete(key);
      const entry = attempts.get(address);
      if (entry) {
        if (entry.count >= maximum) return false;
        entry.count++;
      } else {
        if (attempts.size >= capacity) return false;
        attempts.set(address, { count: 1, expires: now + windowMs });
      }
      return true;
    },
    reset(address: string) { attempts.delete(address); },
  };
}

export const loginLimiter = createLoginLimiter();
