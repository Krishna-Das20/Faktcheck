import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import OTP from "@/lib/models/OTP";
import { hashPassword } from "@/lib/auth";
import { generateOTP, sendOTPEmail } from "@/lib/email";
import { successResponse, errorResponse, parseBody } from "@/lib/api-utils";

// POST /api/auth/send-otp
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { name, email, password } = await parseBody<{
      name: string;
      email: string;
      password: string;
    }>(request);

    if (!name || !email || !password) {
      return errorResponse("Please provide name, email, and password");
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return errorResponse("User already exists with this email");
    }

    // Delete any existing OTP for this email
    await OTP.deleteMany({ email, purpose: "SIGNUP" });

    // Generate OTP
    const otp = generateOTP();

    // Hash password and OTP for storage
    const hashedPassword = await hashPassword(password);
    const hashedOtp = await hashPassword(otp);

    // Store hashed OTP with pending user data
    await OTP.create({
      email,
      otp: hashedOtp,
      purpose: "SIGNUP",
      pendingUserData: {
        name,
        password: hashedPassword,
      },
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    // Send OTP email
    await sendOTPEmail(email, otp, "SIGNUP");

    return successResponse({ message: "OTP sent to your email", email });
  } catch (error) {
    console.error("Send OTP error:", error);
    return errorResponse("Failed to send OTP. Please try again.", 500);
  }
}
