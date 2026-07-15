import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "View contest rankings, scores, and detailed performance analytics on FaktCheck",
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
