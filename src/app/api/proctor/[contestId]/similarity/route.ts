import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Submission from "@/lib/models/Submission";
import CodingProblem from "@/lib/models/CodingProblem";
import User from "@/lib/models/User";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { requireContestOwner } from "@/lib/contest-access";
import { fingerprint, similarity } from "@/lib/code-similarity";

// Similarity scan can be O(n^2) per problem — give it room, and cap work.
export const maxDuration = 60;

const DEFAULT_THRESHOLD = 0.6;
const MAX_SUBMISSIONS = 4000; // safety cap on total submissions scanned
const MAX_PAIRS_RETURNED = 200;

type Params = { params: Promise<{ contestId: string }> };

// GET /api/proctor/[contestId]/similarity?threshold=0.6
// Reviewer-triggered code-plagiarism scan: compares each candidate's best
// submission per problem (same language) and returns similar pairs.
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);
    const { contestId } = await params;
    await connectDB();
    await requireContestOwner(user, contestId);

    const thresholdParam = Number(request.nextUrl.searchParams.get("threshold"));
    const threshold =
      thresholdParam >= 0.1 && thresholdParam <= 1 ? thresholdParam : DEFAULT_THRESHOLD;

    // Pull submissions (best-effort cap). Newest first so best-per-user is easy.
    const submissions = await Submission.find({ contestId })
      .select("userId problemId sourceCode language score submittedAt")
      .sort({ score: -1, submittedAt: -1 })
      .limit(MAX_SUBMISSIONS)
      .lean();

    // Best submission per (user, problem): first seen wins (already sorted).
    const best = new Map<string, any>();
    for (const s of submissions) {
      const key = `${s.userId}_${s.problemId}`;
      if (!best.has(key)) best.set(key, s);
    }

    // Group by problem + language, fingerprint once per submission.
    type Entry = { userId: string; fp: Set<number>; len: number };
    const groups = new Map<string, Entry[]>();
    for (const s of best.values()) {
      if (!s.sourceCode || s.sourceCode.length < 40) continue; // skip trivial
      const gkey = `${s.problemId}_${s.language}`;
      const fp = fingerprint(s.sourceCode);
      if (fp.size === 0) continue;
      if (!groups.has(gkey)) groups.set(gkey, []);
      groups.get(gkey)!.push({ userId: s.userId.toString(), fp, len: s.sourceCode.length });
    }

    // Pairwise similarity within each group.
    const rawPairs: {
      problemId: string;
      language: string;
      userA: string;
      userB: string;
      score: number;
    }[] = [];

    for (const [gkey, entries] of groups) {
      const [problemId, language] = gkey.split("_");
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const sim = similarity(entries[i].fp, entries[j].fp);
          if (sim >= threshold) {
            rawPairs.push({
              problemId,
              language,
              userA: entries[i].userId,
              userB: entries[j].userId,
              score: Math.round(sim * 100) / 100,
            });
          }
        }
      }
    }

    rawPairs.sort((a, b) => b.score - a.score);
    const pairs = rawPairs.slice(0, MAX_PAIRS_RETURNED);

    // Hydrate user names + problem titles for display.
    const userIds = new Set<string>();
    const problemIds = new Set<string>();
    pairs.forEach((p) => {
      userIds.add(p.userA);
      userIds.add(p.userB);
      problemIds.add(p.problemId);
    });

    const [users, problems] = await Promise.all([
      User.find({ _id: { $in: [...userIds] } }).select("name email").lean(),
      CodingProblem.find({ _id: { $in: [...problemIds] } }).select("title").lean(),
    ]);
    const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));
    const problemMap = new Map(problems.map((p: any) => [p._id.toString(), p]));

    const results = pairs.map((p) => ({
      problem: { _id: p.problemId, title: problemMap.get(p.problemId)?.title || "Unknown" },
      language: p.language,
      similarity: p.score,
      candidateA: userMap.get(p.userA) || { _id: p.userA, name: "Unknown" },
      candidateB: userMap.get(p.userB) || { _id: p.userB, name: "Unknown" },
    }));

    return successResponse({
      threshold,
      scanned: best.size,
      pairs: results,
      truncated: rawPairs.length > MAX_PAIRS_RETURNED,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    if (error.message === "CONTEST_NOT_FOUND") return errorResponse("Contest not found", 404);
    if (error.message === "CONTEST_FORBIDDEN") return errorResponse("Access denied", 403);
    console.error("Similarity scan error:", error);
    return errorResponse("Server error running similarity scan", 500);
  }
}
