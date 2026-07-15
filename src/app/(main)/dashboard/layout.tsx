import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "View your contest history, scores, and performance on FaktCheck",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
