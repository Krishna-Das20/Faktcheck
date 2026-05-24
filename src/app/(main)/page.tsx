"use client";

import Link from "next/link";
import { ArrowRight, Award, Code2, FileText, ShieldCheck, Trophy, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const metrics = [
  { value: "50+", label: "weekly contests" },
  { value: "500+", label: "active participants" },
  { value: "1000+", label: "problems attempted" },
];

const features = [
  {
    icon: Code2,
    title: "Robust Coding Assessments",
    description:
      "Multi-language support for algorithmic problem-solving with automated test case evaluation and real-time execution limits.",
  },
  {
    icon: FileText,
    title: "Comprehensive MCQ Engine",
    description:
      "Run objective aptitude, logic, and core subject rounds seamlessly alongside practical coding challenges.",
  },
  {
    icon: Trophy,
    title: "Real-time Leaderboards",
    description:
      "Track participant progress live. Detailed post-contest analysis, submission metrics, and global ranking updates.",
  },
  {
    icon: ShieldCheck,
    title: "Advanced Proctoring",
    description:
      "Ensure fair play with secure execution environments, tab-switching detection, and strict anti-cheat mechanisms.",
  },
  {
    icon: Users,
    title: "Public & Private Rounds",
    description:
      "Host exclusive private contests for specific institutions or open public challenges for the wider developer community.",
  },
  {
    icon: Award,
    title: "Certificates & Editorials",
    description:
      "Provide participants with verifiable achievement certificates and detailed problem editorials to encourage continuous learning.",
  },
];

const platformColumns = [
  {
    title: "Participants",
    description:
      "Compete in timed rounds, track your rank live, and build confidence through consistent practice.",
    stat: "Live ranking",
  },
  {
    title: "Organizers",
    description:
      "Publish coding and MCQ rounds, manage test cases, and evaluate submissions without manual friction.",
    stat: "Fast setup",
  },
  {
    title: "Institutions",
    description:
      "Run placement drives, internal screenings, and campus contests with controlled access and reliable proctoring.",
    stat: "Private rooms",
  },
];

export default function HomePage() {
  const { user } = useAuth();
  const isAuthenticated = !!user;

  return (
    <div className="page-shell relative overflow-hidden pt-0">
      {/* Global Background Effects */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-x-0 top-0 h-[400px] [background-size:64px_64px] opacity-[0.06]"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgb(var(--color-text) / 0.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgb(var(--color-text) / 0.08) 1px, transparent 1px)
            `,
          }}
        />
      </div>

      {/* Main Content Container */}
      <div className="section-shell relative mx-auto max-w-7xl space-y-12 px-6 pb-12 sm:space-y-16 lg:px-8">
        {/* ── HERO SECTION ── */}
        <div className="relative mt-2 overflow-hidden rounded-[2.5rem] px-6 py-8 sm:px-10 sm:py-12 lg:px-16 lg:py-16">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background:
                  "radial-gradient(circle at 30% 20%, rgba(255,107,53,0.3), transparent 50%), radial-gradient(circle at 70% 80%, rgba(255,107,53,0.15), transparent 50%)",
              }}
            />
            <div className="home-hero-overlay absolute inset-0" />
          </div>

          <section className="relative z-10 mx-auto max-w-4xl space-y-8 text-center">
            <div className="space-y-5">
              <h1 className="home-hero-title font-display text-strong mx-auto max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                Turn coding contests into a sharper, cleaner, more competitive
                experience.
              </h1>
              <p className="home-hero-subtitle text-muted-ui mx-auto max-w-2xl text-lg leading-relaxed sm:text-xl">
                Run weekly challenges, timed hiring rounds, and structured
                assessments.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Link
                href="/contests"
                className="btn-primary inline-flex items-center px-8 py-4 text-base font-medium"
              >
                Browse contests
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              {!isAuthenticated && (
                <Link
                  href="/register"
                  className="btn-secondary inline-flex items-center border-none px-8 py-4 text-base font-medium transition-colors hover:bg-opacity-80"
                  style={{
                    backgroundColor: "rgb(var(--color-panel-muted) / 0.72)",
                  }}
                >
                  Create account
                </Link>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-6 pt-6 sm:gap-10">
              {metrics.map((metric) => (
                <div key={metric.label} className="flex items-baseline gap-2">
                  <span className="home-hero-metric-value text-3xl font-bold text-strong sm:text-4xl">
                    {metric.value}
                  </span>
                  <span className="home-hero-metric-label text-muted-ui text-xs uppercase tracking-[0.15em]">
                    {metric.label}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── FLOWCHART ECOSYSTEM SECTION ── */}
        <section className="relative mt-12 flex flex-col items-center pt-12 sm:mt-16">
          {/* Animated Background Blobs */}
          <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center overflow-hidden">
            <div className="animate-blob absolute left-[10%] top-0 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl sm:h-80 sm:w-80" />
            <div className="animate-blob animation-delay-2000 absolute right-[10%] top-12 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl sm:h-72 sm:w-72" />
            <div className="animate-blob animation-delay-4000 absolute bottom-0 left-[40%] h-64 w-64 rounded-full bg-primary-500/10 blur-3xl sm:h-72 sm:w-72" />
          </div>

          {/* Top Level Node */}
          <div className="home-glass-panel z-10 rounded-2xl px-8 py-4 text-center shadow-[0_10px_30px_rgba(0,0,0,0.03)] backdrop-blur-md">
            <h3 className="font-display text-strong text-xl font-semibold tracking-wide">
              Platform Ecosystem
            </h3>
          </div>

          {/* Connection Lines (Desktop) */}
          <div className="pointer-events-none relative hidden h-12 w-full sm:block">
            <div
              className="absolute left-1/2 top-0 h-6 w-[2px] -translate-x-1/2"
              style={{
                backgroundColor: "rgb(var(--color-border) / 0.85)",
                boxShadow: "0 0 6px rgb(var(--color-border) / 0.4)",
              }}
            />
            <div
              className="absolute left-[16.66%] right-[16.66%] top-6"
              style={{
                height: "2px",
                backgroundColor: "rgb(var(--color-border) / 0.85)",
                boxShadow: "0 0 6px rgb(var(--color-border) / 0.4)",
              }}
            />
            <div
              className="absolute left-[16.66%] top-6 h-6 w-[2px] -translate-x-1/2"
              style={{
                backgroundColor: "rgb(var(--color-border) / 0.85)",
                boxShadow: "0 0 6px rgb(var(--color-border) / 0.4)",
              }}
            />
            <div
              className="absolute left-1/2 top-6 h-6 w-[2px] -translate-x-1/2"
              style={{
                backgroundColor: "rgb(var(--color-border) / 0.85)",
                boxShadow: "0 0 6px rgb(var(--color-border) / 0.4)",
              }}
            />
            <div
              className="absolute right-[16.66%] top-6 h-6 w-[2px] translate-x-1/2"
              style={{
                backgroundColor: "rgb(var(--color-border) / 0.85)",
                boxShadow: "0 0 6px rgb(var(--color-border) / 0.4)",
              }}
            />
          </div>

          {/* Connection Lines (Mobile) */}
          <div className="pointer-events-none relative block h-8 w-full sm:hidden">
            <div
              className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2"
              style={{
                backgroundColor: "rgb(var(--color-border) / 0.85)",
                boxShadow: "0 0 6px rgb(var(--color-border) / 0.4)",
              }}
            />
          </div>

          {/* Children Nodes */}
          <div className="z-10 grid w-full gap-6 sm:grid-cols-3">
            {platformColumns.map(({ title, description, stat }) => (
              <div
                key={title}
                className="home-flow-node relative flex flex-col items-center overflow-hidden rounded-[1.5rem] p-6 text-center shadow-sm backdrop-blur-sm"
              >
                <span className="home-stat-pill mb-4 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-ui">
                  {stat}
                </span>
                <div className="font-display text-strong mb-2 text-lg font-medium">
                  {title}
                </div>
                <div className="text-muted-ui text-sm leading-relaxed">
                  {description}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FEATURES SECTION ── */}
        <div className="relative mt-8 overflow-hidden rounded-[2.5rem] px-4 py-8 sm:px-8 sm:py-16">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0 opacity-10"
              style={{
                background:
                  "radial-gradient(circle at 50% 0%, rgba(255,107,53,0.2), transparent 40%)",
              }}
            />
            <div className="home-secondary-overlay absolute inset-0" />
          </div>

          {/* Centered Features Heading */}
          <div className="relative z-10 mb-12 text-center">
            <h2 className="home-secondary-title font-display text-strong text-3xl font-semibold sm:text-4xl">
              Powerful features for every stage
            </h2>
            <p className="home-secondary-subtitle text-muted-ui mx-auto mt-4 max-w-2xl text-base sm:text-lg">
              Everything you need to host, manage, and evaluate competitive
              coding and objective rounds with ease.
            </p>
          </div>

          {/* Feature Grid */}
          <section className="relative z-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <article
                key={title}
                className="home-feature-card group relative overflow-hidden rounded-[1.5rem] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.04)] backdrop-blur transition-colors duration-300 hover:bg-opacity-100 sm:p-8"
              >
                <div
                  className="absolute inset-0 opacity-80"
                  style={{
                    background:
                      "linear-gradient(180deg, rgb(var(--color-text) / 0.03), transparent 35%, rgb(var(--color-text) / 0.01) 100%)",
                  }}
                />
                <div className="absolute right-[-3rem] top-[-3rem] h-28 w-28 rounded-full bg-primary-500/8 blur-2xl" />

                {/* Icon with animated dashed border */}
                <div className="relative mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full text-primary-500">
                  <svg
                    className="absolute inset-0 h-full w-full transition-transform duration-700 ease-in-out group-hover:rotate-[180deg]"
                    viewBox="0 0 100 100"
                  >
                    <path
                      d="M50 5
                         C75 5, 95 25, 95 50
                         C95 75, 75 95, 50 95
                         C25 95, 5 75, 5 50
                         C5 25, 25 5, 50 5 Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray="6 8"
                      className="text-primary-300 opacity-60 transition-opacity duration-300 group-hover:opacity-100"
                    />
                  </svg>
                  <Icon className="relative z-10 h-6 w-6 text-primary-500 transition-colors duration-300 group-hover:text-primary-400" />
                </div>

                <h2 className="font-display text-strong text-xl font-semibold">
                  {title}
                </h2>
                <p className="text-muted-ui mt-3 text-sm leading-relaxed sm:text-base">
                  {description}
                </p>
              </article>
            ))}
          </section>
        </div>

        {/* ── BOTTOM CTA SECTION ── */}
        <section
          className="relative overflow-hidden rounded-[2rem] px-6 py-12 text-center shadow-[0_20px_80px_rgba(0,0,0,0.08)] sm:px-12 sm:py-20"
          style={{
            border: "1px solid rgb(var(--color-border) / 0.65)",
            backgroundColor: "rgb(var(--color-panel-muted) / 0.88)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-10"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(255,107,53,0.2), transparent 50%)",
            }}
          />
          <div className="home-cta-overlay pointer-events-none absolute inset-0" />
          <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-8">
            <div>
              <h2 className="home-cta-title font-display text-strong text-3xl font-semibold sm:text-4xl">
                {isAuthenticated
                  ? "Ready for your next challenge?"
                  : "Everything is set up for your first contest."}
              </h2>
              <p className="home-cta-subtitle text-muted-ui mx-auto mt-4 text-lg leading-relaxed">
                Join thousands of developers assessing their abilities, learning
                new concepts, and proving their algorithmic prowess in highly
                competitive weekly rounds.
              </p>
            </div>
            <Link
              href={isAuthenticated ? "/contests" : "/register"}
              className="btn-primary inline-flex shrink-0 items-center justify-center px-8 py-4 text-base font-medium"
            >
              {isAuthenticated ? "Open contests" : "Get started"}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
