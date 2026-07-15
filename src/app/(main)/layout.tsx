import type { Metadata } from "next";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import OnboardingWrapper from "@/components/common/OnboardingWrapper";

export const metadata: Metadata = {
  title: {
    default: "FaktCheck",
    template: "%s | FaktCheck",
  },
  openGraph: {
    siteName: "FaktCheck",
    type: "website",
  },
};

/**
 * (main) route group layout — With Navbar + Footer.
 * Used for contests, dashboard, leaderboard, rooms, certificates.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <OnboardingWrapper />
    </div>
  );
}
