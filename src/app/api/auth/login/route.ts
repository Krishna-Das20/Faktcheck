import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import { comparePassword, generateToken } from "@/lib/auth";
import { successResponse, errorResponse, parseBody } from "@/lib/api-utils";

// POST /api/auth/login
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { email, password } = await parseBody<{ email: string; password: string }>(request);

    if (!email || !password) {
      return errorResponse("Please provide email and password");
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return errorResponse("Invalid credentials", 401);
    }

    // Check if user registered via Google (no usable password)
    if (user.authProvider === "google") {
      return errorResponse(
        "This account uses Google Sign-In. Please use the Google button to log in.",
        400
      );
    }

    // Check email verification
    if (!user.isVerified) {
      return errorResponse(
        "Please verify your email before logging in. Check your inbox for the OTP.",
        403
      );
    }

    // Check password
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return errorResponse("Invalid credentials", 401);
    }

    // Generate token
    const token = await generateToken({ userId: user._id.toString(), role: user.role });

    return successResponse({
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        college: user.college,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return errorResponse("Server error during login", 500);
  }
}
