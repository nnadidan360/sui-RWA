/**
 * Admin Logout API Route
 * 
 * Handles admin logout and session cleanup
 */

import { NextRequest } from 'next/server';
import { AdminAuthService } from '@/lib/auth/admin-auth-service';
import { AuthMiddleware } from '@/lib/auth/auth-middleware';

const authService = new AdminAuthService();

export async function POST(request: NextRequest) {
  try {
    // Get client information
    const { ipAddress, userAgent } = AuthMiddleware.getClientInfo(request);

    // Authenticate the request to get session info
    const authResult = await AuthMiddleware.authenticate(request);
    
    if (!authResult.success) {
      // Even if authentication fails, we'll try to logout gracefully
      return AuthMiddleware.createSuccessResponse(
        null,
        'Logout completed',
        200
      );
    }

    const session = authResult.admin!;

    // Perform logout
    await authService.logout(session.sessionId, ipAddress, userAgent);

    return AuthMiddleware.createSuccessResponse(
      null,
      'Logout successful',
      200
    );

  } catch (error: any) {
    console.error('Logout API error:', error);

    // For logout, we generally want to succeed even if there are errors
    // to ensure the client can clear their tokens
    return AuthMiddleware.createSuccessResponse(
      null,
      'Logout completed',
      200
    );
  }
}