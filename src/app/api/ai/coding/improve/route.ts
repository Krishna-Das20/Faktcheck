import { NextRequest } from "next/server";
import { runAiDraft } from "@/lib/ai-route";
import { CODING_SYSTEM_PROMPT } from "@/lib/nvidia-ai";

export function POST(request: NextRequest) {
  return runAiDraft(request, CODING_SYSTEM_PROMPT, (body) =>
    `Improve this coding problem for clarity, correctness, and edge-case coverage. Direction: ${body.prompt || "improve quality"}. Draft: ${JSON.stringify(body.draft)}`,
    2600
  );
}
