import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 Proxy — Phase 1 placeholder
 *
 * This will be expanded in Phase 2 with:
 * - JWT verification via jose (edge-compatible)
 * - Route protection (redirect to /login if unauthenticated)
 * - Role-based access control (admin, organiser)
 * - Rate limiting headers
 */
export function proxy(request: NextRequest) {
  // Phase 2 will implement auth checks here
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
