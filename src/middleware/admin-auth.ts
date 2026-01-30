import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export interface AdminAuthContext {
  userId: string;
  role: 'admin' | 'super_admin';
  walletAddress: string;
}

export async function verifyAdminAuth(request: NextRequest): Promise<AdminAuthContext | null> {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    if (!decoded.userId || !['admin', 'super_admin'].includes(decoded.role)) {
      return null;
    }

    return {
      userId: decoded.userId,
      role: decoded.role,
      walletAddress: decoded.walletAddress
    };
  } catch (error) {
    return null;
  }
}

export function createAdminAuthMiddleware() {
  return async (request: NextRequest) => {
    const authContext = await verifyAdminAuth(request);
    
    if (!authContext) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    // Add auth context to request headers for downstream handlers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-admin-user-id', authContext.userId);
    requestHeaders.set('x-admin-role', authContext.role);
    requestHeaders.set('x-admin-wallet', authContext.walletAddress);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  };
}