import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rooms",
  description: "Create and manage private contest rooms on FaktCheck",
};

export default function RoomsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
