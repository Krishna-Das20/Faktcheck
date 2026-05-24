import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Room from "@/lib/models/Room";
import User from "@/lib/models/User";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { sendCoOrganiserInviteEmail } from "@/lib/email";
import crypto from "crypto";

type Params = { params: Promise<{ id: string }> };

// POST /api/rooms/[id]/invite — Invite co-organiser (owner only)
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const reqUser = await requireAuth(request);
    const { id } = await params;
    await connectDB();

    const { email } = await request.json();
    if (!email) return errorResponse("Email is required");

    const room = await Room.findById(id);
    if (!room) return errorResponse("Room not found", 404);

    // Only owner or admin can invite co-organisers
    if (!room.isOwner(reqUser._id) && reqUser.role !== "ADMIN") {
      return errorResponse("Only the room owner can invite co-organisers", 403);
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) return errorResponse("No user found with this email", 404);

    // Must be an organiser
    if (user.role !== "ORGANISER" && user.role !== "ADMIN") {
      return errorResponse("Only organisers can be invited as co-organisers", 400);
    }

    // Already a co-organiser
    if (room.isCoOrganiser(user._id)) {
      return errorResponse("User is already a co-organiser of this room", 400);
    }

    // Cannot invite the owner
    if (room.isOwner(user._id)) {
      return errorResponse("Cannot invite the room owner as co-organiser", 400);
    }

    // Check for existing pending invite
    const existingInvite = room.pendingInvites.find(
      (inv: any) => inv.email === email && inv.expiresAt > new Date()
    );
    if (existingInvite) {
      return errorResponse("An invite has already been sent to this user", 400);
    }

    // Generate invite token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    // Clean expired + replace existing for same email
    room.pendingInvites = room.pendingInvites.filter(
      (inv: any) => inv.expiresAt > new Date() && inv.email !== email
    );

    room.pendingInvites.push({
      email,
      token,
      invitedBy: reqUser._id as any,
      expiresAt,
    });
    await room.save();

    // Send invite email
    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/rooms/accept-invite/${token}`;
    try {
      await sendCoOrganiserInviteEmail(email, room.name, reqUser.name || "Room Owner", acceptUrl);
    } catch (emailErr) {
      console.error("Failed to send invite email:", emailErr);
    }

    return successResponse({
      message: `Invitation sent to ${user.name} (${email}). They must accept via email to become co-organiser.`,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Invite co-organiser error:", error);
    return errorResponse("Failed to send invitation", 500);
  }
}
