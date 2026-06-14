import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Submission from "@/lib/models/Submission";
import CodingProblem from "@/lib/models/CodingProblem";
import Contest from "@/lib/models/Contest";
import ContestProgress from "@/lib/models/ContestProgress";
import Result from "@/lib/models/Result";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-utils";
import { submitToJudge0, mapStatusToVerdict } from "@/lib/judge0";
import { LANGUAGE_ID_MAP } from "@/lib/constants";
import { submitCodeSchema } from "@/lib/validations";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// POST /api/submissions — Submit code solution
export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_SUBMIT);
    if (limited) return limited;

    const user = await requireAuth(request);

    const { data, error } = await validateBody(request, submitCodeSchema);
    if (error) return error;

    await connectDB();
    const { contestId, problemId, sourceCode, language, languageId: reqLanguageId } = data;

    // Resolve language
    let resolvedLanguageId: number;
    let resolvedLanguage: string;

    if (reqLanguageId) {
      resolvedLanguageId = reqLanguageId;
      resolvedLanguage = LANGUAGE_ID_MAP[reqLanguageId] || "python";
    } else if (language) {
      resolvedLanguage = language;
      const { LANGUAGE_MAP } = await import("@/lib/constants");
      resolvedLanguageId = LANGUAGE_MAP[language];
    } else {
      return errorResponse("Language is required", 400);
    }

    if (!resolvedLanguageId) return errorResponse("Unsupported language", 400);

    // Verify contest + registration
    if (contestId) {
      const contest = await Contest.findById(contestId);
      if (!contest) return errorResponse("Contest not found", 404);

      const isRegistered = contest.participants?.some(
        (p: any) => p.toString() === user._id.toString()
      );
      if (!isRegistered && user.role !== "ADMIN") {
        return errorResponse("You are not registered for this contest", 403);
      }

      const progress = await ContestProgress.findOne({
        contestId,
        userId: user._id,
      });
      if (!progress || progress.status === "SUBMITTED") {
        return errorResponse("Contest not in progress or already submitted", 400);
      }

      // Server-side timer validation — reject code submissions after time expires
      const elapsed = Math.floor(
        (Date.now() - new Date(progress.startedAt).getTime()) / 1000
      );
      const GRACE_SECONDS = 30;
      if (elapsed > contest.duration * 60 + GRACE_SECONDS) {
        return errorResponse("Contest time has expired. You can no longer submit code.", 403);
      }
    }

    // Get problem with testcases
    const problem = await CodingProblem.findById(problemId);
    if (!problem) return errorResponse("Problem not found", 404);

    // Create submission record
    const submission = await Submission.create({
      userId: user._id,
      contestId: contestId || undefined,
      problemId,
      sourceCode,
      language: resolvedLanguage,
      languageId: resolvedLanguageId,
      totalTestcases: problem.testcases.length,
    });

    // Run code against testcases
    let passedCount = 0;
    let totalScore = 0;
    const testcaseResults: any[] = [];

    for (const testcase of problem.testcases) {
      try {
        const result = await submitToJudge0(
          sourceCode,
          resolvedLanguageId,
          testcase.input,
          testcase.output
        );

        const verdict = mapStatusToVerdict(result.status.id);
        const passed = verdict === "ACCEPTED";

        if (passed) {
          passedCount++;
          totalScore += testcase.points;
        }

        testcaseResults.push({
          testcaseId: (testcase as any)._id,
          passed,
          verdict,
          executionTime: result.time ? parseFloat(result.time) * 1000 : 0,
          memoryUsed: result.memory || 0,
          error: result.stderr || result.compile_output || null,
        });
      } catch {
        testcaseResults.push({
          testcaseId: (testcase as any)._id,
          passed: false,
          error: "Execution failed",
          isExecutionFailure: true,
        });
      }
    }

    // Check if ALL testcases failed due to execution errors (Judge0 down)
    const executionFailures = testcaseResults.filter(
      (r) => r.isExecutionFailure
    );
    if (
      executionFailures.length === testcaseResults.length &&
      testcaseResults.length > 0
    ) {
      submission.verdict = "JUDGE0_UNAVAILABLE";
      submission.score = 0;
      submission.testcasesPassed = 0;
      submission.testcaseResults = testcaseResults;
      submission.errorMessage =
        "Judge0 service unavailable — code saved for manual review";
      await submission.save();

      return successResponse({
        saved: true,
        message:
          "Code execution service unavailable. Your code has been saved for manual review.",
        submission: {
          id: submission._id,
          verdict: submission.verdict,
          score: 0,
          testcasesPassed: 0,
          totalTestcases: submission.totalTestcases,
        },
      });
    }

    // Calculate final verdict
    let finalVerdict = "ACCEPTED";
    if (passedCount < problem.testcases.length) {
      const firstFailure = testcaseResults.find(
        (r) => !r.passed && !r.isExecutionFailure
      );
      finalVerdict = firstFailure?.verdict || "WRONG_ANSWER";
    }

    // Update submission
    submission.verdict = finalVerdict as typeof submission.verdict;
    submission.score = totalScore;
    submission.testcasesPassed = passedCount;
    submission.testcaseResults = testcaseResults;
    await submission.save();

    // Update problem stats
    problem.submissionCount++;
    problem.metrics.attempted++;
    if (finalVerdict === "ACCEPTED") {
      problem.acceptedCount++;
      problem.metrics.accepted++;
    } else if (finalVerdict === "WRONG_ANSWER") {
      problem.metrics.wrongAnswer++;
    } else if (finalVerdict === "TIME_LIMIT_EXCEEDED") {
      problem.metrics.tle++;
    } else if (finalVerdict === "RUNTIME_ERROR") {
      problem.metrics.runtimeError++;
    }
    await problem.save();

    // Update Result for contest scoring
    if (contestId) {
      const result = await Result.findOne({
        userId: user._id,
        contestId,
      });
      if (result) {
        const problemIndex = result.codingSubmissions.findIndex(
          (s: any) => s.problemId.toString() === problemId
        );

        if (problemIndex >= 0) {
          if (totalScore > result.codingSubmissions[problemIndex].score) {
            result.codingSubmissions[problemIndex].score = totalScore;
            result.codingSubmissions[problemIndex].bestSubmission =
              submission._id;
          }
          result.codingSubmissions[problemIndex].attempts++;
          result.codingSubmissions[problemIndex].solved =
            result.codingSubmissions[problemIndex].solved ||
            finalVerdict === "ACCEPTED";
        } else {
          result.codingSubmissions.push({
            problemId: problemId as any,
            bestSubmission: submission._id,
            score: totalScore,
            attempts: 1,
            solved: finalVerdict === "ACCEPTED",
          });
        }

        result.codingScore = result.codingSubmissions.reduce(
          (sum: number, s: any) => sum + s.score,
          0
        );
        result.totalScore = result.mcqScore + result.codingScore;
        await result.save();
      }
    }

    return successResponse(
      {
        message: "Code submitted successfully",
        submission: {
          id: submission._id,
          verdict: submission.verdict,
          score: submission.score,
          testcasesPassed: submission.testcasesPassed,
          totalTestcases: submission.totalTestcases,
        },
      },
      201
    );
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED")
      return errorResponse("Not authorized", 401);
    console.error("Submit code error:", error);
    return errorResponse("Server error submitting code", 500);
  }
}
