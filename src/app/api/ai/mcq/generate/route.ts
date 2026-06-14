import { NextRequest } from "next/server";
import { runAiDraft } from "@/lib/ai-route";
import { MCQ_SYSTEM_PROMPT } from "@/lib/nvidia-ai";

export function POST(request: NextRequest) {
  return runAiDraft(request, MCQ_SYSTEM_PROMPT, (body) =>
    `Create ${Math.min(Math.max(Number(body.count) || 1, 1), 5)} MCQ(s). Category: ${body.category || "GENERAL"}. Difficulty: ${body.difficulty || "MEDIUM"}. Marks: ${body.marks || 1}. Negative marks: ${body.negativeMarks || 0}. Focus: ${body.prompt || "general problem solving"}.`
  );
}
