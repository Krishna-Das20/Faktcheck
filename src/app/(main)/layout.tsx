import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";

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
    </div>
  );
}
