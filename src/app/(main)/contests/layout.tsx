import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contests",
  description: "Browse and register for coding contests, MCQ tests, and skill assessments on FaktCheck",
};

export default function ContestsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
