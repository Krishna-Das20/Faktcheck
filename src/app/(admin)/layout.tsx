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
  const { user, loading, isAdminOrOrganiser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !isAdminOrOrganiser)) {
      router.push("/login");
    }
  }, [user, loading, router, isAdminOrOrganiser]);

  if (loading) {
    return <Loader fullScreen />;
  }

  if (!user || !isAdminOrOrganiser) {
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
