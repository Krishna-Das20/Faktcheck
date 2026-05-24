import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "");
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// ─── Token Types ──────────────────────────────────────────

export interface JWTPayload {
  userId: string;
  role: "USER" | "ORGANISER" | "ADMIN";
}

// ─── JWT Functions (using jose — Edge-compatible) ─────────

export async function generateToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: payload.userId as string,
    role: payload.role as "USER" | "ORGANISER" | "ADMIN",
  };
}

// ─── Password Functions (bcryptjs — server-only) ──────────

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
