# SIMILARITY.md — KodingKulture (React + Node) vs Faktcheck (Next.js)

> **Method:** Every source file of both projects was read — KodingKulture: 17 models, 12 controllers, 13 route files, 4 middlewares, 4 services, config/utils, and the full React client (~26k lines); Faktcheck: all 17 models, the full `src/lib` layer, **all ~90 API route files**, contexts, ProctorGuard, and every page group (~28k lines). This document records where the two are the same, where Faktcheck improved, and — most importantly — **what exists in KodingKulture but is missing or broken in Faktcheck**.
>
> ⚠️ Both apps point at the **same MongoDB Atlas cluster and the same database (`test`)**. Schema-compatibility notes below matter because documents written by one app are read by the other.

---

## 1. Verdict at a glance

| Area | Parity |
|---|---|
| Data models (17 collections) | ✅ Compatible — Faktcheck is a superset (safe for the shared DB) |
| Auth (login / OTP / Google / reset / SSE role sync) | ✅ Parity + significant security upgrades |
| Contest lifecycle (create → verify → register → start → submit) | ✅ Parity + new per-section flow |
| Proctoring (ProctorGuard) | ✅ Parity + warning-count persistence (improvement) |
| Coding / Judge0 (test, check-all, submit, partial scoring, JUDGE0_UNAVAILABLE fallback) | ✅ Parity |
| MCQ engine (library, junction links, scoring, negative marking, review) | ⚠️ Mostly parity — **library ownership checks and unlink-from-contest are missing** |
| Forms | ⚠️ FILE-upload fields added, but **form creation is broken by the Zod schema** and answer-key leakage exists |
| Leaderboard / analytics | ✅ Parity + pagination & inline admin detail |
| Rooms / announcements | ✅ Parity |
| Admin panel | ⚠️ Parity except **AI question generation UI** and question metrics |
| Background jobs | ❌ **Auto-submit-expired-attempts cron is missing** |
| Ops tooling (seed/fix scripts, health check) | ❌ Missing entirely |

---

## 2. Feature-by-feature comparison

### 2.1 Data models — compatible, Faktcheck is a superset

All 17 collections (`User, OTP, Contest, ContestRegistration, ContestProgress, ContestMCQ, ContestCodingProblem, MCQ, MCQSubmission, CodingProblem, Submission, Result, Violation, Form, FormSubmission, Room, Announcement`) exist in both with identical names, enums, and indexes. Faktcheck **adds** fields (all optional/defaulted, so old documents still validate):

- `User.authProvider` (`local`/`google`), `password select:false`
- `Contest.sections.*.hasTimer`, `Contest.manuallyEnded`, `Contest.endedBy` — the last two were *written* by KodingKulture's end-contest controller but silently dropped because they were never in KK's schema. Faktcheck fixed that.
- `ContestProgress`: per-section `sectionStatus`/`sectionSubmittedAt`, `formsProgress`, `mcqProgress.categoryTimes`
- `MCQ.options[].imageUrl`, `MCQ.images[]`, `CodingProblem.images[]`
- `Form`: `FILE` field type, `descriptionImage`, `allowedFileTypes`, `maxFileSize`; `FormSubmission.responses[].fileUrl/filePublicId`

**One regression:** `OTP.pendingUserData` lost `college` and `phone`. See §3.10.

### 2.2 Authentication — parity plus real security fixes

Same flows exist in both: email+password login, OTP signup via Resend, resend-OTP, forgot/reset password (1-hour token), Google Sign-In, `GET /me`, profile update, and the SSE endpoint for instant role updates (identical `role-sync`/`role-update` events, 30s heartbeat, multi-tab support).

Faktcheck improvements over KodingKulture:
- **Google credential is actually verified** with `google-auth-library` (`verifyIdToken` + audience check). KodingKulture only base64-decoded the JWT — anyone could forge a token and log in as any Google user. This was KK's worst security hole and it is fixed.
- OTPs are generated with `crypto.randomInt` and stored **bcrypt-hashed** (KK: `Math.random`, plaintext in DB).
- Login refuses unverified emails and Google-provisioned accounts (prevents password-guessing against Google users' random passwords).
- The legacy `POST /auth/register` (which in KK created accounts **without OTP verification**, bypassing the whole email-verification system) was deliberately removed. Good.
- JWT via `jose` includes the role; per-request auth caching; Zod validation on inputs.

### 2.3 Contest lifecycle — parity plus a redesigned section flow

Identical in both: public listing filter (`isPublished + APPROVED + not room-scoped`), organiser verification workflow (PENDING → approve/reject with email), room contests auto-approved, registration (ended-check, max-participants, `ContestRegistration` + `participants[]` + `Result REGISTERED`), start (must be registered + LIVE), cascade delete of 11 collections, manual "end contest now" with auto-submission of active participants, admin dashboard with stats, "organisers can't edit APPROVED public contests" rule (KK enforced it in `contestOwner` middleware; Faktcheck re-implements the same logic inline, including room-co-organiser access).

Faktcheck changes:
- **New per-section flow**: `POST /contests/:id/sections/:section/start|submit` with optional per-section timers (`hasTimer`), section re-entry blocking, and automatic contest finalization when every enabled section is submitted (`terminationReason: COMPLETED`). This replaces KK's single "Final Submit" button — a genuine upgrade for exam UX.
- **Server-side timer enforcement** (KK had none): final submit is validated against `startedAt + duration` with a 60s grace (late = `TIMEOUT`, time capped), and code submissions are **rejected** after time expires (30s grace). In KK a user could manipulate the client and submit hours late.
- Manual end-contest **fixes a real KK bug**: KK read `progress.mcqAnswers` (a path that doesn't exist — the real path is `progress.mcqProgress.answers`), so manually ended contests scored everyone's MCQs as 0. Faktcheck reads the correct path.
- Violation route now creates the scored `Result` **server-side** on malpractice termination, so a cheater still appears on the leaderboard even if their client dies. KK depended on the client posting the final submit.

### 2.4 Proctoring — parity, plus persistence

Faktcheck's `ProctorGuard` is a faithful TypeScript port of KK's: the same 6 violation types (`TAB_SWITCH`, `WINDOW_BLUR`, `FULLSCREEN_EXIT`, `COPY_ATTEMPT`, `PASTE_ATTEMPT`, `SCREENSHOT_ATTEMPT`), the same 13 blocked shortcuts, PrintScreen / Win+Shift+S / Ctrl+Shift+S detection, copy-paste allowed inside Monaco, right-click and beforeunload guards, auto-fullscreen, 3-warning auto-termination, and the same status bar + warning modal.

**Improvement:** Faktcheck loads the persisted `warningCount` from the DB when the guard mounts. In KodingKulture the client counter reset to 0 on every refresh/section switch, so a candidate could take 2 warnings, hit F5, and get a fresh 3-warning budget (the DB count kept growing, but the *client* only terminated at its own counter). Faktcheck closes that loophole.

### 2.5 Coding & Judge0 — parity

Test-run (custom input + example comparison), check-all (hidden testcases masked), final submit with per-testcase points and partial scoring, verdict mapping, problem metrics increments, best-score tracking in `Result`, the `JUDGE0_UNAVAILABLE` "save code for manual review" fallback and the admin pending-submissions view — all present in both and behaviourally identical. Faktcheck adds request timeouts (15s AbortController) and exponential-backoff polling, which KK lacked. Same 7 languages and IDs. The coding page (Monaco with paste blocked in-editor, resizable panels, per-problem localStorage persistence, submissions tab) is at parity, plus a mobile panel toggle.

### 2.6 MCQ engine — parity in the participant path, gaps in the admin path

Participant-facing behaviour is identical: answers stripped of `isCorrect`/`correctAnswers`/`explanation`, `questionType SINGLE/MULTIPLE` derivation, exact-set scoring with negative marking only when something was selected, metrics + per-contest `contestMetrics`, localStorage autosave + 30s backend autosave + `sendBeacon` emergency save, question palette/flagging, post-contest review with explanations. Admin-path gaps are listed in §3.

### 2.7 Leaderboard & analytics — parity plus

Same ranking (score desc, time asc, ties share rank), rank persisted to `Result`, public stats endpoint, per-user drill-down for admins (identical per-question time, category time, unattempted detection, full submission history — Faktcheck even fixed KK's N+1 by batch-fetching submissions), CSV export in the UI. Faktcheck adds pagination, the caller's own rank, and inline warning-count/termination data in the admin view. KK's separate `/leaderboard/:id/admin` endpoint was folded into the same route via `isDetailedView`.

### 2.8 Rooms & announcements — parity

Create/join by code/join by link/update/soft-delete, owner-only co-organiser invites (48h token, email match on accept, participant→co-organiser promotion), admin direct member add, remove/leave rules, announcements with attachments + pinning and organiser-only writes — all ported. Room contests, `roomId` query param on contest create, and co-organiser edit rights work in both.

### 2.9 Certificates — Faktcheck is *better*

KodingKulture's `/certificate/:resultId` page never fetched anything — it rendered "Certificate Not Generated" unless a function that nothing called was invoked, i.e. the page was effectively dead. Faktcheck added `GET /api/results/:resultId` (owner/admin only), auto-generates the certificate, and downloads it as PNG via `html2canvas`.

---

## 3. ❗ Things KodingKulture has that Faktcheck is missing (or broke)

> **Update 2026-07-15 — gaps closed in Faktcheck.** The following items in this section have since been **fixed in the Faktcheck codebase** (verified with a green `pnpm build`; see `PRODUCTION_READY_AUDIT.md` §0 for details):
> - **3.1** Auto-submit cron for expired attempts → restored inside `/api/cron/update-statuses` (scoring with negative marking, `TIMEOUT` termination, capped time).
> - **3.2** Library ownership protection → restored on `PUT/DELETE /api/mcqs/[id]` and `/api/coding/[id]` with field whitelists (no `isPublic` escalation).
> - **3.3** MCQ unlink-from-contest → new `DELETE /api/mcqs/contest/[contestId]/remove/[mcqId]` endpoint + ManageMCQ UI now unlinks instead of hard-deleting; library deletes clean up junction rows.
> - **3.4** Contest-ownership checks on question attachment → `requireContestOwner` enforced on both `add-from-library` routes, the coding `remove` route, and direct question creation.
> - **3.5** Contest `totalMarks` bookkeeping → maintained again on add-from-library, unlink, direct create/delete, and form create/update/delete.
> - **3.6** Form answer-key sanitisation → `correctAnswers` stripped for participants + registration check restored.
> - **3.7** Form creation schema → full field config accepted; `fieldId` generated server-side; PUT validates.
> - Partial ops recovery: `scripts/create-admin.mjs` (admin bootstrap) and `.env.example` added.
>
> Still open (deliberately, as post-launch work): 3.8 AI generation UI, 3.9 metrics endpoints, 3.10 college/phone at signup, 3.11 library search, and most of 3.12.

These are the items you asked for — good things in KodingKulture that did not survive the migration. Ordered by severity.

### 3.1 The auto-submit cron for expired attempts — **missing (critical)**
KK runs `autoSubmitExpiredContests` every minute: any `ContestProgress` still `IN_PROGRESS` past `duration + 30s` is scored (MCQ with negative marking + best coding submissions), a `Result` is written, and the attempt is marked `TIMEOUT`. Faktcheck's only cron (`/api/cron/update-statuses`, every 5 min) just flips contest `UPCOMING→LIVE→ENDED`.
**Consequence in Faktcheck:** a participant who starts a contest and closes the browser stays `IN_PROGRESS` forever, never gets a `Result`, and never appears on the leaderboard — unless an organiser presses "End contest" manually. The server-side late-submission handling only helps users who *come back and submit*.

### 3.2 Library question ownership protection — **removed (security)**
KK's `updateLibraryMCQ`/`deleteLibraryMCQ` (and the coding equivalents) enforced: organisers may edit/delete **only their own private** questions, may not flip `isPublic`, and updates were whitelisted to specific fields. In Faktcheck, edits and deletes go through `PUT/DELETE /api/mcqs/[id]` and `/api/coding/[id]`, which check only `requireAdminOrOrganiser` — **any organiser can edit or delete any other organiser's private questions and even the admin's public bank**, and can pass arbitrary fields (`isPublic: true` included) since the body is applied unvalidated.

### 3.3 "Remove MCQ from contest" (unlink) — **missing endpoint, destructive UI fallback**
KK had `DELETE /api/mcq/contest/:contestId/mcq/:mcqId` (removes the junction, keeps the library question, decrements the contest's MCQ totalMarks). Faktcheck has the coding equivalent (`/api/coding/contest/[contestId]/remove/[problemId]`) **but not the MCQ one**, and the ManageMCQ page's delete button calls `DELETE /api/mcqs/:id` — which **hard-deletes the question itself**. For a library question linked into several contests this destroys it everywhere and leaves orphaned `ContestMCQ` junctions.

### 3.4 Contest ownership check on question-attachment routes — **removed (security)**
KK protected `add-from-library` (both MCQ and coding) with the `contestOwner` middleware. Faktcheck's versions only require *any* admin-or-organiser — an organiser can attach questions to **someone else's contest**. The same applies to `PUT/DELETE /api/forms/[id]` (KK verified `contest.createdBy` and blocked edits to APPROVED contests; Faktcheck checks role only).

### 3.5 Contest `totalMarks` bookkeeping — **partially dropped**
KK updated `contest.sections.mcq/coding.totalMarks` when questions were created for a contest, added from the library, or removed, and `sections.forms.totalMarks`/`enabled` when forms were created/updated/deleted. In Faktcheck only the coding *remove* route updates totalMarks; MCQ/coding *add-from-library*, direct creation, and all form routes never touch it — so `sections.*.totalMarks` (displayed on contest cards, the hub, and details pages) silently drifts out of sync unless the organiser sets it by hand on the contest form.

### 3.6 Form answer-key sanitisation — **removed (participants can read answers)**
KK's `GET /forms/contest/:contestId` stripped `correctAnswers` from every field before sending forms to participants, and required registration. Faktcheck's version returns the **raw form document — including `correctAnswers` for auto-scored fields — to any authenticated user**, with no registration check. A participant can open DevTools' network tab and read the answer key of every auto-scored form field.

### 3.7 Form creation payload — **broken by the Zod schema**
`createFormSchema` only allows `label, type, required, options, maxScore` per field. Zod strips everything else, so the `fieldId`, `marks`, `correctAnswers`, `isAutoScored`, `placeholder` and `order` that FormBuilder sends are discarded — and since the Mongoose schema *requires* `fieldId`, `POST /api/forms` fails validation (and even if it didn't, every field would arrive with 0 marks and no answer key). Editing works only because `PUT /api/forms/[id]` skips Zod entirely. KK generated `fieldId`s server-side (`uuidv4`) and persisted the full field config.

### 3.8 AI question generation UI — **backend ported, frontend dropped**
KK's MCQ Library and Coding Library pages had "Generate with AI" and "Improve with AI" buttons wired to the NVIDIA endpoints. Faktcheck ported all four endpoints (`/api/ai/mcq|coding/generate|improve`) — but **no page calls them**; the buttons don't exist. The feature is invisible to users.

### 3.9 Question metrics endpoints — **missing**
KK exposed `GET /api/mcq/:id/metrics` and `GET /api/coding/:id/metrics` (attempted/correct/wrong, success rate). Faktcheck has no equivalent routes (the counters are still written, just not readable via API).

### 3.10 College & phone at signup — **silently discarded**
KK stored `college`/`phone` in `OTP.pendingUserData` and copied them onto the user at verification. Faktcheck's register page still *collects* both fields, but `registerSchema` strips them and the OTP model no longer holds them — the values are thrown away and the user is re-asked by the onboarding modal after first login.

### 3.11 Library search — **degraded**
KK's library endpoints supported regex text search over question/title/tags (with proper regex escaping). Faktcheck supports only `category`/`difficulty` query filters; any search box is client-side at best.

### 3.12 Smaller drops
- `GET /api/coding/:id` (single problem, testcases stripped) — gone; only PUT/DELETE exist on that path.
- `registration-status` no longer returns `registeredAt`/`startedAt`/`submittedAt` timestamps.
- Admin contest stats lost the `pendingApproval` count.
- Cron status-flip lost KK's `isPublished: true` condition for `UPCOMING→LIVE` (unpublished drafts now go "LIVE" internally).
- The MCQ review endpoint no longer requires the contest/section to be submitted before revealing correct answers (KK gated on `progress.status === 'SUBMITTED'`); combined with per-section submit, a user who finishes MCQ early can read the key while the contest is still running — in both apps review is per-user, but FK's gate is weaker.
- KK's **global contest countdown** (HH:MM:SS everywhere, auto-final-submit at 0) has no full equivalent: Faktcheck shows a countdown only for sections with `hasTimer` enabled. If an organiser enables no section timers, participants see **no ticking clock at all** and rely on the server rejecting late submissions.
- The overall-contest **emergency Final Submit from the hub** in KK submitted everything at once; Faktcheck's hub finalizes only when each section is individually submitted (by design, but organisers should know the behaviour changed).
- `GET /health` endpoint — gone.
- **All 21 operational scripts** (`createAdmin.js`, `populateLibrary.js`, seeders, data-fix scripts, `checkProgress/checkResults` debuggers) — gone. Notably there is **no way to bootstrap the first ADMIN user** in Faktcheck except editing the DB by hand (workable only because the shared DB already has KK's admin).
- Announcement attachment upload limit dropped from 10 MB (KK) to 1 MB (`/api/upload/file`), and image upload is now open to *any* authenticated user (KK: admin-only) — one tightened, one loosened; both are behaviour changes to know about.

---

## 4. Faktcheck enhancements not in KodingKulture (the good news)

- **Rate limiting actually enabled** — KK defined 7 limiters and then disabled all of them in `app.js`. Faktcheck applies per-route limits everywhere, keyed by userId (authenticated) or IP+email (auth routes) — deliberately designed for college-WiFi shared IPs.
- Verified Google OAuth, hashed OTPs, unverified-login block, `authProvider` (§2.2).
- Server-side timer enforcement + late-submission handling (§2.3).
- Per-section start/submit/timers/re-entry blocks; section statuses on the hub with locks.
- Proctor warning-count persistence across refreshes (§2.4).
- Malpractice `Result` written server-side (§2.3).
- Emergency save now also preserves **coding drafts** (code+language per problem), not just MCQ answers.
- Zod validation + `proxy.ts` (body-size limit, NoSQL-param sanitisation, HPP) + security headers in `next.config.ts`.
- Judge0 client hardening (timeouts, backoff).
- Leaderboard pagination + caller rank + admin detail inline.
- Working certificate page with PNG download; `GET /api/results/:resultId`.
- Multi-image support on questions, image-per-option on MCQs, FILE form fields with Cloudinary upload, description images in FormBuilder.
- Route-group `error.tsx` / `loading.tsx` / `not-found.tsx`; mobile layouts (coding panel toggle); accessibility attributes.
- Upload type allowlists and an orphaned-image cleanup endpoint.

---

## 5. Shared-database compatibility notes

Because both apps run against the same Atlas DB (`test`):

1. **Reads are mutually safe** — Faktcheck's schemas are supersets with defaults; enums match everywhere it matters (`Violation.type`, `Submission.verdict` incl. `JUDGE0_UNAVAILABLE`, statuses, roles, categories).
2. **KK cron affects FK data (and vice versa)** — if the old KK server is still running anywhere, its every-minute cron will auto-submit Faktcheck users' expired attempts (accidentally papering over gap §3.1) and flip statuses with the `isPublished` check FK lacks. Decide deliberately whether KK stays running; don't rely on it by accident.
3. **Divergent bookkeeping** — FK doesn't maintain `sections.*.totalMarks` (§3.5); KK-created contests have correct values, FK-created ones may not. Same DB, two data-quality regimes.
4. **`ContestProgress.formsProgress`/`sectionStatus`** — absent on KK-written documents; FK code treats missing as `NOT_STARTED` (handled).
5. **Passwords/JWTs**: both sign HS256 `7d` tokens but with different payload shapes (`{id}` vs `{userId, role}`) — tokens are **not** interchangeable between the two frontends even with the same `JWT_SECRET`. Password hashes (bcrypt) are interchangeable.

---

*Generated 2026-07-14 from a full read of both codebases. No code was modified.*
