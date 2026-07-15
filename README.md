<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-blue?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/MongoDB-Mongoose-green?logo=mongodb" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?logo=tailwindcss" alt="Tailwind" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript" alt="TypeScript" />
</p>

# Faktcheck

**Faktcheck** is a full-stack competitive coding and assessment platform built with **Next.js 16 (App Router)**. It enables organisers to create timed, proctored contests with multiple question types — MCQs, coding challenges, and custom form-based evaluations — while participants compete in a secure environment with live leaderboards, violation detection, and auto-graded results.

---

## ✨ Key Features

### 🏆 Contest System
- **Multi-section contests** — MCQ, Coding, and Custom Forms in a single contest
- **Per-section timers** — Independent countdown timers with server-side time validation and grace windows
- **Live countdown** — Real-time countdown for upcoming contests
- **One-click registration** — With registration-status tracking and participant caps
- **Contest lifecycle** — UPCOMING → LIVE → ENDED with automatic status transitions via cron (published contests only)
- **Auto-submit of expired attempts** — The cron scores and finalises abandoned `IN_PROGRESS` attempts (MCQ scoring with negative marking + best accepted coding submission), so every participant reaches the leaderboard
- **Approval workflow** — Organiser-created contests require admin approval; room contests are auto-approved

### 🛡️ Proctoring & Integrity
- **Risk-score model** — every signal carries a weight (an OS-notification blur ≈ 1, a phone in frame ≈ 25); the server owns the cumulative score, warns at a soft threshold, and auto-terminates at a hard one or on a catastrophic flag — fairer than a blunt strike count
- **Browser signals** — fullscreen enforcement with exit detection, tab-switch / window-blur detection, copy/paste blocking (allowed inside Monaco), **paste-content logging** (pasted text recorded as evidence), screenshot-shortcut interception (PrintScreen, Win+Shift+S, Ctrl+Shift+S), 13 blocked shortcut combos, **multiple-monitor / extended-display detection**
- **Advanced media proctoring** (opt-in per contest) — pre-exam **system-check wizard** (camera, mic level meter, fullscreen, single-display, whole-screen share verification), **logged consent**, **identity photo capture**, then during the exam: on-device **MediaPipe face detection** (no-face and multiple-face flags with evidence stills), **adaptive webcam/screen snapshots** (15 s baseline, tightening to 5 s after any flag — HackerRank-style), camera-loss heartbeat, and screen-share-stop detection
- **Private evidence storage** — snapshots and identity photos upload as authenticated Cloudinary assets, viewable only via short-lived signed URLs
- **Reviewer dashboard** (`/admin/contest/:id/proctoring`) — candidates ranked by risk score with flag counts, per-candidate flag timeline with evidence thumbnails, identity photo, and consent record
- **Server-side malpractice handling** — on termination the attempt is scored and a Result is written server-side, even if the client dies; legacy violations dashboard still works (dual-write)

### 📝 MCQ Engine
- **Rich question editor** — options, categories, difficulty, explanations, images (multi-image support)
- **MCQ Library** — reusable question bank; link questions into any contest (junction model with per-contest marks/order overrides)
- **Safe unlinking** — removing a library question from a contest never deletes it from the library or other contests
- **Auto-grading** — instant scoring with negative-marking support; answer keys stripped from participant payloads
- **Per-question and per-category time tracking**

### 💻 Coding Challenges
- **Monaco Editor** — in-browser IDE with per-problem code/language persistence
- **7 languages** — C, C++, Java, Python, JavaScript, Go, Rust (Judge0 IDs mapped)
- **Judge0 integration** — test run, check-all, and final submit with per-testcase partial scoring; timeouts with exponential backoff
- **`JUDGE0_UNAVAILABLE` fallback** — if the judge is down, code is saved for manual review instead of being lost
- **Coding Library** — reusable problem bank with contest linking and per-contest score overrides

### 📋 Custom Forms
- **Form builder** — TEXT, TEXTAREA, RADIO, CHECKBOX, NUMBER, URL, DATE, and FILE field types
- **Auto-scoring** — RADIO/CHECKBOX fields with answer keys (hidden from participants)
- **Manual evaluation** — per-field scores + feedback, with email notification on evaluation
- **Section totals stay in sync** — contest marks update on form create/update/delete

### 📊 Leaderboard & Analytics
- **Ranked leaderboard** — total score with time tie-breaking; forms scores merged in
- **Detailed admin drill-down** — per-question timings, answer breakdowns, per-problem submission history
- **CSV export** for offline analysis
- **Contest statistics** — participants, submission rate, averages

### 🏠 Rooms & Collaboration
- **Rooms with short join codes** and join-by-link
- **Co-organiser invites** via email with expiring tokens
- **Announcements** with pinning and file attachments
- **Room-scoped contests** — auto-approved, managed by room organisers

### 🔐 Authentication & Security
- **Email/password with OTP verification** (Resend) — OTPs are bcrypt-hashed at rest
- **Google OAuth** — ID tokens **cryptographically verified** against Google (audience-checked), with provider separation
- **JWT sessions** via `jose`, bcrypt-12 password hashing, unverified-login blocking
- **Role-based access control** — ADMIN / ORGANISER / USER, with ownership checks on every content route (organisers can only modify their own private library items and their own contests)
- **Rate limiting** — per-user keys for authenticated routes; IP+email composite keys for auth routes (college-WiFi friendly); **auth limits are durable in a MongoDB TTL collection** so they survive serverless cold starts
- **Zod validation** on write routes; field whitelists prevent mass-assignment
- **Security middleware** (`src/proxy.ts`) — 10 KB body cap, NoSQL query sanitisation, HPP protection; security headers (HSTS, X-Frame-Options DENY, nosniff, Permissions-Policy)
- **Real-time role sync** — SSE pushes role changes to all of a user's open tabs instantly

### 🤖 AI Question Drafting (optional)
- `POST /api/ai/mcq/generate|improve` and `/api/ai/coding/generate|improve` — draft questions/problems via NVIDIA NIM (`meta/llama-3.1-8b-instruct`); admin/organiser only

### 🎓 Certificates
- **Auto-generated certificates** — HTML-to-canvas generation with unique, result-linked IDs and PNG download

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Frontend** | React 19, Tailwind CSS v4, doodle-icons |
| **Language** | TypeScript (strict) |
| **Database** | MongoDB via Mongoose 9 (18 models) |
| **Auth** | JWT (`jose`), Google OAuth (`google-auth-library`), bcryptjs |
| **Email** | Resend API |
| **Code Execution** | Judge0 API (self-hosted or RapidAPI) |
| **Image Upload** | Cloudinary |
| **Code Editor** | Monaco Editor (`@monaco-editor/react`) |
| **Validation** | Zod v4 |
| **AI Drafting** | NVIDIA NIM (optional) |
| **Notifications** | react-hot-toast |
| **Certificates** | html2canvas |

---

## 📁 Project Structure

```
faktcheck/
├── scripts/
│   └── create-admin.mjs       # Bootstrap the first ADMIN user on a fresh DB
├── src/
│   ├── app/
│   │   ├── (admin)/           # Admin dashboard, contest/question/form management,
│   │   │                      #   user management, contest verification, rooms
│   │   ├── (auth)/            # Login, register, verify-otp, forgot/reset password
│   │   ├── (main)/            # Home, dashboard, contests, leaderboard, rooms, certificates
│   │   ├── contest/           # In-contest: hub, MCQ, coding, forms, review
│   │   ├── api/               # 90+ API routes
│   │   │   ├── auth/          # Login, OTP flow, Google OAuth, profile, SSE
│   │   │   ├── contests/      # CRUD, register, start, sections, submit, progress,
│   │   │   │                  #   violations, emergency-save, end
│   │   │   ├── coding/        # Problems, library, contest linking/unlinking
│   │   │   ├── mcqs/          # Questions, library, contest linking/unlinking, review
│   │   │   ├── submissions/   # Submit, test run, check-all, review, pending
│   │   │   ├── forms/         # Form builder CRUD (answer keys stripped for participants)
│   │   │   ├── form-submissions/ # Submit, evaluate, notifications
│   │   │   ├── leaderboard/   # Rankings, stats, per-user details, certificates
│   │   │   ├── rooms/         # CRUD, join, invites, members, announcements
│   │   │   ├── admin/         # User roles, contest verification
│   │   │   ├── ai/            # AI question drafting (NVIDIA)
│   │   │   ├── upload/        # Cloudinary image/file upload
│   │   │   └── cron/          # Status transitions + auto-submit of expired attempts
│   │   └── globals.css        # Design-system tokens
│   ├── components/
│   │   ├── common/            # Navbar, Footer, Loader, OnboardingModal
│   │   ├── contest/           # ContestCard, CountdownTimer, ProctorGuard
│   │   └── ui/                # ImageUpload, MultiImageUpload
│   ├── context/               # AuthContext, ContestTimerContext
│   ├── lib/
│   │   ├── models/            # 18 Mongoose models (incl. RateLimit TTL counters)
│   │   ├── auth.ts            # JWT + password utilities
│   │   ├── api-auth.ts        # requireAuth / requireAdmin / requireAdminOrOrganiser
│   │   ├── contest-access.ts  # requireContestOwner (admin / creator / room organiser)
│   │   ├── rate-limit.ts      # In-memory + durable (Mongo TTL) rate limiting
│   │   ├── validations.ts     # Zod schemas
│   │   ├── db.ts              # Cached MongoDB connection
│   │   ├── email.ts           # Resend templates (OTP, reset, invites)
│   │   ├── judge0.ts          # Judge0 client with timeout + backoff
│   │   ├── cloudinary.ts      # Upload/delete helpers
│   │   └── sseManager.ts      # SSE connection registry
│   └── proxy.ts               # Security middleware (body cap, sanitisation, HPP)
├── .env.example               # Every environment variable, documented
├── package.json
└── vercel.json                # Cron schedule (/api/cron/update-statuses every 5 min)
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ (pnpm recommended)
- **MongoDB** instance (Atlas or local) — use a **dedicated database name** in production
- **Judge0** endpoint (self-hosted or RapidAPI)
- **Resend** account (emails) and **Cloudinary** account (uploads)

### 1. Clone and install

```bash
git clone https://github.com/Krishna-Das20/Faktcheck.git
cd Faktcheck
pnpm install
```

### 2. Configure environment variables

Copy the template and fill it in — every variable is documented there:

```bash
cp .env.example .env.local
```

Required: `MONGODB_URI`, `JWT_SECRET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL`, `JUDGE0_API_URL`, Cloudinary keys, and **`CRON_SECRET`** (the cron endpoint refuses to run in production without it). Optional: NVIDIA keys for AI drafting.

### 3. Bootstrap the first admin

```bash
node scripts/create-admin.mjs admin@example.com "Your Name"
```

Creates (or promotes) a verified ADMIN account; a generated password is printed once.

### 4. Run

```bash
pnpm dev        # development — http://localhost:3000
pnpm build      # production build
pnpm start      # serve the production build
```

---

## 👥 User Roles

| Role | Capabilities |
|---|---|
| **USER** | Register for contests, participate, view leaderboards, join rooms |
| **ORGANISER** | All USER abilities + create contests (admin approval required), manage own rooms/questions/forms, private question libraries |
| **ADMIN** | Full platform control: approve contests, manage users/roles, public question bank, all rooms |

---

## 🔄 Contest Workflow

```
1. ORGANISER creates a contest → submitted for approval (room contests auto-approve)
2. ADMIN approves/rejects (with reason, emailed to the organiser)
3. Cron flips the contest LIVE at start time (published contests only)
4. Users register → start → complete sections (per-section timers, auto-save,
   emergency save on tab close)
5. ProctorGuard monitors fullscreen/tabs/copy-paste; violations logged server-side;
   3rd strike terminates and writes a scored result
6. Auto-grading for MCQ + coding; manual evaluation for forms
7. Expired/abandoned attempts are auto-submitted and scored by the cron
8. Contest ends → leaderboard finalised → certificates available
```

---

## 🎨 Design System

Custom semantic tokens defined in `globals.css`:

- **Colors**: `--color-page`, `--color-panel`, `--color-accent-500`, `--color-text-strong`, `--color-text-muted`
- **Fonts**: Manrope (body), Space Grotesk (display), Syne Mono / Fira Code (mono)
- **Components**: `.card`, `.card-hover`, `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.surface-muted`, `.badge-primary`, `.badge-neutral`, `.input-field`
- **Layout**: `.page-shell`, `.section-shell`, `.page-header`, `.page-title`

---

## 📦 Deployment

Two supported paths:

**Persistent Node host (recommended)** — Railway, Render, Fly.io, or any VPS running `pnpm build && pnpm start`. Best fit for the SSE real-time channel and long-lived connections. Schedule `GET /api/cron/update-statuses` (with the `Authorization: Bearer $CRON_SECRET` header) every 1–5 minutes via the host's cron.

**Vercel** — works out of the box; `vercel.json` already schedules the cron every 5 minutes. Auth rate limits are durable (MongoDB-backed) so they survive serverless instances; SSE degrades gracefully to reconnect-and-sync under function duration limits.

Production checklist:
- Dedicated MongoDB database (not `test`) with backups enabled
- `CRON_SECRET` set (cron refuses to run in production without it)
- Judge0 firewalled so only the app server can reach it
- `node scripts/create-admin.mjs` run once against the production DB

---

## 📄 License

This project is proprietary. All rights reserved.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/Krishna-Das20">Krishna Das</a>
</p>
