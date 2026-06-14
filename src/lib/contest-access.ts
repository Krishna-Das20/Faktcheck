import Contest from "@/lib/models/Contest";
import Room from "@/lib/models/Room";
import type { AuthenticatedUser } from "@/lib/api-auth";

export async function requireContestOwner(user: AuthenticatedUser, contestId: string) {
  const contest = await Contest.findById(contestId);
  if (!contest) throw new Error("CONTEST_NOT_FOUND");

  if (user.role === "ADMIN" || contest.createdBy.toString() === user._id.toString()) {
    return contest;
  }

  if (contest.roomId) {
    const room = await Room.findById(contest.roomId);
    if (room?.isOrganiser(user._id)) return contest;
  }

  throw new Error("CONTEST_FORBIDDEN");
}
