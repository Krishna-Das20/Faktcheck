import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse, parseBody } from "@/lib/api-utils";

// GET /api/auth/me — Get current user profile
export async function GET(request: NextRequest) {
  try {
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
    const authUser = await requireAuth(request);
    await connectDB();

    const { name, college, phone } = await parseBody<{
      name?: string;
      college?: string;
      phone?: string;
    }>(request);

    const user = await User.findById(authUser._id);
    if (!user) {
      return errorResponse("User not found", 404);
    }

    if (name) user.name = name;
    if (college !== undefined) user.college = college;
    if (phone !== undefined) user.phone = phone;

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
