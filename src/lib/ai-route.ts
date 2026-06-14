import { NextRequest } from "next/server";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { errorResponse, successResponse } from "@/lib/api-utils";
import { callNvidiaForJson } from "@/lib/nvidia-ai";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

export async function runAiDraft(
  request: NextRequest,
  systemPrompt: string,
  buildPrompt: (body: any) => string,
  maxTokens = 1800
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;
    await requireAdminOrOrganiser(request);
    const body = await request.json();
    const result = await callNvidiaForJson(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildPrompt(body) },
      ],
      maxTokens
    );
    return successResponse(result);
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Admin/Organiser only", 403);
    console.error("AI draft error:", error);
    return errorResponse("Failed to generate AI draft", 500);
  }
}
