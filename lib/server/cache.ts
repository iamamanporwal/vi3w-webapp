/**
 * Simple in-memory cache for API responses
 * For production, consider using Redis or a more robust caching solution
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Get cached value if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set a value in the cache
   */
  set<T>(key: string, data: T, ttl: number = 60000): void {
    // If cache is full, remove oldest entry
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Delete a cached value
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cached values
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton cache instance
const cache = new SimpleCache();

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cache.cleanup();
  }, 5 * 60 * 1000);
}

/**
 * Cache key generators
 */
export function getCacheKey(prefix: string, ...parts: (string | number | undefined)[]): string {
  const validParts = parts.filter(p => p !== undefined && p !== null);
  return `${prefix}:${validParts.join(':')}`;
}

/**
 * Cache wrapper for async functions
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = 60000 // Default 1 minute
): Promise<T> {
  // Try to get from cache
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Execute function and cache result
  const result = await fn();
  cache.set(key, result, ttl);
  return result;
}

/**
 * Invalidate cache entries matching a pattern
 */
export function invalidateCache(pattern: string): void {
  // Simple pattern matching - for production, use more sophisticated matching
  for (const key of cache['cache'].keys()) {
    if (key.startsWith(pattern)) {
      cache.delete(key);
    }
  }
}

export default cache;

