import { NextRequest, NextResponse } from 'next/server';

const protectedRoutes = [
  '/dashboard',
  '/configuration',
  '/provider-pool',
  '/model-mapping',
  '/credential-files',
  '/real-time-logs'
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  if (!isProtected) {
    return NextResponse.next();
  }

  const session = request.cookies.get('aglias_session')?.value;
  if (session === 'active') {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/dashboard/:path*', '/configuration/:path*', '/provider-pool/:path*', '/model-mapping/:path*', '/credential-files/:path*', '/real-time-logs/:path*']
};
