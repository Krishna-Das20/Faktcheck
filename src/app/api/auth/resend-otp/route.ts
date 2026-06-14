import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import OTP from "@/lib/models/OTP";
import { generateOTP, sendOTPEmail } from "@/lib/email";
import { hashPassword } from "@/lib/auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-utils";
import { forgotPasswordSchema } from "@/lib/validations";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// POST /api/auth/resend-otp
export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.AUTH_SENSITIVE);
    if (limited) return limited;

    const { data, error } = await validateBody(request, forgotPasswordSchema);
    if (error) return error;

    await connectDB();

    // Find existing OTP record
    const existingOTP = await OTP.findOne({ email: data.email, purpose: "SIGNUP" });
    if (!existingOTP) {
      return errorResponse("No pending verification found. Please register again.");
    }

    // Generate new OTP
    const otp = generateOTP();

    // Update OTP record — hash before saving (matching send-otp behavior)
    const hashedOtp = await hashPassword(otp);
    existingOTP.otp = hashedOtp;
    existingOTP.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await existingOTP.save();

    // Send new OTP
    await sendOTPEmail(data.email, otp, "SIGNUP");

    return successResponse({ message: "OTP resent to your email" });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return errorResponse("Failed to resend OTP", 500);
  }
}
