import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TtlCache } from "./cache";

describe("TtlCache", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns a cached value within the TTL", () => {
    const cache = new TtlCache<string>(1000);
    cache.set("a", "value");
    expect(cache.get("a")).toBe("value");
  });

  it("expires entries after the TTL", () => {
    const cache = new TtlCache<string>(1000);
    cache.set("a", "value");
    vi.advanceTimersByTime(1001);
    expect(cache.get("a")).toBeUndefined();
  });

  it("caches null results", async () => {
    // "This compound has no ChEMBL record" is a real answer. If null were treated
    // as a miss, every unknown compound would hit the network on every request.
    const cache = new TtlCache<string | null>(1000);
    const produce = vi.fn().mockResolvedValue(null);

    expect(await cache.wrap("k", produce)).toBeNull();
    expect(await cache.wrap("k", produce)).toBeNull();
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it("only calls the producer once for concurrent-looking sequential calls", async () => {
    const cache = new TtlCache<number>(1000);
    const produce = vi.fn().mockResolvedValue(42);

    await cache.wrap("k", produce);
    await cache.wrap("k", produce);
    await cache.wrap("k", produce);

    expect(produce).toHaveBeenCalledTimes(1);
  });

  it("calls the producer again once the entry has expired", async () => {
    const cache = new TtlCache<number>(1000);
    const produce = vi.fn().mockResolvedValue(1);

    await cache.wrap("k", produce);
    vi.advanceTimersByTime(1001);
    await cache.wrap("k", produce);

    expect(produce).toHaveBeenCalledTimes(2);
  });

  it("evicts the least recently used entry when full", () => {
    const cache = new TtlCache<string>(10_000, 2);
    cache.set("a", "1");
    cache.set("b", "2");

    // Touch "a" so "b" becomes the least recently used.
    cache.get("a");
    cache.set("c", "3");

    expect(cache.get("a")).toBe("1");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe("3");
  });

  it("does not grow beyond maxEntries", () => {
    const cache = new TtlCache<number>(10_000, 3);
    for (let i = 0; i < 50; i++) cache.set(`k${i}`, i);
    expect(cache.size).toBeLessThanOrEqual(3);
  });

  it("overwriting an existing key does not trigger eviction", () => {
    const cache = new TtlCache<number>(10_000, 2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 99);

    expect(cache.get("a")).toBe(99);
    expect(cache.get("b")).toBe(2);
  });

  it("clear empties the cache", () => {
    const cache = new TtlCache<number>(1000);
    cache.set("a", 1);
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });
});
