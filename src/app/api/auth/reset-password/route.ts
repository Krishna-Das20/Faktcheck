import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import { hashPassword } from "@/lib/auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-utils";
import { resetPasswordSchema } from "@/lib/validations";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// POST /api/auth/reset-password
export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.AUTH_SENSITIVE);
    if (limited) return limited;

    const { data, error } = await validateBody(request, resetPasswordSchema);
    if (error) return error;

    await connectDB();

    // Find user with valid token
    const user = await User.findOne({
      resetPasswordToken: data.token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return errorResponse("Invalid or expired reset token");
    }

    // Hash new password
    const hashedPassword = await hashPassword(data.password);

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
