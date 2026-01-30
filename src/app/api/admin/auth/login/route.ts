/**
 * Admin Login API Route
 * 
 * Handles admin authentication and session creation
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
    const validation = await validateRequestBody(request, AuthValidators.loginCredentials);
    
    if (!validation.isValid) {
      return AuthMiddleware.createErrorResponse(
        'Invalid request data',
        'VALIDATION_ERROR',
        400,
        { errors: validation.errors }
      );
    }

    const credentials = validation.data!;

    // Attempt login
    const loginResult = await authService.login(credentials, ipAddress, userAgent);

    if (!loginResult.success) {
      return AuthMiddleware.createErrorResponse(
        loginResult.error || 'Login failed',
        'LOGIN_FAILED',
        401,
        { requiresMfa: loginResult.requiresMfa }
      );
    }

    // Return success response with tokens
    return AuthMiddleware.createSuccessResponse(
      {
        admin: loginResult.admin,
        accessToken: loginResult.token,
        refreshToken: loginResult.refreshToken
      },
      'Login successful',
      200
    );

  } catch (error: any) {
    console.error('Login API error:', error);

    // Handle specific authentication errors
    if (error.code) {
      return AuthMiddleware.createErrorResponse(
        error.message,
        error.code,
        error.statusCode || 500
      );
    }

    return AuthMiddleware.createErrorResponse(
      'Internal server error during login',
      'INTERNAL_ERROR',
      500
    );
  }
}