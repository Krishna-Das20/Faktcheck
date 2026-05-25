"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { DoorOpen, LayoutDashboard, LogOut, Menu, User, X, Sun, Moon } from "lucide-react";
import { useEffect, useState, useCallback } from "react";

/* ── Rolling text hover effect (matches KK's RollerLink) ── */
function RollerLink({
  href,
  children,
  icon: Icon,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group relative flex overflow-hidden rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        isActive ? "text-strong" : "text-muted-ui hover:text-strong"
      }`}
    >
      <span className="relative flex flex-col overflow-hidden">
        {/* Initial Text */}
        <span className="flex items-center gap-2 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-full">
          {Icon && <Icon className="h-4 w-4" />}
          {children}
        </span>
        {/* Hover Text (rolls up from bottom) */}
        <span className="absolute top-full flex items-center gap-2 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-full">
          {Icon && <Icon className="h-4 w-4" />}
          {children}
        </span>
      </span>
    </Link>
  );
}

/* ── Theme Toggle ── */
function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("kk-theme");
    if (saved === "light") {
      setIsDark(false);
      document.documentElement.classList.add("theme-light");
    }
  }, []);

  const toggle = () => {
    const next = isDark ? "light" : "dark";
    setIsDark(!isDark);
    localStorage.setItem("kk-theme", next);
    if (next === "light") {
      document.documentElement.classList.add("theme-light");
    } else {
      document.documentElement.classList.remove("theme-light");
    }
  };

  return (
    <button
      onClick={toggle}
      className="theme-switch h-10 w-10 justify-center rounded-full p-0"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  const isAuthenticated = !!user;
  const isAdmin = user?.role === "ADMIN";
  const isOrganiser = user?.role === "ORGANISER" || isAdmin;
  const userLabel = user?.name || user?.email || "Account";

  const handleLogout = () => {
    setMobileMenuOpen(false);
    logout();
    router.push("/login");
  };

  /* ── Scroll-responsive compact mode ── */
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrolled = window.scrollY > 32;
          setIsCompact(scrolled);
          if (scrolled && mobileMenuOpen) setMobileMenuOpen(false);
          ticking = false;
        });
        ticking = true;
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [mobileMenuOpen]);

  /* Close mobile menu on auth state change */
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [isAuthenticated, user?.name, user?.role]);

  if (loading) return null;

  return (
    <nav className="sticky top-0 z-50 w-full px-3 pt-4 sm:px-4">
      <div
        className={`mx-auto transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isCompact ? "max-w-4xl" : "max-w-7xl"
        }`}
      >
        {/* Navbar Body */}
        <div
          className={`relative flex items-center justify-between px-4 sm:px-5 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]
          ${
            isCompact
              ? "h-14 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.08)] backdrop-blur-2xl ring-1 ring-white/10"
              : "h-16 rounded-[2rem]"
          }`}
          style={{
            backgroundColor: isCompact
              ? "rgb(var(--color-page) / 0.75)"
              : "transparent",
          }}
        >
          {/* Left (Mobile balance) */}
          <div className="flex w-10 justify-start md:hidden">
            <ThemeToggle />
          </div>

          {/* Logo — centered on mobile, left on desktop */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:static md:translate-x-0 md:translate-y-0">
            <div className="flex items-center gap-2.5">
              <Link
                href="/"
                className="inline-flex items-center rounded-full px-2 py-1 transition-colors hover:opacity-80"
              >
                <span
                  className={`brand-wordmark inline-flex items-center gap-1 text-lg uppercase transition-all duration-500 sm:text-[1.15rem] ${
                    isCompact ? "scale-95 opacity-90" : "scale-100"
                  }`}
                >
                  <span className="text-primary-500 drop-shadow-[0_0_14px_rgba(255,107,53,0.24)]">
                    Fakt
                  </span>
                  <span className="text-strong">Check</span>
                </span>
              </Link>

              <a
                href="https://fedkiit.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-full px-1 py-1 transition-colors hover:opacity-80"
                aria-label="Open fedkiit.com"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-ui">
                  by
                </span>
                <span
                  className="inline-flex items-center justify-center overflow-hidden rounded-full"
                  style={{
                    height: isCompact ? "1.6rem" : "1.9rem",
                    width: isCompact ? "1.6rem" : "1.9rem",
                    border: "1px solid rgb(var(--color-border) / 0.55)",
                    backgroundColor: "rgb(var(--color-panel-muted) / 0.7)",
                  }}
                >
                  <img
                    src="/assets/fedlogo.png"
                    alt="FED logo"
                    className="h-[78%] w-[78%] object-contain"
                  />
                </span>
              </a>
            </div>
          </div>

          {/* Desktop Menu */}
          <div className="hidden flex-1 items-center justify-center md:flex">
            <div className="flex items-center gap-2 rounded-full p-1">
              <RollerLink href="/contests">Contests</RollerLink>
              <RollerLink href="/leaderboard">Leaderboards</RollerLink>
              {isAuthenticated && (
                <RollerLink href="/rooms">Rooms</RollerLink>
              )}
            </div>
          </div>

          {/* Right */}
          <div className="hidden items-center justify-end gap-3 md:flex md:w-[300px]">
            <ThemeToggle />

            {loading ? (
              <div
                className="h-9 w-24 animate-pulse rounded-full"
                style={{
                  backgroundColor: "rgb(var(--color-panel-muted) / 0.95)",
                }}
              />
            ) : isAuthenticated ? (
              <div className="flex items-center gap-2">
                {isOrganiser && (
                  <Link
                    href="/admin/dashboard"
                    className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted-ui transition-colors hover:text-strong"
                    style={{ backgroundColor: "transparent" }}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                  </Link>
                )}

                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted-ui transition-colors hover:text-strong"
                  style={{ backgroundColor: "transparent" }}
                >
                  <User className="h-4 w-4" />
                  <span className="max-w-[7rem] truncate">{userLabel}</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="rounded-full p-2 text-muted-ui transition-colors hover:bg-primary-500/10 hover:text-primary-400"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-muted-ui transition-colors hover:text-strong"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="btn-primary rounded-full px-5 py-2 text-sm font-medium shadow-md"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex w-10 justify-end p-2 md:hidden"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div
            className="absolute left-0 right-0 top-[110%] mt-2 rounded-3xl p-5 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl md:hidden"
            style={{
              backgroundColor: "rgb(var(--color-page) / 0.95)",
            }}
          >
            <div className="grid gap-2">
              <RollerLink
                href="/contests"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contests
              </RollerLink>
              <RollerLink
                href="/leaderboard"
                onClick={() => setMobileMenuOpen(false)}
              >
                Leaderboards
              </RollerLink>
              {isAuthenticated && (
                <RollerLink
                  href="/rooms"
                  icon={DoorOpen}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Rooms
                </RollerLink>
              )}
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="w-full rounded-full py-2 text-sm transition-colors hover:bg-primary-500/10"
                >
                  Logout
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/login"
                    className="rounded-full py-2 text-center text-strong transition-colors"
                    style={{
                      backgroundColor:
                        "rgb(var(--color-panel-muted) / 0.95)",
                    }}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="btn-primary rounded-full py-2 text-center"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
