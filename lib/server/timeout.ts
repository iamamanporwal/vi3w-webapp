/**
 * Timeout utilities for async operations
 */

/**
 * Create a promise that rejects after a timeout
 */
export function createTimeout(ms: number, message: string = 'Operation timed out'): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Race a promise against a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([promise, createTimeout(ms, message)]);
}

/**
 * Create a timeout error
 */
export class TimeoutError extends Error {
  constructor(message: string = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

