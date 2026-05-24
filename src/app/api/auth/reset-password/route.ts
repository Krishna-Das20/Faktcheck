import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import { hashPassword } from "@/lib/auth";
import { successResponse, errorResponse, parseBody } from "@/lib/api-utils";

// POST /api/auth/reset-password
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { token, password } = await parseBody<{ token: string; password: string }>(request);

    if (!token || !password) {
      return errorResponse("Please provide token and new password");
    }

    if (password.length < 6) {
      return errorResponse("Password must be at least 6 characters");
    }

    // Find user with valid token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return errorResponse("Invalid or expired reset token");
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update user
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return successResponse({
      message: "Password reset successful. You can now login with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return errorResponse("Failed to reset password. Please try again.", 500);
  }
}
