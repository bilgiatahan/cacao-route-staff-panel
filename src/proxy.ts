import { NextResponse, type NextRequest } from "next/server";

import { PROTECTED_PREFIXES, ROUTES } from "@/lib/routes";

/**
 * Optimistic auth check (Next.js 16 renamed Middleware to Proxy).
 *
 * This only looks at whether a session cookie exists — it deliberately does no
 * database work, because the proxy runs on every request including prefetches.
 * Real authorisation happens in the data access layer (`server/auth/session`).
 */

const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => Boolean(request.cookies.get(name)?.value));
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authenticated = hasSessionCookie(request);

  if (isProtected(pathname) && !authenticated) {
    const loginUrl = new URL(ROUTES.login, request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === ROUTES.login && authenticated) {
    return NextResponse.redirect(new URL(ROUTES.summary, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
