import { NextRequest } from 'next/server';

/**
 * Rate limit configuration options
 */
export type RateLimitOptions = {
  /** Time window in milliseconds */
  interval: number;
  /** Maximum number of unique tokens to track */
  uniqueTokenPerInterval: number;
};

/**
 * Rate limit result
 */
export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

/**
 * Token bucket for rate limiting
 */
interface TokenBucket {
  count: number;
  resetTime: number;
}

/**
 * In-memory rate limiter using token bucket algorithm
 * SECURITY: Prevents DoS attacks, brute force, and resource exhaustion
 */
export class RateLimiter {
  private cache: Map<string, TokenBucket>;
  private interval: number;
  private uniqueTokenPerInterval: number;

  constructor(options: RateLimitOptions) {
    this.cache = new Map();
    this.interval = options.interval;
    this.uniqueTokenPerInterval = options.uniqueTokenPerInterval;

    // Clean up expired entries every interval
    setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of this.cache.entries()) {
        if (bucket.resetTime < now) {
          this.cache.delete(key);
        }
      }
    }, this.interval);
  }

  /**
   * Check if request is within rate limit
   * @param token - Unique identifier (IP address, user ID, etc.)
   * @param limit - Maximum requests allowed in the interval
   * @returns Rate limit result
   */
  check(token: string, limit: number): RateLimitResult {
    const now = Date.now();
    const bucket = this.cache.get(token);

    if (!bucket || bucket.resetTime < now) {
      // Create new bucket
      const newBucket: TokenBucket = {
        count: 1,
        resetTime: now + this.interval,
      };
      this.cache.set(token, newBucket);

      // Enforce max unique tokens
      if (this.cache.size > this.uniqueTokenPerInterval) {
        // Remove oldest entry
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
          this.cache.delete(firstKey);
        }
      }

      return {
        success: true,
        limit,
        remaining: limit - 1,
        reset: newBucket.resetTime,
      };
    }

    // Increment count
    bucket.count += 1;

    const success = bucket.count <= limit;
    const remaining = Math.max(0, limit - bucket.count);

    return {
      success,
      limit,
      remaining,
      reset: bucket.resetTime,
    };
  }

  /**
   * Reset rate limit for a specific token
   * @param token - Token to reset
   */
  reset(token: string): void {
    this.cache.delete(token);
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.cache.clear();
  }
}

/**
 * Get client identifier from request
 * Uses X-Forwarded-For header or IP address
 */
export function getClientId(request: NextRequest): string {
  // Try to get real IP from various headers (for proxied requests)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to a consistent identifier
  // Note: In Next.js 16, request.ip is not available, so we use 'unknown' as fallback
  return 'unknown';
}

/**
 * Create rate limiter instances for different endpoints
 */
export const rateLimiters = {
  /** General API rate limiter: 100 requests per minute */
  api: new RateLimiter({
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 500,
  }),

  /** Strict rate limiter for auth endpoints: 5 requests per minute */
  auth: new RateLimiter({
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 100,
  }),

  /** Write operations: 30 requests per minute */
  write: new RateLimiter({
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 500,
  }),
};

/**
 * Rate limit middleware helper
 * @param request - Next.js request object
 * @param limiter - Rate limiter instance
 * @param limit - Maximum requests allowed
 * @returns Rate limit result
 */
export function checkRateLimit(
  request: NextRequest,
  limiter: RateLimiter,
  limit: number
): RateLimitResult {
  // TESTING: Skip rate limiting in test environment
  if (process.env.NODE_ENV === 'test') {
    return {
      success: true,
      limit,
      remaining: limit,
      reset: Date.now() + 60000,
    };
  }

  const clientId = getClientId(request);
  return limiter.check(clientId, limit);
}
