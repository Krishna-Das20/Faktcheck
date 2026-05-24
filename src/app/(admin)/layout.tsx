"use client";

import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import Loader from "@/components/common/Loader";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * (admin) route group layout — Admin sidebar + Navbar.
 * Redirects non-admin/non-organiser users.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || (user.role !== "ADMIN" && user.role !== "ORGANISER"))) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return <Loader fullScreen />;
  }

  if (!user || (user.role !== "ADMIN" && user.role !== "ORGANISER")) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "rgb(var(--color-page))" }}>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
