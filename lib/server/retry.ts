/**
 * Retry logic with exponential backoff for transient errors
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  exponentialBase?: number;
  retryable?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 60000, // 60 seconds
  exponentialBase: 2,
  retryable: (error: any) => {
    // Check if error is retryable
    if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT' || error?.code === 'ENOTFOUND') {
      return true;
    }
    if (error?.response?.status) {
      const status = error.response.status;
      // Retry on 429 (rate limit), 500-503 (server errors), 408 (timeout)
      return status === 408 || status === 429 || (status >= 500 && status <= 503);
    }
    // Check error message for transient indicators
    const errorMsg = String(error?.message || '').toLowerCase();
    return (
      errorMsg.includes('timeout') ||
      errorMsg.includes('connection') ||
      errorMsg.includes('network') ||
      errorMsg.includes('temporary') ||
      errorMsg.includes('rate limit') ||
      errorMsg.includes('too many requests') ||
      errorMsg.includes('service unavailable') ||
      errorMsg.includes('internal server error') ||
      errorMsg.includes('bad gateway') ||
      errorMsg.includes('gateway timeout')
    );
  },
};

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry if error is not retryable
      if (!opts.retryable(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt >= opts.maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.exponentialBase, attempt),
        opts.maxDelay
      );

      // Add jitter to prevent thundering herd
      const jitter = delay * 0.1 * (Math.random() % 1);
      const finalDelay = delay + jitter;

      console.log(
        `Retry attempt ${attempt + 1}/${opts.maxRetries} after ${finalDelay.toFixed(0)}ms delay. Error: ${error.message}`
      );

      await new Promise((resolve) => setTimeout(resolve, finalDelay));
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Decorator for retrying async functions
 */
export function retry(options: RetryOptions = {}) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const originalMethod = descriptor.value!;

    descriptor.value = async function (this: any, ...args: any[]) {
      return retryWithBackoff(() => originalMethod.apply(this, args), options);
    } as T;

    return descriptor;
  };
}

