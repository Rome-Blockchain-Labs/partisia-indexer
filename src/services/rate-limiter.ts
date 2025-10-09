import { EventEmitter } from 'events';
import crypto from 'crypto';

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface RequestMetrics {
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  lastFailureTime: number;
  totalLatency: number;
  p99Latency: number;
}

interface RetryBudget {
  tokensRemaining: number;
  maxTokens: number;
  refillRate: number;
  lastRefillTime: number;
}

class RateLimiter extends EventEmitter {
  private circuitState: CircuitState = CircuitState.CLOSED;
  private metrics: RequestMetrics = {
    successCount: 0,
    failureCount: 0,
    consecutiveFailures: 0,
    lastFailureTime: 0,
    totalLatency: 0,
    p99Latency: 0
  };

  private retryBudget: RetryBudget = {
    tokensRemaining: 100,
    maxTokens: 100,
    refillRate: 10, // tokens per second
    lastRefillTime: Date.now()
  };

  // Request deduplication
  private inflightRequests = new Map<string, Promise<any>>();
  private requestCache = new Map<string, { data: any; timestamp: number }>();

  // Aggressive rate limiting optimized for 5 RPS constant limit
  private currentRateLimit = 5; // requests per second (known limit)
  private minRateLimit = 1;
  private maxRateLimit = 5; // Never exceed known API limit
  private rateLimitWindow: number[] = [];
  private requestQueue: Array<{ resolve: Function; reject: Function; timestamp: number }> = [];

  // Circuit breaker configuration
  private readonly failureThreshold = 5;
  private readonly successThreshold = 2;
  private readonly halfOpenTimeout = 30000; // 30 seconds
  private halfOpenTimer: NodeJS.Timeout | null = null;

  // Security: Constant time comparison for cache keys
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  // Generate cache key with proper hashing
  private getCacheKey(url: string, params?: any): string {
    const data = JSON.stringify({ url, params });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Optimized backoff for constant-time rate limiter
  private calculateBackoffMs(attempt: number, statusCode?: number): number {
    if (statusCode === 429) {
      // For rate limits, wait exactly 200ms (5 RPS = 200ms intervals)
      return 200 + Math.random() * 50; // Small jitter to prevent thundering herd
    }

    // For other errors, minimal backoff since we know the rate limit pattern
    const baseDelay = 100;
    const maxDelay = 5000; // Max 5 seconds, not 60

    return Math.min(baseDelay * (attempt + 1), maxDelay);
  }

  // Refill retry budget using token bucket algorithm
  private refillRetryBudget(): void {
    const now = Date.now();
    const elapsed = (now - this.retryBudget.lastRefillTime) / 1000;
    const tokensToAdd = Math.floor(elapsed * this.retryBudget.refillRate);

    if (tokensToAdd > 0) {
      this.retryBudget.tokensRemaining = Math.min(
        this.retryBudget.tokensRemaining + tokensToAdd,
        this.retryBudget.maxTokens
      );
      this.retryBudget.lastRefillTime = now;
    }
  }

  // Consume retry budget token
  private consumeRetryToken(): boolean {
    this.refillRetryBudget();

    if (this.retryBudget.tokensRemaining > 0) {
      this.retryBudget.tokensRemaining--;
      return true;
    }
    return false;
  }

  // Update circuit breaker state
  private updateCircuitState(success: boolean): void {
    if (success) {
      this.metrics.successCount++;
      this.metrics.consecutiveFailures = 0;

      if (this.circuitState === CircuitState.HALF_OPEN) {
        if (this.metrics.successCount >= this.successThreshold) {
          this.transitionToClosedState();
        }
      }
    } else {
      this.metrics.failureCount++;
      this.metrics.consecutiveFailures++;
      this.metrics.lastFailureTime = Date.now();

      if (this.metrics.consecutiveFailures >= this.failureThreshold) {
        this.transitionToOpenState();
      }
    }
  }

  private transitionToOpenState(): void {
    if (this.circuitState !== CircuitState.OPEN) {
      this.circuitState = CircuitState.OPEN;
      this.emit('circuit-open');

      // Schedule transition to half-open
      this.halfOpenTimer = setTimeout(() => {
        this.transitionToHalfOpenState();
      }, this.halfOpenTimeout);
    }
  }

  private transitionToHalfOpenState(): void {
    this.circuitState = CircuitState.HALF_OPEN;
    this.metrics.successCount = 0;
    this.metrics.failureCount = 0;
    this.emit('circuit-half-open');
  }

  private transitionToClosedState(): void {
    this.circuitState = CircuitState.CLOSED;
    this.metrics.consecutiveFailures = 0;

    if (this.halfOpenTimer) {
      clearTimeout(this.halfOpenTimer);
      this.halfOpenTimer = null;
    }

    this.emit('circuit-closed');
  }

  // Aggressive rate adjustment for known 5 RPS limit
  private adjustRateLimit(responseTime: number, statusCode: number): void {
    const now = Date.now();

    // Clean old entries (keep last 1 second for precise 5 RPS tracking)
    this.rateLimitWindow = this.rateLimitWindow.filter(t => t > now - 1000);
    this.rateLimitWindow.push(now);

    if (statusCode === 429) {
      // Hit rate limit - back off slightly but stay aggressive
      this.currentRateLimit = Math.max(3, this.currentRateLimit - 1);
      console.log(`Rate limited, backing off to ${this.currentRateLimit} RPS`);
    } else if (statusCode >= 500) {
      // Server error: minimal decrease
      this.currentRateLimit = Math.max(2, this.currentRateLimit - 0.5);
    } else if (statusCode === 200) {
      // Success: aggressively push toward 5 RPS
      if (this.rateLimitWindow.length < 4) { // Under 4 requests in last second
        this.currentRateLimit = Math.min(5, this.currentRateLimit + 0.5);
      }
    }
  }

  // Main request execution with all protections
  public async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    options: {
      url: string;
      maxRetries?: number;
      timeout?: number;
      cacheTTL?: number;
      priority?: number;
    }
  ): Promise<T> {
    const { url, maxRetries = 3, timeout = 10000, cacheTTL = 60000 } = options;
    const cacheKey = this.getCacheKey(url);

    // Check cache first
    const cached = this.requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
      return cached.data;
    }

    // Deduplicate inflight requests
    const inflight = this.inflightRequests.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    // Circuit breaker check
    if (this.circuitState === CircuitState.OPEN) {
      throw new Error('Circuit breaker is open - service unavailable');
    }

    // Create request promise
    const requestPromise = this.executeWithRetryInternal(
      requestFn,
      maxRetries,
      timeout,
      cacheKey
    );

    // Store as inflight
    this.inflightRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;

      // Cache successful result
      this.requestCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      // Limit cache size
      if (this.requestCache.size > 1000) {
        const oldestKey = this.requestCache.keys().next().value;
        this.requestCache.delete(oldestKey);
      }

      return result;
    } finally {
      this.inflightRequests.delete(cacheKey);
    }
  }

  private async executeWithRetryInternal<T>(
    requestFn: () => Promise<T>,
    maxRetries: number,
    timeout: number,
    cacheKey: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0 && !this.consumeRetryToken()) {
        throw new Error('Retry budget exhausted');
      }

      await this.enforceRateLimit();

      const startTime = Date.now();

      try {
        // Execute with timeout
        const result = await this.executeWithTimeout(requestFn, timeout);

        // Update metrics
        const responseTime = Date.now() - startTime;
        this.updateCircuitState(true);
        this.adjustRateLimit(responseTime, 200);

        return result;
      } catch (error: any) {
        lastError = error;
        const responseTime = Date.now() - startTime;

        // Determine if retryable
        const statusCode = error.response?.status || 0;
        const isRetryable = this.isRetryableError(statusCode, error);

        // Update metrics
        this.updateCircuitState(false);
        this.adjustRateLimit(responseTime, statusCode);

        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }

        // Calculate minimal backoff for known rate limit pattern
        const backoffMs = this.calculateBackoffMs(attempt, statusCode);
        this.emit('retry', { attempt, backoffMs, error: error.message, statusCode });

        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    throw lastError || new Error('Request failed');
  }

  private async executeWithTimeout<T>(
    requestFn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      requestFn(),
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeout);
      })
    ]);
  }

  // Maximum efficiency rate limiting - queue requests for precise 5 RPS
  private async enforceRateLimit(): Promise<void> {
    return new Promise((resolve) => {
      const now = Date.now();
      const windowStart = now - 1000;

      // Clean old requests
      this.rateLimitWindow = this.rateLimitWindow.filter(t => t > windowStart);

      const recentRequests = this.rateLimitWindow.length;

      if (recentRequests < this.currentRateLimit) {
        // Can send immediately
        this.rateLimitWindow.push(now);
        resolve();
      } else {
        // Queue for next available slot
        const oldestRequest = Math.min(...this.rateLimitWindow);
        const nextSlotTime = oldestRequest + 200; // 200ms intervals for 5 RPS
        const delayMs = Math.max(0, nextSlotTime - now);

        setTimeout(() => {
          this.rateLimitWindow.push(Date.now());
          resolve();
        }, delayMs);
      }
    });
  }

  private isRetryableError(statusCode: number, error: any): boolean {
    // For 429 rate limits, always retry aggressively
    if (statusCode === 429) {
      return true;
    }

    // Never retry client errors except rate limits
    if (statusCode >= 400 && statusCode < 500) {
      return false;
    }

    // Retry server errors
    if (statusCode >= 500) {
      return true;
    }

    // Retry timeout and network errors
    const retryableMessages = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'timeout'
    ];

    return retryableMessages.some(msg =>
      error.message?.toLowerCase().includes(msg.toLowerCase())
    );
  }

  public getStats() {
    return {
      circuitState: this.circuitState,
      metrics: { ...this.metrics },
      retryBudget: { ...this.retryBudget },
      currentRateLimit: this.currentRateLimit,
      inflightRequests: this.inflightRequests.size,
      cacheSize: this.requestCache.size
    };
  }

  public reset(): void {
    this.transitionToClosedState();
    this.metrics = {
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
      lastFailureTime: 0,
      totalLatency: 0,
      p99Latency: 0
    };
    this.retryBudget.tokensRemaining = this.retryBudget.maxTokens;
    this.inflightRequests.clear();
    this.requestCache.clear();
    this.currentRateLimit = 5; // Start at known API limit
    this.requestQueue = [];
  }
}

export default RateLimiter;