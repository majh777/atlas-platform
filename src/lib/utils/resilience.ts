/**
 * Resilience utilities for Atlas
 * Provides retry logic, circuit breakers, and graceful degradation patterns
 */

// =============================================================================
// RETRY LOGIC
// =============================================================================

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: (error: Error) => boolean;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  retryableErrors: (error) => {
    // By default, retry on transient errors
    const message = error.message.toLowerCase();
    return (
      message.includes('busy') ||
      message.includes('locked') ||
      message.includes('timeout') ||
      message.includes('temporarily')
    );
  },
};

/**
 * Executes a function with exponential backoff retry logic.
 */
export async function withRetry<T>(
  fn: () => T | Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = opts.baseDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === opts.maxAttempts) {
        throw lastError;
      }

      if (opts.retryableErrors && !opts.retryableErrors(lastError)) {
        throw lastError;
      }

      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Synchronous retry for SQLite operations
 */
export function withRetrySync<T>(
  fn: () => T,
  options: Partial<RetryOptions> = {}
): T {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === opts.maxAttempts) {
        throw lastError;
      }

      if (opts.retryableErrors && !opts.retryableErrors(lastError)) {
        throw lastError;
      }

      // Synchronous "backoff" - just a tight loop in sync context
      // In production, consider a busy-wait or other strategy
    }
  }

  throw lastError;
}

// =============================================================================
// CIRCUIT BREAKER
// =============================================================================

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeMs: number;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private lastFailure: number | null = null;
  private readonly options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeMs: options.resetTimeMs ?? 30000,
    };
  }

  getState(): CircuitState {
    return this.state;
  }

  isOpen(): boolean {
    if (this.state === 'open' && this.lastFailure) {
      const elapsed = Date.now() - this.lastFailure;
      if (elapsed >= this.options.resetTimeMs) {
        this.state = 'half-open';
        return false;
      }
    }
    return this.state === 'open';
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailure = null;
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.failures >= this.options.failureThreshold) {
      this.state = 'open';
    }
  }

  /**
   * Execute a function through the circuit breaker.
   * Throws CircuitOpenError if the circuit is open.
   */
  execute<T>(fn: () => T): T {
    if (this.isOpen()) {
      throw new CircuitOpenError('Circuit breaker is open');
    }

    try {
      const result = fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Async version of execute
   */
  async executeAsync<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new CircuitOpenError('Circuit breaker is open');
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
}

export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

// =============================================================================
// INPUT VALIDATION
// =============================================================================

/**
 * Validates and sanitizes pagination parameters
 */
export function sanitizePagination(input: { limit?: number; offset?: number }): {
  limit: number;
  offset: number;
} {
  let limit = input.limit ?? 50;
  let offset = input.offset ?? 0;

  // Validate types
  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    limit = 50;
  }
  if (typeof offset !== 'number' || !Number.isFinite(offset)) {
    offset = 0;
  }

  // Clamp values
  limit = Math.max(0, Math.min(limit, 1000)); // Max 1000 results
  offset = Math.max(0, offset);

  return { limit, offset };
}

/**
 * Validates that a string is a valid UUID
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Validates that a string is a valid ISO date
 */
export function isValidISODate(str: string): boolean {
  if (typeof str !== 'string') return false;
  const date = new Date(str);
  return !isNaN(date.getTime()) && str === date.toISOString();
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email);
}

/**
 * Sanitizes a string for safe storage (removes null bytes, trims to max length)
 */
export function sanitizeString(str: string, maxLength = 10000): string {
  if (typeof str !== 'string') return '';
  return str.replace(/\0/g, '').slice(0, maxLength);
}

/**
 * Validates slug format
 */
export function isValidSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return typeof slug === 'string' && slugRegex.test(slug);
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * Wraps a database error with a user-friendly message
 * Prevents leaking internal schema details
 */
export function wrapDatabaseError(error: unknown, operation: string): Error {
  if (error instanceof Error) {
    // Log the full error for debugging
    console.error(`Database error in ${operation}:`, error.message);

    // Check for specific error types and return safe messages
    if (error.message.includes('UNIQUE constraint')) {
      return new DatabaseError('A record with this value already exists', 'DUPLICATE');
    }
    if (error.message.includes('FOREIGN KEY constraint')) {
      return new DatabaseError('Referenced record does not exist', 'REFERENCE');
    }
    if (error.message.includes('CHECK constraint')) {
      return new DatabaseError('Invalid value provided', 'VALIDATION');
    }
    if (error.message.includes('NOT NULL constraint')) {
      return new DatabaseError('Required field is missing', 'REQUIRED');
    }
    if (error.message.includes('database is locked')) {
      return new DatabaseError('Database is temporarily unavailable', 'LOCKED');
    }

    return new DatabaseError('An error occurred while processing your request', 'UNKNOWN');
  }

  return new DatabaseError('An unexpected error occurred', 'UNKNOWN');
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code: 'DUPLICATE' | 'REFERENCE' | 'VALIDATION' | 'REQUIRED' | 'LOCKED' | 'UNKNOWN'
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

// =============================================================================
// GRACEFUL DEGRADATION
// =============================================================================

/**
 * Returns a default value if the function throws
 */
export function withFallback<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/**
 * Async version of withFallback
 */
export async function withFallbackAsync<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/**
 * Wraps a function and returns null on any error
 */
export function nullOnError<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

// =============================================================================
// UTILITIES
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Rate limiter for operations
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  tryAcquire(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens--;
      return true;
    }
    return false;
  }

  acquire(): void {
    if (!this.tryAcquire()) {
      throw new RateLimitError('Rate limit exceeded');
    }
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Timeout wrapper for operations
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new TimeoutError(errorMessage)), timeoutMs)
    ),
  ]);
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}
