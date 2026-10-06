/**
 * A small in-process TTL cache with a bounded size.
 *
 * External lookups (ChEMBL, PubChem) were previously repeated on every analysis of
 * the same compound. Both are public services we do not pay for and should not
 * hammer, and both are the slowest step in the request by a wide margin.
 *
 * Deliberately not a distributed cache: this is a single-process app, and adding
 * Redis for reference data that changes on the order of months would be more
 * moving parts than the problem warrants.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private store = new Map<string, Entry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
  ) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    // Refresh insertion order so the eviction below is least-recently-used
    // rather than merely oldest-written.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      // Map preserves insertion order, so the first key is the least recently used.
      const oldest = this.store.keys().next();
      if (!oldest.done) this.store.delete(oldest.value);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  /**
   * Fetch through the cache. A `null` result is cached too — "this compound has
   * no ChEMBL record" is a real answer worth remembering, not a failure to retry
   * on every request.
   */
  async wrap(key: string, produce: () => Promise<T>): Promise<T> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;

    const value = await produce();
    this.set(key, value);
    return value;
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
