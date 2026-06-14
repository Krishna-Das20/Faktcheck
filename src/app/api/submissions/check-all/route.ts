import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import CodingProblem from "@/lib/models/CodingProblem";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-utils";
import { submitToJudge0, mapStatusToVerdict } from "@/lib/judge0";
import { checkAllSchema } from "@/lib/validations";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// POST /api/submissions/check-all — Check code against all test cases (without saving)
export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_EXECUTE);
    if (limited) return limited;

    await requireAuth(request);

    const { data, error } = await validateBody(request, checkAllSchema);
    if (error) return error;

    await connectDB();
    const { problemId, sourceCode, languageId } = data;

    const problem = await CodingProblem.findById(problemId);
    if (!problem) return errorResponse("Problem not found", 404);

    let passedCount = 0;
    const testcaseResults: any[] = [];

    for (let i = 0; i < problem.testcases.length; i++) {
      const testcase = problem.testcases[i];
      try {
        const result = await submitToJudge0(
          sourceCode,
          languageId,
          testcase.input,
          testcase.output
        );

        const verdict = mapStatusToVerdict(result.status.id);
        const passed = verdict === "ACCEPTED";
        if (passed) passedCount++;

        testcaseResults.push({
          testcaseNumber: i + 1,
          passed,
          verdict,
          input: testcase.hidden ? "[Hidden]" : testcase.input,
          expectedOutput: testcase.hidden ? "[Hidden]" : testcase.output,
          actualOutput: testcase.hidden
            ? "[Hidden]"
            : (result.stdout || "").trim(),
          executionTime: result.time ? parseFloat(result.time) * 1000 : 0,
          memoryUsed: result.memory || 0,
          error: result.stderr || result.compile_output || null,
          hidden: testcase.hidden,
        });
      } catch {
        testcaseResults.push({
          testcaseNumber: i + 1,
          passed: false,
          verdict: "EXECUTION_ERROR",
          error: "Execution failed",
          hidden: testcase.hidden,
        });
      }
    }

    return successResponse({
      allPassed: passedCount === problem.testcases.length,
      passedCount,
      totalTestcases: problem.testcases.length,
      testcaseResults,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED")
      return errorResponse("Not authorized", 401);
    console.error("Check all test cases error:", error);
    return errorResponse("Server error", 500);
  }
}
