import { SESSION_COOKIE } from 'contracts';
import { type NextRequest, NextResponse } from 'next/server';

/** Optimistic redirect only. The API verifies the session on every request; this just avoids rendering a page that would 401. */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!login|api|_next|icon.svg).*)'],
};
