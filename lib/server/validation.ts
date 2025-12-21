/**
 * Input validation utilities
 */

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate prompt string
 */
export function validatePrompt(prompt: string | undefined, fieldName: string = 'prompt'): void {
  if (prompt !== undefined) {
    if (typeof prompt !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`, fieldName);
    }
    const trimmed = prompt.trim();
    if (trimmed.length === 0) {
      throw new ValidationError(`${fieldName} cannot be empty`, fieldName);
    }
    if (trimmed.length > 2000) {
      throw new ValidationError(`${fieldName} is too long (max 2000 characters)`, fieldName);
    }
  }
}

/**
 * Validate image path/URL
 */
export function validateImagePath(imagePath: string | undefined, fieldName: string = 'imagePath'): void {
  if (imagePath !== undefined) {
    if (typeof imagePath !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`, fieldName);
    }
    const trimmed = imagePath.trim();
    if (trimmed.length === 0) {
      throw new ValidationError(`${fieldName} cannot be empty`, fieldName);
    }
    // Basic URL validation
    try {
      new URL(trimmed);
    } catch {
      // Not a URL, might be a file path - that's okay
      if (trimmed.length > 2048) {
        throw new ValidationError(`${fieldName} is too long`, fieldName);
      }
    }
  }
}

/**
 * Validate workflow input
 */
export function validateWorkflowInput(input: {
  prompt?: string;
  imagePath?: string;
}): void {
  if (!input.prompt && !input.imagePath) {
    throw new ValidationError('Either prompt or imagePath must be provided');
  }

  validatePrompt(input.prompt);
  validateImagePath(input.imagePath);
}

/**
 * Validate user ID
 */
export function validateUserId(userId: string): void {
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    throw new ValidationError('Invalid user ID');
  }
  if (userId.length > 128) {
    throw new ValidationError('User ID is too long');
  }
}

