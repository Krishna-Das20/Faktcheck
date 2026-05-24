import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import { requireAdmin } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { sendToUser } from "@/lib/sseManager";

// PUT /api/admin/users/[id]/role — Update user role (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    await connectDB();

    const { role } = await request.json();
    if (!["USER", "ORGANISER"].includes(role)) {
      return errorResponse("Invalid role. Can only assign USER or ORGANISER.", 400);
    }

    const user = await User.findById(id);
    if (!user) return errorResponse("User not found", 404);
    if (user.role === "ADMIN") return errorResponse("Cannot change admin role", 403);

    const oldRole = user.role;
    user.role = role;
    await user.save();

    // Push real-time role update via SSE (instant for online users)
    sendToUser(user._id.toString(), "role-update", {
      role: user.role,
      previousRole: oldRole,
      name: user.name,
      email: user.email,
    });

    return successResponse({
      message: `User role updated to ${role}`,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Admin only", 403);
    console.error("Update user role error:", error);
    return errorResponse("Server error", 500);
  }
}
