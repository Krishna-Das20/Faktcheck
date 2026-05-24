import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import { generateResetToken, sendPasswordResetEmail } from "@/lib/email";
import { successResponse, errorResponse, parseBody } from "@/lib/api-utils";

// POST /api/auth/forgot-password
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { email } = await parseBody<{ email: string }>(request);

    if (!email) {
      return errorResponse("Please provide email");
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists
      return successResponse({
        message: "If an account exists with this email, a reset link has been sent.",
      });
    }

    // Generate reset token
    const resetToken = generateResetToken();

    // Save token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Send reset email
    await sendPasswordResetEmail(email, resetToken);

    return successResponse({
      message: "If an account exists with this email, a reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return errorResponse("Failed to process request. Please try again.", 500);
  }
}
