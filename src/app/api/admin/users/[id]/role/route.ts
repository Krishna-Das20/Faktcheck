import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import { requireAdmin } from "@/lib/api-auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { updateRoleSchema } from "@/lib/validations";
import { sendToUser } from "@/lib/sseManager";
import { sendMail } from "@/lib/email";

// PUT /api/admin/users/[id]/role — Update user role (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    await requireAdmin(request);
    const { id } = await params;
    await connectDB();

    const { data, error } = await validateBody(request, updateRoleSchema);
    if (error) return error;

    const { role } = data;
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

    // Send email notification when user is promoted to ORGANISER
    if (role === "ORGANISER" && oldRole !== "ORGANISER") {
      try {
        const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin/dashboard`;
        await sendMail({
          to: user.email,
          subject: "You are now an Organiser on FAKT CHECK!",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f1f5f9; padding: 40px; }
                .container { max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 40px; border: 1px solid #334155; }
                .logo { text-align: center; font-size: 28px; font-weight: bold; color: #FF6B35; margin-bottom: 30px; }
                .badge { display: inline-block; background: rgba(34,197,94,0.15); color: #22C55E; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; }
                .badge-container { text-align: center; margin-bottom: 20px; }
                .title { text-align: center; font-size: 22px; font-weight: bold; color: #f1f5f9; margin-bottom: 20px; }
                .message { color: #94a3b8; line-height: 1.6; text-align: center; margin-bottom: 20px; }
                .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                .info-table td { padding: 12px 16px; border-bottom: 1px solid #334155; }
                .info-label { color: #64748b; font-size: 13px; }
                .info-value { color: #f1f5f9; font-weight: 600; text-align: right; }
                .btn { display: inline-block; background: linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%); color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; }
                .btn-container { text-align: center; margin: 30px 0; }
                .note { background: rgba(255,107,53,0.08); border: 1px solid rgba(255,107,53,0.2); border-radius: 8px; padding: 12px 16px; color: #94a3b8; font-size: 13px; margin-top: 20px; }
                .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 30px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="logo">🚀 FaktCheck</div>
                <div class="badge-container"><span class="badge">Role Update</span></div>
                <div class="title">Your organiser access is ready</div>
                <p class="message">
                  Congratulations, <strong style="color: #f1f5f9;">${user.name}</strong>! You've been promoted to <strong style="color: #22C55E;">Organiser</strong> on FaktCheck.
                </p>
                <table class="info-table">
                  <tr><td class="info-label">✨ Create</td><td class="info-value">Contests with MCQs, coding & forms</td></tr>
                  <tr><td class="info-label">📊 Review</td><td class="info-value">Participant submissions & scores</td></tr>
                  <tr><td class="info-label">🏆 Publish</td><td class="info-value">Leaderboards & certificates</td></tr>
                </table>
                <div class="btn-container">
                  <a href="${dashboardUrl}" class="btn">Open Dashboard</a>
                </div>
                <div class="note">
                  📝 Note: Public contests you create will need admin approval before they become visible to participants.
                </div>
                <div class="footer">
                  © 2026 FaktCheck. All rights reserved.
                </div>
              </div>
            </body>
            </html>
          `,
        });
      } catch (emailError) {
        console.error("Failed to send organiser promotion email:", emailError);
        // Non-blocking — don't fail the request
      }
    }

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
