/**
 * Admin Sessions Management API Route
 * 
 * Handles session monitoring and management for administrators
 */

import { NextRequest } from 'next/server';
import { AdminAuthService } from '@/lib/auth/admin-auth-service';
import { AuthMiddleware } from '@/lib/auth/auth-middleware';
import { AdminPermission } from '@/types/auth';

const authService = new AdminAuthService();

// Get all active sessions (super admin only)
export const GET = AuthMiddleware.withPermissions(
  [AdminPermission.SYSTEM_SETTINGS],
  async (request: NextRequest, admin) => {
    try {
      const activeSessions = authService.getActiveSessions();

      // Sanitize session data for response
      const sanitizedSessions = activeSessions.map(session => ({
        sessionId: session.sessionId,
        adminId: session.adminId,
        email: session.email,
        roles: session.roles.map(r => r.name),
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent
      }));

      return AuthMiddleware.createSuccessResponse(
        {
          sessions: sanitizedSessions,
          totalSessions: sanitizedSessions.length
        },
        'Active sessions retrieved successfully'
      );

    } catch (error: any) {
      console.error('Sessions API error:', error);

      return AuthMiddleware.createErrorResponse(
        'Failed to retrieve active sessions',
        'SESSIONS_ERROR',
        500
      );
    }
  }
);

// Revoke all sessions for a specific admin (super admin only)
export const DELETE = AuthMiddleware.withPermissions(
  [AdminPermission.MANAGE_ADMINS],
  async (request: NextRequest, admin) => {
    try {
      const { searchParams } = new URL(request.url);
      const targetAdminId = searchParams.get('adminId');

      if (!targetAdminId) {
        return AuthMiddleware.createErrorResponse(
          'Admin ID is required',
          'MISSING_ADMIN_ID',
          400
        );
      }

      // Get client information
      const { ipAddress, userAgent } = AuthMiddleware.getClientInfo(request);

      // Revoke all sessions for the target admin
      await authService.revokeAllSessions(targetAdminId, ipAddress, userAgent);

      return AuthMiddleware.createSuccessResponse(
        null,
        `All sessions revoked for admin: ${targetAdminId}`
      );

    } catch (error: any) {
      console.error('Session revocation API error:', error);

      return AuthMiddleware.createErrorResponse(
        'Failed to revoke sessions',
        'REVOCATION_ERROR',
        500
      );
    }
  }
);