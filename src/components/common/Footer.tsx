"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Footer() {
  return (
    <footer
      className="mt-auto border-t pb-4 pt-12 sm:pt-16"
      style={{ backgroundColor: "rgb(var(--color-panel) / 0.3)" }}
    >
      <div className="section-shell">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          {/* Left Section: Branding & Info */}
          <div className="max-w-xl space-y-6">
            <div className="flex items-center gap-4">
              <div>
                <div className="brand-wordmark text-lg font-bold uppercase tracking-wide">
                  <span className="text-primary-500">Fakt</span>
                  <span className="text-strong">Check</span>
                </div>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-soft-ui">
                  Contest Platform
                </p>
              </div>
            </div>

            <p className="max-w-md text-sm leading-relaxed text-muted-ui sm:text-[0.95rem]">
              Run coding rounds, MCQ screenings, form-based assessments, and
              leaderboard-driven evaluations from one focused workspace.
            </p>
          </div>

          {/* Right Section: Navigation Links */}
          <div className="grid gap-10 sm:grid-cols-2 lg:min-w-[420px] lg:gap-12">
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-soft-ui">
                Explore
              </p>
              <div className="flex flex-col gap-3 text-sm">
                <Link
                  href="/contests"
                  className="nav-link inline-flex w-fit items-center gap-2 text-muted-ui transition-colors hover:text-strong"
                >
                  Contests
                </Link>
                <Link
                  href="/leaderboard"
                  className="nav-link inline-flex w-fit items-center gap-2 text-muted-ui transition-colors hover:text-strong"
                >
                  Leaderboards
                </Link>
                <Link
                  href="/dashboard"
                  className="nav-link inline-flex w-fit items-center gap-2 text-muted-ui transition-colors hover:text-strong"
                >
                  Dashboard
                </Link>
                <Link
                  href="/rooms"
                  className="nav-link inline-flex w-fit items-center gap-2 text-muted-ui transition-colors hover:text-strong"
                >
                  Rooms
                </Link>
              </div>
            </div>

            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-soft-ui">
                Community
              </p>
              <div className="flex flex-col gap-3">
                <a
                  href="https://fedkiit.com"
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex w-fit items-center gap-2 text-sm text-muted-ui transition-colors hover:text-strong"
                >
                  Visit FED KIIT
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Copyright */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t py-6 sm:flex-row">
          <p className="text-sm text-soft-ui">
            © {new Date().getFullYear()} Fakt Check. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
