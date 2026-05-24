import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import CodingProblem from "@/lib/models/CodingProblem";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { submitToJudge0 } from "@/lib/judge0";

// POST /api/submissions/test — Test run code (without saving)
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    await connectDB();
    const body = await request.json();
    const { problemId, sourceCode, languageId, input } = body;

    if (!sourceCode || !languageId) {
      return errorResponse("Source code and language are required", 400);
    }

    try {
      const result = await submitToJudge0(
        sourceCode,
        languageId,
        input || "",
        "" // No expected output for test run
      );

      // Compare with example output if no custom input
      let expectedOutput: string | null = null;
      let passed: boolean | null = null;

      if (problemId && !input) {
        const problem = await CodingProblem.findById(problemId);
        if (problem && problem.examples && problem.examples.length > 0) {
          expectedOutput = problem.examples[0].output;
          const actualOutput = (result.stdout || "").trim();
          passed = actualOutput === expectedOutput.trim();
        }
      }

      return successResponse({
        output: result.stdout || "",
        error: result.stderr || result.compile_output || null,
        executionTime: result.time ? parseFloat(result.time) * 1000 : 0,
        memoryUsed: result.memory || 0,
        expectedOutput,
        passed,
      });
    } catch {
      return errorResponse("Failed to execute code", 500);
    }
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED")
      return errorResponse("Not authorized", 401);
    console.error("Test run error:", error);
    return errorResponse("Server error", 500);
  }
}
