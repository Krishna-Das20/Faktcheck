import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-utils";
import { updateProfileSchema } from "@/lib/validations";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// GET /api/auth/me — Get current user profile
export async function GET(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const authUser = await requireAuth(request);
    await connectDB();

    const user = await User.findById(authUser._id).select("-password");
    if (!user) {
      return errorResponse("User not found", 404);
    }

    return successResponse({ user });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized, token failed", 401);
    console.error("Get me error:", error);
    return errorResponse("Server error", 500);
  }
}

// PUT /api/auth/me — Update profile
export async function PUT(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const authUser = await requireAuth(request);

    const { data, error } = await validateBody(request, updateProfileSchema);
    if (error) return error;

    await connectDB();

    const user = await User.findById(authUser._id);
    if (!user) {
      return errorResponse("User not found", 404);
    }

    if (data.name) user.name = data.name;
    if (data.college !== undefined) user.college = data.college;
    if (data.phone !== undefined) user.phone = data.phone;

    const updatedUser = await user.save();

    return successResponse({
      message: "Profile updated successfully",
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        college: updatedUser.college,
        phone: updatedUser.phone,
      },
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Update profile error:", error);
    return errorResponse("Server error updating profile", 500);
  }
}
