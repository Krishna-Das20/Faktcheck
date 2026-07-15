# PRODUCTION_READY_AUDIT.md — Faktcheck (Next.js)

> **Scope:** full read of the Faktcheck codebase (all models, `src/lib`, every API route, contexts, ProctorGuard, all pages) plus comparison against the original KodingKulture implementation (see `SIMILARITY.md`). No code was changed.
>
> **Audit date:** 2026-07-14

---

## Verdict

# ✅ Production-ready (code-side) as of 2026-07-15 — pending 4 operational steps at cutover.

> **Update 2026-07-15:** All launch blockers (B1, B2) and high-severity code issues (H1, H2, H3) identified below have been **fixed in the Faktcheck codebase** — see §0. H4 is operational: the user has confirmed **KodingKulture will be taken down when Faktcheck hits production**, which eliminates the dual-writer risk. The remaining pre-cutover steps are operational, not code: set `CRON_SECRET`, point `MONGODB_URI` at a dedicated (non-`test`) database, enable Atlas backups, and shut down the KK server at cutover.

The original assessment (kept below for the record): Faktcheck is a **substantially better engineered application than KodingKulture** (verified Google OAuth, hashed OTPs, active rate limiting, Zod validation, server-side timers, section flow). It had **2 launch blockers, 4 high-severity issues, and a deployment-architecture problem**, and its proctoring — while respectable for a browser-only system — is below what HackerRank or Unstop SmartHire provide (§5). Proctoring depth remains a product-roadmap item, not a launch blocker.

---

## 0. ✅ Fixes applied (2026-07-15) — verified with a green `pnpm build`

| Issue | Fix |
|---|---|
| **B1** Abandoned attempts never scored | `/api/cron/update-statuses` now auto-submits expired `IN_PROGRESS` attempts (30 s grace, max 100/run): scores MCQs from auto-saved answers **with negative marking**, takes best ACCEPTED coding submission per problem, upserts a `SUBMITTED` Result with `terminationReason: TIMEOUT`, caps `timeTaken` at contest duration. Also restored the `isPublished` condition on UPCOMING→LIVE, and the cron now **refuses to run in production without `CRON_SECRET`** (it's a write endpoint now). |
| **B2** Form creation broken / answer-key leak | `createFormSchema` rewritten to accept the full field config (`fieldId`, `marks`, `correctAnswers`, `isAutoScored`, `placeholder`, `order`, `descriptionImage`, `allowedFileTypes`, `maxFileSize`); server generates missing `fieldId`s. `GET /api/forms/contest/:id` now enforces a registration check and **strips `correctAnswers`** for participants. `PUT /api/forms/[id]` validates via a new `updateFormSchema`. Form create/update/delete also maintain `contest.sections.forms.totalMarks` and auto-enable/disable the section (KK behaviour restored). |
| **H1** Organiser authorization holes | `PUT/DELETE /api/mcqs/[id]` and `/api/coding/[id]`: ownership rules restored (organisers: own-private library items, own contests for direct questions) + **field whitelists** (no more `isPublic` escalation via body). `add-from-library`, `remove`, and direct-create routes for both MCQ and coding now require `requireContestOwner`. `forms/[id]` GET/PUT/DELETE enforce contest ownership + the approved-public-contest lock (room contests stay editable). Direct-create routes force `isLibrary:false, isPublic:false` server-side. |
| **H2** MCQ delete destroys library question | New `DELETE /api/mcqs/contest/[contestId]/remove/[mcqId]` unlink endpoint (mirrors coding, updates section totalMarks). ManageMCQ page now unlinks library-sourced questions ("stays in the library") and only hard-deletes direct questions. Library MCQ hard-delete now also cleans up its `ContestMCQ` junctions. |
| **H3** Serverless breaks rate limiting / SSE | Auth-sensitive rate limits (`AUTH_LOGIN`, `AUTH_REGISTER`, `AUTH_SENSITIVE`) are now **durable** — counted atomically in a MongoDB TTL collection (`ratelimits`), surviving cold starts and multiple instances, with in-memory fallback if the DB is unreachable. High-frequency API limits stay in-memory by design (per-user, cheap). SSE route hardened with `dynamic = "force-dynamic"` + `maxDuration = 60`; on serverless the EventSource auto-reconnect + `role-sync`-on-connect degrades push to periodic sync instead of silently breaking. |
| **H4** Shared DB safety | **Operational decision made:** KodingKulture will be decommissioned at Faktcheck's production cutover (owner-confirmed), removing the dual-writer hazard. `.env.example` added documenting a dedicated DB name; the new `scripts/create-admin.mjs` warns loudly when pointed at a database named `test`. Remaining at cutover: migrate/rename off `test`, enable Atlas backups. |
| Ops gaps (from "must do") | ✅ Green `pnpm build` verified (the earlier failure was an offline-machine font fetch; fonts use `display: swap`). ✅ Admin bootstrap: `scripts/create-admin.mjs` (creates or promotes an ADMIN; generated password printed once). ✅ `.env.example` covering every env var the code reads. Bonus: `sections.*.totalMarks` is now maintained on question add/remove/create/delete and form create/update/delete (was Medium #1); unpublished contests can no longer go LIVE (was Medium #3). |

**Cutover runbook (operational):** 1) create a dedicated production DB (or rename off `test`) and update `MONGODB_URI`; 2) enable Atlas backups/PITR; 3) set `CRON_SECRET`, `JWT_SECRET`, and all `.env.example` vars in the hosting environment; 4) run `node scripts/create-admin.mjs <email>` to bootstrap the admin; 5) deploy Faktcheck and smoke-test one end-to-end contest; 6) **shut down the KodingKulture server** (its every-minute cron must not touch the production DB); 7) point the domain at Faktcheck.

---

## 1. 🔴 Launch blockers

### B1. Abandoned contest attempts are never scored (missing auto-submit job)
KodingKulture ran a per-minute cron that auto-submitted and **scored** any `IN_PROGRESS` attempt whose time expired. Faktcheck's only cron (`/api/cron/update-statuses`, every 5 min) just flips contest statuses. A participant who starts and then closes the tab:
- stays `IN_PROGRESS` forever,
- never gets a `Result`,
- never appears on the leaderboard,
- and blocks nothing — organisers won't even see them as "timed out" unless they manually end the contest.

In any real contest a meaningful fraction of participants disconnect. This silently corrupts every leaderboard.
**Fix:** add an auto-submit pass to the cron route (port KK's `autoSubmitSingleContest` logic — the scoring code already exists in Faktcheck's violation/end routes), or run it as part of `update-statuses`.

### B2. Form creation is broken / forms leak their answer keys
Two independent defects in the forms feature:
1. `createFormSchema` strips `fieldId`, `marks`, `correctAnswers`, `isAutoScored`, `placeholder`, `order` from FormBuilder's payload (Zod removes unknown keys). Mongoose then requires `fieldId` → **`POST /api/forms` cannot create a valid form**; and even if `fieldId` were optional, every field would save with 0 marks and no answer key. (Editing works only because the PUT route skips validation.)
2. `GET /api/forms/contest/:contestId` returns raw form documents **including `correctAnswers`** to any authenticated user, with no registration check. Any participant can read the auto-scoring answer key from the network tab. KodingKulture stripped these fields.

If the forms section is part of your launch, this is a blocker on both correctness and integrity grounds. If forms aren't used, downgrade to High.

---

## 2. 🟠 High severity

### H1. Authorization holes in the organiser content model
- `PUT/DELETE /api/mcqs/[id]` and `/api/coding/[id]`: any organiser can edit or **hard-delete any question**, including other organisers' private questions and the admin's public bank; the unvalidated body also lets them set `isPublic: true`. KK enforced own-private-only with a field whitelist.
- `POST /api/mcqs|coding/contest/[contestId]/add-from-library`: no contest-ownership check — any organiser can inject questions into **someone else's live contest**.
- `PUT/DELETE /api/forms/[id]`: role check only; no `createdBy`/approved-contest check.
One malicious (or confused) organiser account can vandalise every contest on the platform.

### H2. Deleting an MCQ from a contest destroys the library question
There is no MCQ unlink endpoint (coding has one), and the ManageMCQ page's delete button calls `DELETE /api/mcqs/:id`. Removing a library-sourced question from one contest deletes it from the library **and every other contest that linked it**, leaving orphaned junctions. Data loss via a normal admin action.

### H3. Serverless deployment breaks SSE, rate limiting, and warning counts
`vercel.json` says Vercel; the code says single long-lived server:
- **SSE role updates** (`sseManager.ts`) keep connections in a module-level `Map`. On serverless/multi-instance, the instance that handles the admin's role change doesn't hold the user's SSE connection → `role-update` events silently never arrive. On Vercel, the SSE function will also be killed at the platform's max duration.
- **Rate limiting** (`rate-limit.ts`) is an in-memory `Map` — per-instance, reset on every cold start. Under serverless it provides ~no protection exactly when you need it (login brute force, OTP spam).
- These are fine on a single always-on Node host (Railway/Render/EC2/`next start` on a VPS). **Pick one:** (a) deploy on a single persistent server, or (b) move rate limiting to Redis/Upstash and either drop SSE for polling or use a pub/sub-backed channel.

### H4. No production data-safety rails on the shared database
- Both apps write to the **same Atlas database, literally named `test`** — production contest data in a default-named DB shared with the legacy app.
- If the old KodingKulture server is still running, its every-minute cron **will keep mutating Faktcheck's data** (auto-submitting attempts, flipping statuses with different rules). That may even be masking blocker B1 today. Decide explicitly: retire KK, or document that it's load-bearing.
- No backups/PITR mentioned anywhere; Atlas M0/M2 free tiers don't include continuous backup.

---

## 3. 🟡 Medium severity

1. **`sections.*.totalMarks` drifts** — add/remove/create question routes don't maintain contest totals (KK did). Contest cards, hub and details show wrong marks unless organisers hand-set them.
2. **No countdown without section timers** — if `hasTimer` isn't enabled per section, participants see no clock; only the server's late-submit rejection enforces time. Organiser error becomes participant pain.
3. **Cron flips unpublished contests LIVE** — the `isPublished` condition present in KK was dropped from `UPCOMING→LIVE`.
4. **MCQ review gate weakened** — correct answers are readable once a `Result` exists (e.g. right after submitting the MCQ *section*) while the contest is still live; combined with a friend still in the exam this is a leak channel. KK required the whole attempt to be `SUBMITTED`.
5. **College/phone dropped at registration** — collected by the form, discarded by the schema, re-asked at onboarding. Confusing and loses data if the user skips onboarding.
6. **Leaderboard writes on read** — every page view fire-and-forgets N `Result.findByIdAndUpdate` rank writes; harmless at small scale, a write-amplifier at large scale (same flaw as KK).
7. **Hub coding progress is N+1** — one fetch per problem per hub visit; the aggregate endpoint exists but is unused.
8. **No admin bootstrap** — all 21 KK scripts (createAdmin, seeders, fixers) are gone; on a fresh DB there is no way to create the first ADMIN or seed the library without hand-editing Mongo.
9. **AI endpoints exposed but unused by the UI** — either wire the buttons back (they existed in KK) or remove the routes; dead authenticated endpoints that spend NVIDIA credits are attack surface.
10. **`/api/upload/image` open to all authenticated users** (KK: admin-only). Rate-limited (20/min) but still lets any user fill your Cloudinary quota. File-upload limit also dropped 10 MB → 1 MB for announcements — verify that's intended.
11. **Build not verified** — `build.log` shows the last `pnpm build` failing on a Google Fonts fetch (`next/font` needs network). Use `display: swap` + fallback or self-host the font; confirm a clean CI build before deploy.
12. **No `.env.example`**, no `/health` endpoint, no tests of any kind, no error monitoring (Sentry etc.), `console.log`-only logging.

---

## 4. ✅ What is already production-grade

- **Auth:** verified Google `idToken` (audience-checked), bcrypt-12 passwords, bcrypt-hashed crypto-random OTPs, unverified-login block, provider separation, JWT via `jose` with role claims.
- **Input handling:** Zod validation on most write routes; `proxy.ts` middleware replicating KK's Express security stack (10 KB body cap, NoSQL query-param sanitisation, HPP); security headers (HSTS, `X-Frame-Options: DENY`, nosniff, Permissions-Policy).
- **Rate limiting design** is genuinely thoughtful (per-user keys for authenticated routes; IP+email composite for auth routes to survive college NAT) — it just needs a shared store to survive serverless (H3).
- **Contest integrity:** server-side timer validation with grace windows and time-capping; code submissions rejected after expiry; malpractice results written server-side; proctor warning counts persisted across refreshes (better than KK).
- **Judge0 integration:** timeouts, exponential backoff, `JUDGE0_UNAVAILABLE` manual-review fallback, partial scoring.
- **Ops hygiene:** cascade deletes, TTL index on OTPs, unique compound indexes on registrations/results/progress, connection caching for Mongoose in the App Router world, cron endpoint protected by `CRON_SECRET`.

---

## 5. Proctoring: Faktcheck vs HackerRank vs Unstop SmartHire

### What Faktcheck has (browser-event proctoring)

Fullscreen enforcement + exit detection, tab-switch/window-blur detection, copy/paste blocking (allowed in the code editor), screenshot *shortcut* interception (PrintScreen, Win+Shift+S, Ctrl+Shift+S), right-click and shortcut blocking (13 combos), 3-strike warning system with server-persisted counts, per-violation audit log with timestamps and an admin violations dashboard, auto-termination + server-side scored result on the 3rd strike.

That is a competent implementation of **signal-based browser proctoring** — comparable to what HackerRank calls its *default/built-in* integrity tier (tab and copy/paste tracking).

### How the commercial platforms work

**HackerRank** layers three modes ([Test Integrity docs](https://support.hackerrank.com/articles/1079706165-proctoring-hackerrank-tests), [Proctor Mode](https://support.hackerrank.com/articles/5663779659-proctor-mode)):
- *Secure Mode* — browser layer: forced fullscreen, copy/paste blocking, **multiple-monitor prevention**, tab-switch alerts.
- *Proctor Mode* — adds the camera and the desktop: **photo ID capture before the test**, webcam snapshots with **AI image analysis** (candidate absent, multiple faces, **phone/tablet object detection**), and **periodic screenshots of the screen every ~15 s, tightening to ~5 s when suspicion rises**, analysed by a model for ChatGPT/tutorial sites/overlay tools ([2025 AI-cheat detection write-up](https://www.hackerrank.com/writing/proctor-mode-vs-secure-mode-hackerrank-detects-chatgpt-ai-cheats-2025)).
- *Desktop App Mode* — an installed app for **OS-level lockdown** (blocks other apps entirely).
- Independent of proctoring, an **AI plagiarism engine** (~93% claimed accuracy) scores each submission using code-evolution history, keystroke/timing patterns, and cross-candidate similarity ([how it works](https://www.hackerrank.com/writing/can-proctor-mode-detect-chatgpt-hackerrank-2025-ai-plagiarism-engine)). Crucially, flags go to a **human reviewer with evidence attached** — candidates are not auto-failed.

**Unstop (SmartHire / 360° proctoring)** ([product page](https://unstop.com/employers/online-assessment-platform/360-degree-next-gen-proctoring), [AI proctoring blog](https://unstop.com/blog/unstop-ai-proctoring)):
- **Identity verification before start** — live selfie matched against an official (Aadhaar) ID.
- **Continuous webcam video** with multiple-face detection and gaze/attention tracking.
- **Audio analysis** — background voices/coaching detection.
- **Full session recording** (video + screen) end-to-end.
- Tab/fullscreen/app-switch logging with timestamps (same as Faktcheck) **plus phone/device detection, IP & geo-location mismatch flags**, and a per-candidate **risk score** rolled into a reviewer-friendly report with evidence.

### The gap, concretely

| Capability | Faktcheck | HackerRank | Unstop SmartHire |
|---|---|---|---|
| Fullscreen / tab / blur detection | ✅ | ✅ | ✅ |
| Copy/paste control + paste content in report | ⚠️ blocks, but logs no pasted content | ✅ | ✅ |
| Multiple-monitor detection | ❌ | ✅ (Secure Mode) | ✅ |
| Identity verification (photo/ID match) | ❌ | ✅ photo capture | ✅ ID-matched face |
| Webcam presence / multiple-face / gaze | ❌ | ✅ AI-analysed snapshots | ✅ continuous video |
| Phone/object detection | ❌ | ✅ | ✅ |
| Audio analysis | ❌ | ❌/limited | ✅ |
| Screen recording / screenshots | ❌ | ✅ 15 s → 5 s adaptive | ✅ full recording |
| Code plagiarism / AI-generated-code detection | ❌ | ✅ ML engine | ✅ |
| IP / geolocation checks | ❌ | partial | ✅ |
| Risk scoring + human review workflow | ❌ (hard 3-strike auto-kill) | ✅ | ✅ |
| OS-level lockdown option | ❌ | ✅ desktop app | ⚠️ browser-based |

### Why they're structurally better (not just "more features")

1. **They don't trust the browser.** Everything Faktcheck detects is a DOM event in the candidate's own JavaScript runtime. A candidate can open DevTools *before* entering the exam route, monkey-patch `document.addEventListener` / `visibilitychange`, and become invisible — or simply use a **second device** (phone with ChatGPT, a friend's laptop), which browser events can never see. Webcam + screen capture + object detection close exactly those channels.
2. **They verify who's typing.** Faktcheck has no identity check at all — anyone with the candidate's password can sit the exam. HackerRank photographs the candidate; Unstop matches the face to a government ID.
3. **They analyse the artefact, not just the session.** HackerRank's plagiarism engine catches copied or AI-generated code *after* submission via similarity and code-evolution analysis. Faktcheck runs no similarity check between submissions at all — two candidates submitting identical code are undetectable.
4. **They treat detection as evidence, not a verdict.** Faktcheck's 3-strikes auto-terminate is harsh on false positives (an OS notification stealing focus = `WINDOW_BLUR` strike) while being weak on real attacks. The commercial pattern — flag, score, record, let a human decide — is both fairer and stronger. *(Faktcheck already stores per-violation evidence and shows it to organisers, which is a good foundation; auto-termination severity is a policy choice on top.)*

### Realistic upgrade path for Faktcheck (in rough order of value/effort)

1. **Paste-content logging** — on `PASTE_ATTEMPT` (and in Monaco), record the pasted text in the violation `details`. Nearly free; catches ChatGPT copy-ins. *(Post-migration ideas already sketched in `post_migration_features.md`.)*
2. **Code-similarity check** — run pairwise token-similarity (or Stanford MOSS) over final submissions per problem; surface a similarity report to organisers.
3. **Multiple-monitor heuristic** — `window.screen.isExtended` (Window Management API) flags extended displays in Chromium.
4. **Webcam snapshots** — `getUserMedia` + periodic JPEG capture to Cloudinary + organiser gallery. Even *without* AI analysis, recorded presence is a large deterrent. Face-count via a lightweight on-device model (e.g. MediaPipe/face-api) can come later.
5. **Photo-at-start identity capture** — one webcam still before entry, attached to the attempt.
6. **Risk score instead of instant kill** — weight violation types (blur < tab-switch < fullscreen-exit), auto-terminate only above a threshold, keep everything reviewable.
7. Longer term: screen capture (`getDisplayMedia`), typing-cadence anomaly detection, and a desktop/kiosk mode if stakes justify it.

---

## 6. Pre-launch checklist (condensed)

**Must do before first real contest**
- [x] Port the auto-submit-expired-attempts job into the cron route (B1) — *done 2026-07-15*
- [x] Fix `createFormSchema` (accept full field config incl. `fieldId`, `marks`, `correctAnswers`, `isAutoScored`) **and** strip `correctAnswers` from participant form fetches (B2) — *done 2026-07-15*
- [x] Add ownership checks to MCQ/coding `[id]` PUT/DELETE, `add-from-library`, and `forms/[id]` (H1) — *done 2026-07-15*
- [x] Add an MCQ unlink endpoint + point the ManageMCQ delete button at it (H2) — *done 2026-07-15*
- [x] Serverless-safe rate limiting: auth limits now durable in a MongoDB TTL collection; SSE degrades gracefully to reconnect+sync (H3) — *done 2026-07-15*
- [x] Retire the KodingKulture server at cutover — *decision confirmed by owner: KK is taken down when Faktcheck ships* (H4)
- [ ] **Operational:** rename/migrate off the `test` database; enable Atlas backups (H4)
- [x] Green `pnpm build` verified (earlier failure was an offline font fetch) — *done 2026-07-15*
- [x] Create an admin-bootstrap path — `scripts/create-admin.mjs` — *done 2026-07-15*
- [ ] **Operational:** set `CRON_SECRET` + all `.env.example` vars in the hosting environment

**Should do soon after**
- [x] Maintain `sections.*.totalMarks` on question add/remove — *done 2026-07-15 (add-from-library, remove, direct create/delete, and form create/update/delete)*
- [x] Restore `isPublished` condition in the cron — *done 2026-07-15*
- [ ] Overall contest countdown when no section timers
- [ ] Gate MCQ review on full contest submission; keep college/phone from registration
- [ ] Wire up (or remove) the AI generation endpoints; restore library search
- [ ] Error monitoring (Sentry), structured logs, `/health`, `.env.example`, smoke tests
- [ ] Proctoring upgrades §5: paste-content logging + code-similarity first

---

*Audit generated 2026-07-14 from a complete read of both codebases plus public documentation of HackerRank and Unstop proctoring. Sources: [HackerRank Test Integrity](https://support.hackerrank.com/articles/1079706165-proctoring-hackerrank-tests), [HackerRank Proctor Mode](https://support.hackerrank.com/articles/5663779659-proctor-mode), [HackerRank AI-cheat detection (2025)](https://www.hackerrank.com/writing/proctor-mode-vs-secure-mode-hackerrank-detects-chatgpt-ai-cheats-2025), [HackerRank AI plagiarism engine](https://www.hackerrank.com/writing/can-proctor-mode-detect-chatgpt-hackerrank-2025-ai-plagiarism-engine), [Unstop 360° proctoring](https://unstop.com/employers/online-assessment-platform/360-degree-next-gen-proctoring), [Unstop AI proctoring](https://unstop.com/blog/unstop-ai-proctoring).*
