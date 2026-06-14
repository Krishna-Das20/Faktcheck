import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import OTP from "@/lib/models/OTP";
import { hashPassword } from "@/lib/auth";
import { generateOTP, sendOTPEmail } from "@/lib/email";
import { successResponse, errorResponse, validateBody } from "@/lib/api-utils";
import { registerSchema } from "@/lib/validations";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// POST /api/auth/send-otp
export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.AUTH_REGISTER);
    if (limited) return limited;

    const { data, error } = await validateBody(request, registerSchema);
    if (error) return error;

    await connectDB();

    // Check if user already exists
    const userExists = await User.findOne({ email: data.email });
    if (userExists) {
      return errorResponse("User already exists with this email");
    }

    // Delete any existing OTP for this email
    await OTP.deleteMany({ email: data.email, purpose: "SIGNUP" });

    // Generate OTP
    const otp = generateOTP();

    // Hash password and OTP for storage
    const hashedPassword = await hashPassword(data.password);
    const hashedOtp = await hashPassword(otp);

    // Store hashed OTP with pending user data
    await OTP.create({
      email: data.email,
      otp: hashedOtp,
      purpose: "SIGNUP",
      pendingUserData: {
        name: data.name,
        password: hashedPassword,
      },
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    // Send OTP email
    await sendOTPEmail(data.email, otp, "SIGNUP");

    return successResponse({ message: "OTP sent to your email", email: data.email });
  } catch (error) {
    console.error("Send OTP error:", error);
    return errorResponse("Failed to send OTP. Please try again.", 500);
  }
}
