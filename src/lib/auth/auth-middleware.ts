/**
 * Authentication Middleware
 * Stub implementation for build compatibility
 */

import { NextRequest, NextResponse } from 'next/server';

export interface AdminUser {
  adminId: string;
  email: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string;
}

export class AuthValidators {
  static loginSchema = {
    email: { required: true, type: 'email' },
    password: { required: true, minLength: 6 },
  };

  static refreshSchema = {
    refreshToken: { required: true, type: 'string' },
  };
}

export function validateRequestBody(body: any, schema: any): { isValid: boolean; errors: string[] } {
  // Stub validation
  return { isValid: true, errors: [] };
}

export class AuthMiddleware {
  static withAuth(handler: (request: NextRequest, admin: AdminUser) => Promise<NextResponse>) {
    return async (request: NextRequest) => {
      try {
        // Stub authentication - in real implementation would validate JWT token
        const mockAdmin: AdminUser = {
          adminId: 'admin-1',
          email: 'admin@example.com',
          roles: ['admin'],
          permissions: ['read', 'write'],
          sessionId: 'session-1',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          ipAddress: '127.0.0.1',
        };

        return await handler(request, mockAdmin);
      } catch (error) {
        return this.createErrorResponse('Authentication failed', 'AUTH_ERROR', 401);
      }
    };
  }

  static withPermissions(permissions: string[]) {
    return (handler: (request: NextRequest, admin: AdminUser) => Promise<NextResponse>) => {
      return this.withAuth(async (request: NextRequest, admin: AdminUser) => {
        // Stub permission check
        return await handler(request, admin);
      });
    };
  }

  static createSuccessResponse(data: any, message: string = 'Success') {
    return NextResponse.json({
      success: true,
      message,
      data,
    });
  }

  static createErrorResponse(message: string, code: string, status: number = 400) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message,
          code,
        },
      },
      { status }
    );
  }

  static authenticate(request: NextRequest): AdminUser | null {
    // Stub implementation
    return {
      adminId: 'admin-1',
      email: 'admin@example.com',
      roles: ['admin'],
      permissions: ['read', 'write'],
      sessionId: 'session-1',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      ipAddress: '127.0.0.1',
    };
  }
}