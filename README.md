<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-blue?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/MongoDB-Mongoose-green?logo=mongodb" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?logo=tailwindcss" alt="Tailwind" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript" alt="TypeScript" />
</p>

# Faktcheck

**Faktcheck** is a full-stack competitive coding and assessment platform built with **Next.js 16 (App Router)**. It enables organizers to create timed, proctored contests with multiple question types — MCQs, coding challenges, and custom form-based evaluations — while participants compete in a secure, real-time environment with live leaderboards, violation detection, and auto-graded results.

---

## ✨ Key Features

### 🏆 Contest System
- **Multi-section contests** — MCQ, Coding, and Custom Forms in a single contest
- **Per-section timers** — Independent countdown timers for each section
- **Proctoring & violation detection** — Tab-switch tracking, copy-paste blocking, and warning escalation
- **Live countdown** — Real-time countdown for upcoming contests
- **Auto-registration** — One-click contest registration with status tracking
- **Contest lifecycle** — UPCOMING → LIVE → ENDED with automatic status transitions via cron

### 📝 MCQ Engine
- **Rich question editor** — Create MCQs with multiple options, categories, and difficulty levels
- **MCQ Library** — Reusable question bank; add from library to any contest
- **Auto-grading** — Instant scoring with negative marking support
- **Category-wise time tracking** — Per-question time analytics for organizers

### 💻 Coding Challenges
- **Monaco Code Editor** — Full-featured in-browser IDE with syntax highlighting
- **Multi-language support** — Submit solutions in multiple programming languages
- **Judge0 integration** — Automated test case execution and verdict (AC, WA, TLE, RE)
- **Coding Library** — Reusable problem bank across contests
- **Partial scoring** — Points based on test cases passed

### 📋 Custom Forms
- **Form builder** — Create custom evaluation forms with various field types
- **Manual evaluation** — Organizers can review and score form submissions
- **Per-form time tracking** — Analytics on time spent per form

### 📊 Leaderboard & Analytics
- **Real-time leaderboard** — Ranked by total score with tie-breaking by time
- **Detailed admin view** — Per-question breakdown, MCQ answer details, coding submissions
- **CSV export** — Download leaderboard data for offline analysis
- **Contest statistics** — Participant count, submission rate, average scores

### 🏠 Rooms & Collaboration
- **Room system** — Create rooms with short join codes
- **Role-based access** — Organizer, Co-organizer, and Participant roles
- **Email invitations** — Invite members via email with secure invite tokens
- **Announcements** — Post announcements within rooms
- **Room-scoped contests** — Link contests to specific rooms

### 🔐 Authentication & Security
- **Email/Password auth** — Registration with OTP verification via Resend
- **Google OAuth** — One-click Google sign-in
- **JWT-based sessions** — Secure token-based authentication
- **Role-based access control** — ADMIN, ORGANISER, and USER roles
- **Contest approval workflow** — Organiser-created contests require admin approval

### 🎓 Certificates
- **Auto-generated certificates** — HTML-to-canvas certificate generation
- **Unique certificate IDs** — Verifiable result-linked certificates
- **Download & share** — PNG certificate download

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Frontend** | React 19, Tailwind CSS v4, Lucide Icons |
| **Language** | TypeScript (strict) |
| **Database** | MongoDB via Mongoose 9 |
| **Auth** | JWT (jose), Google OAuth, bcryptjs |
| **Email** | Resend API |
| **Code Execution** | Judge0 API |
| **Image Upload** | Cloudinary |
| **Code Editor** | Monaco Editor (@monaco-editor/react) |
| **Forms** | React Hook Form + Zod validation |
| **Notifications** | react-hot-toast |
| **Certificates** | html2canvas |

---

## 📁 Project Structure

```
faktcheck/
├── src/
│   ├── app/
│   │   ├── (admin)/           # Admin dashboard, contest management, user management
│   │   │   └── admin/
│   │   │       ├── coding-library/
│   │   │       ├── contest/    # Create, edit, MCQ, coding, forms, evaluate
│   │   │       ├── dashboard/
│   │   │       ├── mcq-library/
│   │   │       ├── rooms/
│   │   │       ├── users/
│   │   │       └── verify-contests/
│   │   ├── (auth)/            # Login, register, verify-otp, forgot/reset password
│   │   ├── (main)/            # Home, dashboard, contests, leaderboard, rooms
│   │   ├── contest/           # Contest hub: MCQ, coding, forms, review (in-contest)
│   │   ├── api/               # 50+ API routes
│   │   │   ├── auth/          # Login, register, OTP, Google OAuth, SSE
│   │   │   ├── contests/      # CRUD, register, start, submit, progress
│   │   │   ├── coding/        # Problems, library, contest-scoped
│   │   │   ├── mcqs/          # Questions, library, submit
│   │   │   ├── forms/         # Form builder, submissions, evaluation
│   │   │   ├── leaderboard/   # Rankings, stats, user details
│   │   │   ├── rooms/         # CRUD, members, invites, announcements
│   │   │   ├── submissions/   # Code submissions, test runs
│   │   │   └── admin/         # User management, contest verification
│   │   └── globals.css        # Design system tokens
│   ├── components/
│   │   ├── common/            # Navbar, Footer, Loader
│   │   ├── contest/           # ContestCard, CountdownTimer, ProctorGuard
│   │   └── ui/                # ImageUpload
│   ├── context/               # AuthContext, ContestTimerContext
│   └── lib/
│       ├── models/            # 16 Mongoose models
│       ├── auth.ts            # JWT utilities
│       ├── db.ts              # MongoDB connection
│       ├── email.ts           # Resend email service
│       ├── judge0.ts          # Judge0 code execution
│       └── cloudinary.ts      # Image upload
├── .env.local                 # Environment variables
├── package.json
├── tailwind.config.ts
└── vercel.json                # Vercel deployment config
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ 
- **MongoDB** instance (local or Atlas)
- **Judge0** API endpoint (self-hosted or RapidAPI)

### 1. Clone the repository

```bash
git clone https://github.com/Krishna-Das20/Faktcheck.git
cd Faktcheck
```

### 2. Install dependencies

```bash
pnpm install
# or
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the root:

```env
# Database
MONGODB_URI=mongodb+srv://your-connection-string

# Authentication
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=7d

# Email (Resend)
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=noreply@yourdomain.com

# Code Execution
JUDGE0_API_URL=http://your-judge0-instance:2358

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id

# Image Upload (Cloudinary)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
CERTIFICATE_SECRET=your-certificate-secret
```

### 4. Run the development server

```bash
pnpm dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the platform.

---

## 👥 User Roles

| Role | Capabilities |
|---|---|
| **USER** | Register for contests, participate, view leaderboards, join rooms |
| **ORGANISER** | All USER abilities + create contests (requires admin approval), manage rooms, add questions |
| **ADMIN** | All ORGANISER abilities + approve contests, manage users, full platform control |

---

## 🔄 Contest Workflow

```
1. ORGANISER creates a contest → Submitted for approval
2. ADMIN approves/rejects the contest
3. Contest goes LIVE at scheduled start time (auto via cron)
4. Users register → Start contest → Complete sections
5. Proctoring monitors tab switches and violations
6. Auto-grading for MCQ and coding; manual for forms
7. Leaderboard updates in real-time
8. Contest ends → Results finalized → Certificates available
```

---

## 🎨 Design System

Faktcheck uses a custom semantic design token system defined in `globals.css`:

- **Colors**: `--color-page`, `--color-panel`, `--color-accent-500`, `--color-text-strong`, `--color-text-muted`
- **Fonts**: Manrope (body), Space Grotesk (display), Syne Mono / Fira Code (mono)
- **Components**: `.card`, `.card-hover`, `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.surface-muted`, `.badge-primary`, `.badge-neutral`, `.input-field`
- **Layout**: `.page-shell`, `.section-shell`, `.page-header`, `.page-title`

---

## 📦 Deployment

### Vercel (Recommended)

```bash
vercel --prod
```

The `vercel.json` is pre-configured with API route rewrites.

### Docker

```bash
docker build -t faktcheck .
docker run -p 3000:3000 --env-file .env.local faktcheck
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/Krishna-Das20">Krishna Das</a>
</p>
