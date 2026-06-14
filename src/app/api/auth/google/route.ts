import { NextRequest } from "next/server";
import { OAuth2Client } from "google-auth-library";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import { hashPassword, generateToken } from "@/lib/auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-utils";
import { googleAuthSchema } from "@/lib/validations";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// POST /api/auth/google
export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.AUTH_LOGIN);
    if (limited) return limited;

    const { data, error } = await validateBody(request, googleAuthSchema);
    if (error) return error;

    await connectDB();

    // VERIFY the Google JWT with Google's public keys — not just decode
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: data.credential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return errorResponse("Invalid Google credential", 401);
    }

    if (!payload || !payload.email) {
      return errorResponse("Invalid Google credential", 401);
    }

    const { email, name, picture, email_verified } = payload;

    if (!email_verified) {
      return errorResponse("Google email is not verified");
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      // User exists — login
      const token = await generateToken({ userId: user._id.toString(), role: user.role });
      return successResponse({
        message: "Login successful",
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar || picture,
          isVerified: user.isVerified,
          college: user.college,
          phone: user.phone,
        },
      });
    }

    // User doesn't exist — create new account
    const randomPassword =
      Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
    const hashedPassword = await hashPassword(randomPassword);

    user = await User.create({
      name: name || "Google User",
      email,
      password: hashedPassword,
      avatar: picture,
      isVerified: true,
      authProvider: "google",
    });

    const token = await generateToken({ userId: user._id.toString(), role: user.role });

    return successResponse(
      {
        message: "Account created successfully",
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          isVerified: user.isVerified,
        },
      },
      201
    );
  } catch (error) {
    console.error("Google auth error:", error);
    return errorResponse("Google authentication failed. Please try again.", 500);
  }
}
