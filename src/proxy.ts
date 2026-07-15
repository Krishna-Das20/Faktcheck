import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 Proxy — security layer matching KK's Express middleware.
 *
 * Provides:
 * - Body size limiting (10KB for JSON, equivalent to KK's express.json({ limit: '10kb' }))
 * - NoSQL injection sanitization (replaces $ and . in query params, equivalent to express-mongo-sanitize)
 * - HPP protection (strips duplicate query parameters, equivalent to hpp)
 */

// Routes that need larger body limits (file uploads)
const LARGE_BODY_ROUTES = ["/api/upload"];
const MAX_BODY_SIZE = 10 * 1024; // 10KB — matches KK's express.json({ limit: '10kb' })

/**
 * Sanitize a string to prevent NoSQL injection.
 * Replaces $ characters at the start of values (matches express-mongo-sanitize behavior).
 */
function sanitizeValue(value: string): string {
  return value.replace(/^\$/, "_");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Security checks for API routes ---
  if (pathname.startsWith("/api/")) {
    // Body Size Limiting
    const contentLength = request.headers.get("content-length");
    const isLargeBodyRoute = LARGE_BODY_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

    if (
      contentLength &&
      !isLargeBodyRoute &&
      parseInt(contentLength) > MAX_BODY_SIZE
    ) {
      return NextResponse.json(
        { success: false, message: "Request body too large (max 10KB)" },
        { status: 413 }
      );
    }

    // NoSQL Injection Sanitization (query params)
    const url = request.nextUrl.clone();
    let sanitized = false;

    url.searchParams.forEach((value, key) => {
      if (key.includes("$") || key.startsWith(".")) {
        url.searchParams.delete(key);
        const safeKey = key.replace(/\$/g, "_").replace(/^\./g, "_");
        url.searchParams.set(safeKey, value);
        sanitized = true;
      }
      const safeValue = sanitizeValue(value);
      if (safeValue !== value) {
        url.searchParams.set(key, safeValue);
        sanitized = true;
      }
    });

    // HPP Protection (strip duplicate query params)
    const ALLOWED_DUPLICATES = ["status", "difficulty", "category", "page", "limit", "sort"];
    const seen = new Set<string>();
    const toDelete: string[] = [];

    url.searchParams.forEach((_value, key) => {
      if (!ALLOWED_DUPLICATES.includes(key)) {
        if (seen.has(key)) {
          toDelete.push(key);
        }
        seen.add(key);
      }
    });

    if (toDelete.length > 0) {
      for (const key of toDelete) {
        const values = url.searchParams.getAll(key);
        url.searchParams.delete(key);
        url.searchParams.set(key, values[values.length - 1]);
      }
      sanitized = true;
    }

    if (sanitized) {
      return NextResponse.rewrite(url);
    }
  }

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
