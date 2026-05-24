import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/admin", "/felt-it", "/profile"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!needsAuth) return NextResponse.next();

  // The auth state lives in localStorage so middleware cannot truly verify it.
  // We rely on the client-side guards for the definitive check; this middleware
  // exists so the routes are explicitly declared as protected boundaries.
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/felt-it/:path*", "/profile/:path*"],
};
