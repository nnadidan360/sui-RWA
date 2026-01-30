/**
 * Admin Profile API Route
 * 
 * Returns current admin user information and session details
 */

import { NextRequest } from 'next/server';
import { AuthMiddleware } from '@/lib/auth/auth-middleware';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export const GET = AuthMiddleware.withAuth(async (request: NextRequest, admin) => {
  try {
    // Return admin session information
    return AuthMiddleware.createSuccessResponse(
      {
        admin: {
          id: admin.adminId,
          email: admin.email,
          roles: admin.roles,
          permissions: admin.permissions,
          sessionInfo: {
            sessionId: admin.sessionId,
            createdAt: admin.createdAt,
            expiresAt: admin.expiresAt,
            ipAddress: admin.ipAddress
          }
        }
      },
      'Admin profile retrieved successfully'
    );

  } catch (error: any) {
    console.error('Admin profile API error:', error);

    return AuthMiddleware.createErrorResponse(
      'Failed to retrieve admin profile',
      'PROFILE_ERROR',
      500
    );
  }
});