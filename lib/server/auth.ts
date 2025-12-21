import admin from './firebase-admin';

/**
 * Custom error classes
 */
export class AuthError extends Error {
  constructor(message: string, public code?: string, public originalError?: any) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Validate token format
 */
function validateTokenFormat(token: string): void {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    throw new AuthError('Token is required and must be a non-empty string', 'INVALID_TOKEN_FORMAT');
  }
  
  // Firebase ID tokens are typically JWT format (3 parts separated by dots)
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AuthError('Invalid token format: expected JWT format', 'INVALID_TOKEN_FORMAT');
  }
  
  // Basic length validation
  if (token.length < 100 || token.length > 10000) {
    throw new AuthError('Invalid token: length out of expected range', 'INVALID_TOKEN_FORMAT');
  }
}

/**
 * Verify Firebase ID token and return user ID
 * @param token - Firebase ID token from Authorization header
 * @returns User ID if token is valid
 * @throws AuthError if token is invalid or expired
 */
export async function verifyToken(token: string): Promise<string> {
  try {
    if (!token) {
      throw new AuthError('Token is required', 'TOKEN_MISSING');
    }
    
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    
    // Validate token format
    validateTokenFormat(cleanToken);
    
    // Verify token with Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(cleanToken, true); // Check if revoked
    
    // Validate decoded token
    if (!decodedToken || !decodedToken.uid) {
      throw new AuthError('Invalid token: missing user ID', 'INVALID_TOKEN');
    }
    
    // Additional validation: check if user is disabled
    try {
      const userRecord = await admin.auth().getUser(decodedToken.uid);
      if (userRecord.disabled) {
        throw new AuthError('User account is disabled', 'USER_DISABLED');
      }
    } catch (error: any) {
      // If user doesn't exist or other error, still allow (token is valid)
      // This handles edge cases where user might be deleted but token is still valid
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }
    
    return decodedToken.uid;
  } catch (error: any) {
    // Handle specific Firebase Auth errors
    if (error instanceof AuthError) {
      throw error;
    }
    
    if (error.code === 'auth/id-token-expired') {
      throw new AuthError('Token expired. Please sign in again.', 'TOKEN_EXPIRED', error);
    }
    if (error.code === 'auth/id-token-revoked') {
      throw new AuthError('Token revoked. Please sign in again.', 'TOKEN_REVOKED', error);
    }
    if (error.code === 'auth/argument-error') {
      throw new AuthError('Invalid token format.', 'INVALID_TOKEN_FORMAT', error);
    }
    if (error.code === 'auth/invalid-credential') {
      throw new AuthError('Invalid token credential.', 'INVALID_CREDENTIAL', error);
    }
    if (error.code === 'auth/user-disabled') {
      throw new AuthError('User account is disabled.', 'USER_DISABLED', error);
    }
    
    // Generic error
    throw new AuthError(`Authentication failed: ${error.message || 'Unknown error'}`, 'AUTH_FAILED', error);
  }
}

/**
 * Get user by ID token (convenience function)
 */
export async function getUserFromToken(token: string) {
  try {
    const userId = await verifyToken(token);
    
    if (!userId) {
      throw new AuthError('Failed to get user ID from token', 'TOKEN_VERIFICATION_FAILED');
    }
    
    const userRecord = await admin.auth().getUser(userId);
    return userRecord;
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError(`Failed to get user from token: ${error.message}`, 'GET_USER_ERROR', error);
  }
}

/**
 * Check if token is valid (non-throwing version)
 */
export async function isTokenValid(token: string): Promise<boolean> {
  try {
    await verifyToken(token);
    return true;
  } catch {
    return false;
  }
}
