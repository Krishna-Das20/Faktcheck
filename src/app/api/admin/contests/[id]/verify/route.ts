import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Contest from "@/lib/models/Contest";
import { requireAdmin } from "@/lib/api-auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { verifyContestSchema } from "@/lib/validations";
import { sendMail } from "@/lib/email";

// PUT /api/admin/contests/[id]/verify — Approve or reject a contest
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

    const { data, error } = await validateBody(request, verifyContestSchema);
    if (error) return error;

    const { action: status, rejectionReason } = data;

    const contest = await Contest.findById(id).populate("createdBy", "name email");
    if (!contest) return errorResponse("Contest not found", 404);

    contest.verificationStatus = status;
    if (status === "REJECTED" && rejectionReason) {
      (contest as any).rejectionReason = rejectionReason;
    }
    await contest.save();

    // Send email notification to contest creator
    const creatorEmail = (contest.createdBy as any)?.email;
    const creatorName = (contest.createdBy as any)?.name || "Organiser";
    if (creatorEmail) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        if (status === "APPROVED") {
          await sendMail({
            to: creatorEmail,
            subject: `Your contest "${contest.title}" has been approved!`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f1f5f9; padding: 40px; }
                  .container { max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 40px; border: 1px solid #334155; }
                  .logo { text-align: center; font-size: 28px; font-weight: bold; color: #FF6B35; margin-bottom: 30px; }
                  .badge { display: inline-block; background: rgba(168,85,247,0.15); color: #A855F7; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; }
                  .badge-container { text-align: center; margin-bottom: 20px; }
                  .title { text-align: center; font-size: 22px; font-weight: bold; color: #f1f5f9; margin-bottom: 20px; }
                  .message { color: #94a3b8; line-height: 1.6; text-align: center; margin-bottom: 20px; }
                  .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                  .info-table td { padding: 12px 16px; border-bottom: 1px solid #334155; }
                  .info-label { color: #64748b; font-size: 13px; }
                  .info-value { color: #f1f5f9; font-weight: 600; text-align: right; }
                  .status-approved { color: #22C55E; }
                  .btn { display: inline-block; background: linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%); color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; }
                  .btn-container { text-align: center; margin: 30px 0; }
                  .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 30px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="logo">🚀 FaktCheck</div>
                  <div class="badge-container"><span class="badge">Contest Review</span></div>
                  <div class="title">Your contest has been approved! 🎉</div>
                  <p class="message">
                    Great news, <strong style="color: #f1f5f9;">${creatorName}</strong>! Your contest has been reviewed and approved by the admin team.
                  </p>
                  <table class="info-table">
                    <tr><td class="info-label">Contest</td><td class="info-value">${contest.title}</td></tr>
                    <tr><td class="info-label">Status</td><td class="info-value status-approved">✅ Approved</td></tr>
                  </table>
                  <div class="btn-container">
                    <a href="${appUrl}/contest/${contest._id}" class="btn">View Contest</a>
                  </div>
                  <div class="footer">
                    Your contest is now visible to participants and they can register for it.<br>
                    © 2026 FaktCheck. All rights reserved.
                  </div>
                </div>
              </body>
              </html>
            `,
          });
        } else if (status === "REJECTED") {
          await sendMail({
            to: creatorEmail,
            subject: `Your contest "${contest.title}" requires changes`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f1f5f9; padding: 40px; }
                  .container { max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 40px; border: 1px solid #334155; }
                  .logo { text-align: center; font-size: 28px; font-weight: bold; color: #FF6B35; margin-bottom: 30px; }
                  .badge { display: inline-block; background: rgba(168,85,247,0.15); color: #A855F7; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; }
                  .badge-container { text-align: center; margin-bottom: 20px; }
                  .title { text-align: center; font-size: 22px; font-weight: bold; color: #f1f5f9; margin-bottom: 20px; }
                  .message { color: #94a3b8; line-height: 1.6; text-align: center; margin-bottom: 20px; }
                  .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                  .info-table td { padding: 12px 16px; border-bottom: 1px solid #334155; }
                  .info-label { color: #64748b; font-size: 13px; }
                  .info-value { color: #f1f5f9; font-weight: 600; text-align: right; }
                  .status-rejected { color: #EF4444; }
                  .note { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; padding: 12px 16px; color: #94a3b8; font-size: 13px; margin-top: 20px; }
                  .btn { display: inline-block; background: linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%); color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; }
                  .btn-container { text-align: center; margin: 30px 0; }
                  .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 30px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="logo">🚀 FaktCheck</div>
                  <div class="badge-container"><span class="badge">Contest Review</span></div>
                  <div class="title">Your contest needs a few updates</div>
                  <p class="message">
                    Hi <strong style="color: #f1f5f9;">${creatorName}</strong>, your contest has been reviewed and requires some changes before it can be published.
                  </p>
                  <table class="info-table">
                    <tr><td class="info-label">Contest</td><td class="info-value">${contest.title}</td></tr>
                    <tr><td class="info-label">Status</td><td class="info-value status-rejected">❌ Changes Requested</td></tr>
                  </table>
                  ${rejectionReason ? `
                    <div class="note">
                      <strong>Reason:</strong> ${rejectionReason}
                    </div>
                  ` : ""}
                  <div class="btn-container">
                    <a href="${appUrl}/admin/dashboard" class="btn">Open Dashboard</a>
                  </div>
                  <div class="footer">
                    Please make the necessary changes and resubmit for review.<br>
                    © 2026 FaktCheck. All rights reserved.
                  </div>
                </div>
              </body>
              </html>
            `,
          });
        }
      } catch (emailError) {
        console.error("Failed to send contest verification email:", emailError);
        // Non-blocking — don't fail the request
      }
    }

    return successResponse({
      message: `Contest ${status.toLowerCase()}`,
      contest,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Admin only", 403);
    console.error("Verify contest error:", error);
    return errorResponse("Server error", 500);
  }
}
