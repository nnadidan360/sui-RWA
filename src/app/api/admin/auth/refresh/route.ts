/**
 * Admin Token Refresh API Route
 * 
 * Handles access token refresh using refresh tokens
 */

import { NextRequest } from 'next/server';
import { AdminAuthService } from '@/lib/auth/admin-auth-service';
import { AuthMiddleware, validateRequestBody, AuthValidators } from '@/lib/auth/auth-middleware';

const authService = new AdminAuthService();

export async function POST(request: NextRequest) {
  try {
    // Get client information
    const { ipAddress, userAgent } = AuthMiddleware.getClientInfo(request);

    // Validate request body
    const validation = await validateRequestBody(request, AuthValidators.refreshToken);
    
    if (!validation.isValid) {
      return AuthMiddleware.createErrorResponse(
        'Invalid request data',
        'VALIDATION_ERROR',
        400,
        { errors: validation.errors }
      );
    }

    const { refreshToken } = validation.data!;

    // Refresh tokens
    const tokens = await authService.refreshToken(refreshToken, ipAddress, userAgent);

    return AuthMiddleware.createSuccessResponse(
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      },
      'Token refresh successful',
      200
    );

  } catch (error: any) {
    console.error('Token refresh API error:', error);

    // Handle specific authentication errors
    if (error.code) {
      return AuthMiddleware.createErrorResponse(
        error.message,
        error.code,
        error.statusCode || 401
      );
    }

    return AuthMiddleware.createErrorResponse(
      'Token refresh failed',
      'REFRESH_FAILED',
      401
    );
  }
}