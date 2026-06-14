import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import OTP from "@/lib/models/OTP";
import { generateToken, comparePassword } from "@/lib/auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-utils";
import { verifyOtpSchema } from "@/lib/validations";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// POST /api/auth/verify-otp
export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.AUTH_SENSITIVE);
    if (limited) return limited;

    const { data, error } = await validateBody(request, verifyOtpSchema);
    if (error) return error;

    await connectDB();

    // Find all non-expired OTP records for this email+purpose
    const otpRecords = await OTP.find({
      email: data.email,
      purpose: "SIGNUP",
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (otpRecords.length === 0) {
      return errorResponse("Invalid or expired OTP");
    }

    // Compare hashed OTP with user input
    let matchedRecord = null;
    for (const record of otpRecords) {
      const isMatch = await comparePassword(data.otp, record.otp);
      if (isMatch) {
        matchedRecord = record;
        break;
      }
    }

    if (!matchedRecord) {
      return errorResponse("Invalid or expired OTP");
    }

    // Create user from pending data
    const user = await User.create({
      name: matchedRecord.pendingUserData?.name,
      email: data.email,
      password: matchedRecord.pendingUserData?.password,
      isVerified: true,
      authProvider: "local",
    });

    // Delete OTP records
    await OTP.deleteMany({ email: data.email, purpose: "SIGNUP" });

    // Generate token
    const token = await generateToken({ userId: user._id.toString(), role: user.role });

    return successResponse(
      {
        message: "Email verified successfully! Account created.",
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
        },
      },
      201
    );
  } catch (error) {
    console.error("Verify OTP error:", error);
    return errorResponse("Verification failed. Please try again.", 500);
  }
}
