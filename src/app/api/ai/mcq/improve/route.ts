import { NextRequest } from "next/server";
import { runAiDraft } from "@/lib/ai-route";
import { MCQ_SYSTEM_PROMPT } from "@/lib/nvidia-ai";

export function POST(request: NextRequest) {
  return runAiDraft(request, MCQ_SYSTEM_PROMPT, (body) =>
    `Improve this MCQ for clarity and fairness. Direction: ${body.prompt || "remove ambiguity"}. Return it inside the mcqs array. Draft: ${JSON.stringify(body.draft)}`
  );
}
