import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import { verifyToken, type JWTPayload } from "@/lib/auth";

export interface AuthenticatedUser {
  _id: string;
  name: string;
  email: string;
  role: "USER" | "ORGANISER" | "ADMIN";
}

/**
 * Extract and verify the JWT from the Authorization header.
 * Returns the decoded user or null if not authenticated.
 */
export async function getAuthUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  // Fallback: token in query param (needed for SSE EventSource)
  const queryToken = request.nextUrl.searchParams.get("token");

  const effectiveToken = token || queryToken;
  if (!effectiveToken) return null;

  try {
    const decoded: JWTPayload = await verifyToken(effectiveToken);
    await connectDB();
    const user = await User.findById(decoded.userId).select("-password").lean();
    if (!user) return null;

    return {
      _id: (user._id as any).toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };
  } catch {
    return null;
  }
}

/**
 * Require authentication. Returns user or throws.
 */
export async function requireAuth(request: NextRequest): Promise<AuthenticatedUser> {
  const user = await getAuthUser(request);
  if (!user) {
    throw new Error("NOT_AUTHENTICATED");
  }
  return user;
}

/**
 * Require admin or organiser role.
 */
export async function requireAdminOrOrganiser(request: NextRequest): Promise<AuthenticatedUser> {
  const user = await requireAuth(request);
  if (user.role !== "ADMIN" && user.role !== "ORGANISER") {
    throw new Error("NOT_AUTHORIZED");
  }
  return user;
}

/**
 * Require admin role.
 */
export async function requireAdmin(request: NextRequest): Promise<AuthenticatedUser> {
  const user = await requireAuth(request);
  if (user.role !== "ADMIN") {
    throw new Error("NOT_AUTHORIZED");
  }
  return user;
}
