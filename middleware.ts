import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const authToken = request.cookies.get('auth_token')?.value;
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get('user-agent') || '';

  const isMedianBrowser =
    userAgent.includes('wv') &&
    userAgent.toLowerCase().includes('median');

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/forgot-password'];

  // Redirect "/" to "/dashboard" ONLY for median WebView users
  if (pathname === '/' && isMedianBrowser) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Check if the route is public
  const isPublicRoute = publicRoutes.includes(pathname);

  // Route-specific checks
  if (pathname.startsWith('/admin')) {
    if (!authToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  if (pathname.startsWith('/dashboard')) {
    if (!authToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // If accessing login/forgot-password but authenticated, redirect to dashboard
  if ((pathname === '/login' || pathname === '/forgot-password') && authToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
