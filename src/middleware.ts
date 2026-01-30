import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './lib/i18n/config';
import { JWTService } from './lib/auth/jwt-service';

// Create the internationalization middleware
const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});

// Admin route protection
async function protectAdminRoutes(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  
  // Check if this is an admin route (excluding login)
  const isAdminRoute = pathname.includes('/admin') && !pathname.includes('/admin/login');
  
  if (!isAdminRoute) {
    return null; // Not an admin route, continue
  }

  try {
    // Extract token from cookies or Authorization header
    const token = request.cookies.get('admin_token')?.value || 
                 request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      // No token found, redirect to login
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Verify the JWT token
    const payload = JWTService.verifyAccessToken(token);
    
    if (!payload || !payload.sessionId) {
      // Invalid token, redirect to login
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('admin_token');
      return response;
    }

    // Token is valid, add admin info to headers for API routes
    const response = NextResponse.next();
    response.headers.set('x-admin-session', payload.sessionId);
    response.headers.set('x-admin-id', payload.adminId);
    
    return response;

  } catch (error) {
    // Token verification failed, redirect to login
    console.error('Admin route protection error:', error);
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('admin_token');
    return response;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Handle API routes - skip internationalization but apply admin protection for admin APIs
  if (pathname.startsWith('/api/')) {
    // Protect admin API routes
    if (pathname.startsWith('/api/admin/') && !pathname.includes('/api/admin/auth/login')) {
      try {
        const token = request.cookies.get('admin_token')?.value || 
                     request.headers.get('authorization')?.replace('Bearer ', '');

        if (!token) {
          return NextResponse.json(
            { error: 'Authorization token required' },
            { status: 401 }
          );
        }

        const payload = JWTService.verifyAccessToken(token);
        
        if (!payload || !payload.sessionId) {
          return NextResponse.json(
            { error: 'Invalid or expired token' },
            { status: 401 }
          );
        }

        // Add admin info to headers for API handlers
        const response = NextResponse.next();
        response.headers.set('x-admin-session', payload.sessionId);
        response.headers.set('x-admin-id', payload.adminId);
        response.headers.set('x-admin-email', payload.email);
        
        return response;

      } catch (error) {
        console.error('Admin API protection error:', error);
        return NextResponse.json(
          { error: 'Authentication failed' },
          { status: 401 }
        );
      }
    }
    
    return NextResponse.next();
  }

  // Handle static files - skip all middleware
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/sw.js') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Apply admin route protection first
  const adminProtectionResponse = await protectAdminRoutes(request);
  if (adminProtectionResponse) {
    return adminProtectionResponse;
  }

  // Apply internationalization middleware for all other routes
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)',
    // Also match API routes for admin protection
    '/api/admin/:path*'
  ],
};