import { NextRequest } from "next/server";
import { runAiDraft } from "@/lib/ai-route";
import { CODING_SYSTEM_PROMPT } from "@/lib/nvidia-ai";

export function POST(request: NextRequest) {
  return runAiDraft(request, CODING_SYSTEM_PROMPT, (body) =>
    `Create one fair coding problem. Category: ${body.category || "GENERAL"}. Difficulty: ${body.difficulty || "MEDIUM"}. Score: ${body.score || 100}. Time limit: ${body.timeLimit || 2}. Memory limit: ${body.memoryLimit || 256}. Focus: ${body.prompt || "data structures and algorithms"}.`,
    2600
  );
}
