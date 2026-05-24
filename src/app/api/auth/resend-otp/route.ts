import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import OTP from "@/lib/models/OTP";
import { generateOTP, sendOTPEmail } from "@/lib/email";
import { successResponse, errorResponse, parseBody } from "@/lib/api-utils";

// POST /api/auth/resend-otp
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { email, purpose = "SIGNUP" } = await parseBody<{
      email: string;
      purpose?: "SIGNUP" | "RESET_PASSWORD";
    }>(request);

    if (!email) {
      return errorResponse("Please provide email");
    }

    // Find existing OTP record
    const existingOTP = await OTP.findOne({ email, purpose });
    if (!existingOTP) {
      return errorResponse("No pending verification found. Please register again.");
    }

    // Generate new OTP
    const otp = generateOTP();

    // Update OTP record
    existingOTP.otp = otp;
    existingOTP.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await existingOTP.save();

    // Send new OTP
    await sendOTPEmail(email, otp, purpose);

    return successResponse({ message: "OTP resent to your email" });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return errorResponse("Failed to resend OTP", 500);
  }
}
