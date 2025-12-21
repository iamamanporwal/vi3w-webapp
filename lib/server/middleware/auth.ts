import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, AuthError } from '../auth';

/**
 * Authentication middleware for Next.js API routes
 * Extracts token from Authorization header and verifies it
 * 
 * Usage:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   try {
 *     const userId = await requireAuth(request);
 *     // userId is guaranteed to be valid here
 *   } catch (error) {
 *     return createAuthErrorResponse(error.message, 401);
 *   }
 * }
 * ```
 */
export async function requireAuth(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    throw new AuthError('Authorization header missing', 'MISSING_AUTH_HEADER');
  }
  
  try {
    const userId = await verifyToken(authHeader);
    
    if (!userId) {
      throw new AuthError('Failed to verify token: no user ID returned', 'TOKEN_VERIFICATION_FAILED');
    }
    
    return userId;
  } catch (error: any) {
    // Re-throw AuthError as-is
    if (error instanceof AuthError) {
      throw error;
    }
    
    // Wrap other errors
    throw new AuthError(`Authentication failed: ${error.message || 'Unknown error'}`, 'AUTH_FAILED', error);
  }
}

/**
 * Optional authentication - returns userId if token is valid, null otherwise
 * Does not throw errors, returns null on any failure
 */
export async function optionalAuth(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return null;
  }
  
  try {
    const userId = await verifyToken(authHeader);
    return userId || null;
  } catch {
    // Silently return null on any error
    return null;
  }
}

/**
 * Create an error response for authentication failures
 */
export function createAuthErrorResponse(message: string, status: number = 401): NextResponse {
  return NextResponse.json(
    { 
      error: message,
      code: 'AUTH_ERROR',
    },
    { status }
  );
}

/**
 * Create a success response with user ID
 */
export function createAuthSuccessResponse(userId: string, data?: any): NextResponse {
  return NextResponse.json({
    success: true,
    userId,
    ...data,
  });
}

/**
 * Wrapper function to handle auth-protected routes
 * Automatically handles errors and returns appropriate responses
 */
export async function withAuth<T>(
  request: NextRequest,
  handler: (userId: string, request: NextRequest) => Promise<T>
): Promise<NextResponse> {
  try {
    const userId = await requireAuth(request);
    const result = await handler(userId, request);
    
    // If handler returns a NextResponse, return it directly
    if (result instanceof NextResponse) {
      return result;
    }
    
    // Otherwise, wrap in JSON response
    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof AuthError) {
      return createAuthErrorResponse(error.message, 401);
    }
    
    // Handle other errors
    const status = error.status || error.statusCode || 500;
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        code: error.code || 'INTERNAL_ERROR',
      },
      { status }
    );
  }
}
