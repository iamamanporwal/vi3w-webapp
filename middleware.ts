import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect dashboard routes
  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('token')?.value;

    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Note: Full token verification happens on the server/API side or via a separate auth check endpoint
    // Middleware edge runtime has limited support for Firebase Admin SDK
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
  ],
};
