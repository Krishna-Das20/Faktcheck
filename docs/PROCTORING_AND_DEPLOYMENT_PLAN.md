# FaktCheck — Advanced Proctoring & Deployment Plan

> **✅ Implementation status (2026-07-15):** Phases 0–4 **plus** the video-tier object detection, reviewer decision actions, and code-similarity engine are **built and merged** (green `pnpm build`). Delivered: the risk-score model (`ProctorFlag`, weighted scoring, server-side warn/terminate), browser-signal upgrades (multi-monitor + paste-content logging), the pre-exam **system-check + consent + identity** wizard, on-device **MediaPipe face detection** + **COCO-SSD phone/object detection** + **Web Audio voice-activity detection**, adaptive snapshot evidence, private (signed-URL) evidence storage, a **reviewer dashboard** (`/admin/contest/:id/proctoring`) with **clear/confirm/void decision actions**, and a reviewer-triggered **code-similarity scan** (`/admin/contest/:id/similarity`, simplified MOSS). Opt-in per contest via the `mediaProctoring` config — existing contests are unaffected. **Not yet built:** `getDisplayMedia` full session recording, ID-face-match (KYC), and live-invigilation streaming — the §11 Phase 6 "higher tiers." Deployment (§10) is unchanged guidance. The sections below are the original plan, kept as the reference spec.

> **Goal:** Bring FaktCheck's proctoring UX and detection close to HackerRank Proctor Mode / Unstop SmartHire — specifically **video + audio proctoring** — and decide **how and where to deploy** the whole system (Next.js app, real-time channel, Judge0, and the new media pipeline).
>
> **Scope note:** This is a design + implementation plan mapped onto FaktCheck's actual stack (Next.js 16 App Router, MongoDB/Mongoose, Cloudinary, self-hosted Judge0, browser-event `ProctorGuard`). It builds on the current codebase — where FaktCheck already has fullscreen/tab/copy-paste/screenshot-shortcut detection, a 3-strike warning system, and a server-persisted violation log. It does **not** replace that; it layers media proctoring and richer UX on top.
>
> **Author's stance:** Everything here is **client-side / on-device inference wherever possible** (privacy + cost + latency), with the server storing evidence and computing a risk score. That is exactly the architecture the commercial tools use for the browser tier. Nothing here needs a GPU cluster.

---

## Table of contents

1. [How HackerRank & Unstop actually work (the model to copy)](#1-how-hackerrank--unstop-actually-work)
2. [Target architecture for FaktCheck](#2-target-architecture-for-faktcheck)
3. [The pre-exam UX (system check + identity capture)](#3-the-pre-exam-ux)
4. [Video proctoring — implementation](#4-video-proctoring--implementation)
5. [Audio proctoring — implementation](#5-audio-proctoring--implementation)
6. [Screen recording & multi-monitor detection](#6-screen-recording--multi-monitor-detection)
7. [Risk scoring & the reviewer dashboard (the real UX win)](#7-risk-scoring--the-reviewer-dashboard)
8. [Data model & API additions](#8-data-model--api-additions)
9. [Privacy, consent & legal](#9-privacy-consent--legal)
10. [Deployment — what to use and why](#10-deployment--what-to-use-and-why)
11. [Phased rollout plan](#11-phased-rollout-plan)
12. [Cost estimate](#12-cost-estimate)
13. [Library / service cheat-sheet](#13-library--service-cheat-sheet)
14. [Sources](#14-sources)

---

## 1. How HackerRank & Unstop actually work

Understanding the reference implementations tells us exactly what to build.

### HackerRank (three integrity tiers + a plagiarism engine)
- **Secure Mode** (browser layer): forced fullscreen, copy/paste blocking, **multiple-monitor prevention**, tab-switch alerts. *(FaktCheck already has most of this.)*
- **Proctor Mode** (camera + screen): a **photo-ID capture before the test**, then **webcam snapshots every ~5 s** analysed by AI for candidate-absent / multiple-faces / **phone & tablet object detection**; and **screen snapshots every ~15 s, tightening to ~5 s** when something suspicious happens, analysed for tutorial sites / answer-sharing / AI assistants / overlay tools.
- **Desktop App Mode**: an installed app for OS-level lockdown (out of scope for a web platform).
- **AI plagiarism engine** (independent of proctoring): similarity + code-evolution + timing analysis, with a **human reviewer** getting the flags and evidence. Candidates are *not* auto-failed.

Key detail: capture is **adaptive** — normal cadence is slow, and it speeds up on a trigger. This keeps cost/bandwidth low and only zooms in when needed.

### Unstop SmartHire (360° proctoring)
- **Identity verification before start** — live selfie matched to an official ID (Aadhaar in India).
- **Continuous webcam** with multiple-face + gaze/attention tracking.
- **Audio analysis** — background voices / coaching detection.
- **Full session recording** (video + screen), plus tab/app-switch logging, **phone/device detection**, **IP + geo-location mismatch flags**, and a **per-candidate risk score** rolled into a reviewer report with evidence.

### The three lessons we copy
1. **Don't trust the browser events alone.** Add a camera + mic + screen layer, because a second device (phone with ChatGPT) is invisible to DOM events.
2. **Detection is evidence, not a verdict.** Store flags with images/clips + timestamps, compute a *risk score*, and let a human decide. This is fairer *and* stronger than FaktCheck's current hard 3-strike auto-kill.
3. **Inference on-device, evidence to the server.** Face/object/voice detection runs in the candidate's browser; only *flags* + occasional *snapshots/clips* are uploaded.

---

## 2. Target architecture for FaktCheck

```
┌────────────────────────── Candidate browser (during exam) ──────────────────────────┐
│                                                                                       │
│  ProctorGuard (existing)          ProctorMedia (NEW client module)                    │
│  • fullscreen / tab / blur        • getUserMedia(camera+mic)  → hidden <video>        │
│  • copy / paste / shortcuts       • MediaPipe/TF.js face + object detection (on-device)│
│  • screenshot-shortcut keys       • VAD (Silero, on-device) for background voice      │
│                                   • getDisplayMedia() → screen snapshots (optional)   │
│                                   • MediaRecorder → chunked webcam clip (optional)    │
│                                                                                       │
│  produces: violation events + flag events + periodic snapshots + (optional) clips     │
└───────────────────────────────────────────┬───────────────────────────────────────┘
                                             │ HTTPS (batched)
              ┌──────────────────────────────┼──────────────────────────────┐
              │                               │                              │
     POST /api/contests/:id/violation   POST /api/proctor/flag       PUT (signed) → object store
     (existing, extended)               (NEW — camera/audio/screen     (NEW — snapshots + clips
                                          flags + risk weight)          go straight to R2/S3, not Mongo)
              │                               │                              │
              └───────────────┬───────────────┘                              │
                              ▼                                               ▼
                    MongoDB (Violation, ProctorFlag,                 Cloudflare R2 / S3 bucket
                     ContestProgress.riskScore)                      (private; signed URLs for review)
                              │
                              ▼
        Organiser reviewer dashboard  ←  GET /api/proctor/session/:contestId/:userId
        (timeline of flags + thumbnails + risk score + "terminate / clear" actions)
```

**Why this shape:**
- **On-device ML** means no per-frame server cost, no GPU, works at 100+ concurrent candidates. First load pulls ~2–3 MB of model weights once, then everything runs locally (this is the same tradeoff the Vue/TF.js proctoring SDKs report).
- **Media goes to object storage, not MongoDB.** Snapshots/clips are large and binary — they belong in R2/S3 behind signed URLs. Mongo only stores the *flag metadata* and a *pointer* (object key).
- **Risk score lives on `ContestProgress`** so the leaderboard/participants views can show it, and auto-termination becomes a threshold on the score instead of a blunt 3-strike count.

---

## 3. The pre-exam UX

This is the single biggest UX upgrade and where HackerRank/Unstop feel "professional." Before the contest hub, insert a **System Check + Onboarding** gate (a new step in `ProctoredContest` before `ProctorGuard` mounts).

### 3.1 System-check wizard (blocks entry until all pass)
A full-screen stepper with live status chips:

1. **Browser & connection** — check `navigator.mediaDevices` exists, online, Chromium/Firefox (warn on Safari for `getDisplayMedia` quirks).
2. **Camera** — `getUserMedia({video})`; show a live preview; confirm exactly one face is visible using the face detector (reuse the model you'll load anyway).
3. **Microphone** — `getUserMedia({audio})`; show a live input-level meter (Web Audio `AnalyserNode`) so the candidate sees it working.
4. **Fullscreen** — request and confirm.
5. **Screen share** (if screen proctoring is on) — `getDisplayMedia`; verify they shared the **entire screen**, not a tab (check `track.getSettings().displaySurface === 'monitor'`).
6. **Multi-monitor** — `window.getScreenDetails()` (Window Management API) or `window.screen.isExtended`; warn/block if extended displays are detected.

Each step: ✅/❌ with a plain-English fix ("Please allow camera access in the address bar"). Entry button stays disabled until required steps pass. This mirrors HackerRank's device-check screen and dramatically reduces mid-exam failures.

### 3.2 Identity capture (photo, and optionally ID)
- **Photo-at-start**: capture one webcam still, confirm one face, upload to object storage, attach to the attempt. This alone is a large deterrent and gives reviewers a reference face.
- **ID match (optional, higher tier)**: capture a still of a government ID + a selfie; run a face-similarity comparison. **Don't build face-matching yourself for launch** — either (a) store both images for *manual* reviewer comparison, or (b) integrate a KYC/identity API (AWS Rekognition `CompareFaces`, or an India-specific Aadhaar-offline-eKYC/DigiLocker flow if you need Unstop-parity in India). Aadhaar online verification requires being a licensed AUA/KUA — treat that as a "later, if a client demands it" item, not launch.

### 3.3 Consent screen (mandatory — see §9)
Explicit, logged consent: "This exam records your camera, microphone" + (screen). Store `consentGivenAt` on the attempt. No consent → no exam (offer an alternative/appeal path per your policy).

---

## 4. Video proctoring — implementation

### 4.1 Capture
```ts
const stream = await navigator.mediaDevices.getUserMedia({
  video: { width: 640, height: 480, frameRate: 15 },
  audio: true,
});
// attach to an off-screen <video> element; never show a distracting self-view during the exam
```
Keep resolution low (640×480). You are analysing, not filming a movie — low res = less CPU, less bandwidth, less storage.

### 4.2 On-device detection (the core)
Run a detection loop at **1–2 fps** (not the video's 15 fps — inference every frame is wasteful). Use **MediaPipe Tasks** (`FaceDetector` / `FaceLandmarker`) or **TensorFlow.js** models:

| Signal | Model | What it flags |
|---|---|---|
| **Face presence** | MediaPipe `FaceDetector` (BlazeFace) | `NO_FACE` when absent > N seconds |
| **Multiple faces** | same, `numFaces > 1` | `MULTIPLE_FACES` |
| **Gaze / head pose** | MediaPipe `FaceLandmarker` (478 landmarks → yaw/pitch) | `LOOKING_AWAY` when sustained off-screen |
| **Phone / book / laptop** | TF.js **COCO-SSD** (`cell phone`, `book`, `laptop` classes) | `PHONE_DETECTED`, `BOOK_DETECTED` |

MediaPipe FaceDetector is BlazeFace-based and built for real-time mobile/GPU inference; FaceLandmarker gives 478 points for gaze/attention. COCO-SSD localizes + classifies multiple objects per frame. All run in-browser via WebGL/WASM.

Load models once (lazy, during the system check so the exam starts warm). Total weights ≈ 2–3 MB.

### 4.3 Adaptive evidence capture (copy HackerRank's cadence)
- **Baseline**: capture a webcam **snapshot every 15 s** (canvas → JPEG blob). Upload via signed URL to object storage.
- **On a trigger** (any face/object/audio flag, or a `ProctorGuard` violation): tighten to **every 5 s** for the next ~30 s, and capture a snapshot **at the moment of the flag** so the reviewer sees exactly what happened.
- Snapshots are ~30–60 KB each at 640×480 JPEG q0.6. At 15 s cadence that's ~4 snapshots/min ≈ ~10 MB for a 60-min exam per candidate. Very manageable (see §12).

### 4.4 (Optional, higher tier) Continuous clip
If a client wants Unstop-style **full session recording**, use `MediaRecorder` on the camera stream with `timeslice` (e.g. `recorder.start(15000)` → a Blob every 15 s), upload each chunk as it arrives (`ondataavailable`), and stitch server-side or just store the chunk sequence. WebM/VP8 or VP9. This is bandwidth-heavy (~50–150 MB/hour/candidate) — make it a per-contest toggle, default **off**; snapshots are enough for most cases.

### 4.5 Detection loop skeleton
```ts
// runs in a Web Worker where possible to keep the exam UI responsive
async function tick() {
  const now = performance.now();
  const faces = await faceDetector.detectForVideo(videoEl, now);
  if (faces.detections.length === 0) raiseFlag("NO_FACE");
  else if (faces.detections.length > 1) raiseFlag("MULTIPLE_FACES");

  const objs = await cocoModel.detect(videoEl);        // ~1 fps is fine
  for (const o of objs)
    if (["cell phone","book","laptop"].includes(o.class) && o.score > 0.6)
      raiseFlag("OBJECT_DETECTED", { object: o.class, confidence: o.score });

  // gaze from landmarks (yaw/pitch beyond threshold for > 3 s)
  scheduleNextTick(); // 500–1000 ms
}
```
`raiseFlag` debounces (don't fire `NO_FACE` 60×/min — coalesce into one flag with a duration), batches to `POST /api/proctor/flag`, and triggers an evidence snapshot.

### 4.6 Anti-tamper note
On-device JS can be monkey-patched by a determined candidate (open DevTools before entry, stub `getUserMedia`). Mitigations: (a) the **server** expects a heartbeat + periodic snapshot — if snapshots stop arriving, that itself is a flag (`CAMERA_LOST`); (b) verify the uploaded snapshot actually contains a face server-side occasionally; (c) reserve OS-level lockdown for a future desktop/kiosk mode. Perfect prevention isn't the goal — raising cost and leaving evidence is.

---

## 5. Audio proctoring — implementation

Audio is cheaper than video and catches "someone is coaching me" / "I'm on a call."

### 5.1 Voice Activity Detection (on-device)
Use **`@ricky0123/vad-web`** (Silero VAD via ONNX Runtime Web). It emits speech-start/speech-end events with a 0–1 speech probability; runs entirely in the browser.

```ts
import { MicVAD } from "@ricky0123/vad-web";
const vad = await MicVAD.new({
  onSpeechStart: () => { speechStartedAt = Date.now(); },
  onSpeechEnd: (audio) => {
    const durationMs = Date.now() - speechStartedAt;
    if (durationMs > 2000) raiseFlag("VOICE_DETECTED", { durationMs });
    // optionally upload the `audio` Float32Array clip as evidence
  },
});
vad.start();
```

### 5.2 What to flag (and what NOT to)
- **Flag**: sustained speech (> ~2 s), repeated speech bursts, multiple distinct voices (rough heuristic: many short alternating segments). The candidate reading aloud once is not the crime; sustained conversation is.
- **Don't over-flag**: a cough, a door, a single "um." Use duration + frequency thresholds and let the *risk score* weight it low. Background-noise handling: Web Audio `AnalyserNode` RMS energy + a high-pass filter, with an adjustable sensitivity threshold, reduces false positives.
- **Evidence**: optionally upload the short speech clip (few hundred KB) so a reviewer can listen. This is the single most defensible audio signal — a human hears it and decides.

### 5.3 Speech-to-text (later, optional)
Detecting *content* ("the answer is B") needs transcription. Whisper (server-side) or the Web Speech API (Chrome, unreliable) — treat as a much-later enhancement. VAD (is-someone-talking) covers 90% of the value for 5% of the effort.

---

## 6. Screen recording & multi-monitor detection

### 6.1 Multi-monitor (cheap, high value — do this first)
```ts
// Window Management API (Chromium). Needs a permission prompt.
if ("getScreenDetails" in window) {
  const details = await window.getScreenDetails();
  if (details.screens.length > 1) raiseFlag("MULTIPLE_MONITORS");
}
// Fallback signal:
if (window.screen.isExtended) raiseFlag("EXTENDED_DISPLAY");
```
Re-check periodically (a candidate can plug in a monitor mid-exam).

### 6.2 Screen snapshots (medium value)
`getDisplayMedia({ video: { displaySurface: 'monitor' } })` → draw the screen track to canvas → JPEG every ~15 s (adaptive to 5 s on trigger), upload to object storage. This is what catches "ChatGPT open in another window." Verify they shared the **whole monitor** (reject `browser`/`window` surfaces). Note: the browser shows a persistent "sharing your screen" banner — that's expected and part of the deterrent.

### 6.3 Screen full recording (highest cost)
Same `MediaRecorder` chunked approach as §4.4 but on the screen stream. Reserve for high-stakes contests; default off.

> **Reality check:** browser screen capture requires the candidate to *grant* it and *can* be revoked; it's a deterrent + evidence tool, not a lockdown. True lockdown is a desktop app (HackerRank's third tier) — out of scope for a web platform.

---

## 7. Risk scoring & the reviewer dashboard

**This is the UX that makes it feel like HackerRank/Unstop — more than any single detector.**

### 7.1 Replace the hard 3-strike kill with a weighted risk score
Store `riskScore` on `ContestProgress`. Each flag adds weight:

| Flag | Weight (tune later) |
|---|---|
| `WINDOW_BLUR` (OS notification etc.) | 1 |
| `TAB_SWITCH` | 5 |
| `FULLSCREEN_EXIT` | 5 |
| `LOOKING_AWAY` (sustained) | 3 |
| `NO_FACE` (sustained) | 8 |
| `VOICE_DETECTED` (sustained) | 8 |
| `MULTIPLE_FACES` | 20 |
| `PHONE_DETECTED` | 25 |
| `MULTIPLE_MONITORS` | 15 |
| `SCREEN_SHARE_STOPPED` | 15 |

- **Soft warning** to candidate at a low threshold (e.g. 15) — the existing warning modal.
- **Auto-terminate** only above a high threshold (e.g. 60) *or* on a single catastrophic flag (phone + multiple faces together).
- Everything is logged regardless; termination is a policy layer on top, and it's now **fair** (an OS notification blur no longer counts the same as a phone in frame).

This directly fixes the audit's H-tier critique: *"3-strikes auto-terminate is harsh on false positives while weak on real attacks."*

### 7.2 The reviewer dashboard (extend the existing `ContestViolations` admin page)
A per-candidate session view:
- **Header**: name, email, identity photo, **risk score** with a colour band (green/amber/red), final status.
- **Timeline**: every flag in time order, each with its thumbnail snapshot (click → full image / clip / audio from signed URL), type, confidence, duration.
- **Filmstrip**: the 15 s snapshot sequence as a scrubbable strip — reviewers catch patterns fast.
- **Actions**: "Clear candidate" / "Confirm violation" / "Void attempt" — human decision, recorded with the reviewer's id.
- **Contest overview**: sortable table of all candidates by risk score so reviewers triage the worst first.

FaktCheck already stores per-violation evidence and shows it to organisers — this is an *extension* of an existing, good foundation, not a from-scratch build.

---

## 8. Data model & API additions

Keep it additive (same superset-friendly approach the migration already used).

### 8.1 New model: `ProctorFlag`
```ts
{
  contestId, userId,            // refs
  type: "NO_FACE" | "MULTIPLE_FACES" | "LOOKING_AWAY" | "OBJECT_DETECTED"
      | "VOICE_DETECTED" | "MULTIPLE_MONITORS" | "SCREEN_SHARE_STOPPED"
      | "CAMERA_LOST" | ...,     // superset of Violation.type
  source: "video" | "audio" | "screen" | "browser",
  confidence: Number,           // 0–1 from the model
  weight: Number,               // risk contribution
  startedAt, endedAt, durationMs,
  evidenceKey: String | null,   // object-store key for snapshot/clip/audio
  details: String,
}
// index: { contestId: 1, userId: 1, startedAt: -1 }
```

### 8.2 Extend `ContestProgress`
```ts
riskScore: { type: Number, default: 0 },
mediaProctoring: {
  consentGivenAt: Date,
  identityPhotoKey: String,
  cameraActive: Boolean,
  lastSnapshotAt: Date,          // to detect CAMERA_LOST (heartbeat gap)
},
```
> Note: keep the existing `Violation` model and 6 browser types working as-is for backward compatibility with the shared DB; `ProctorFlag` is the richer superset going forward. You can migrate `Violation` writes into `ProctorFlag` later or dual-write during transition.

### 8.3 New API routes
| Route | Purpose |
|---|---|
| `POST /api/proctor/flag` | Batched flag ingestion; recomputes `riskScore`; applies soft-warn / auto-terminate thresholds (server-side, same pattern as the existing violation route). |
| `POST /api/proctor/upload-url` | Returns a **signed PUT URL** for a snapshot/clip so media goes browser→object-store directly (never through the Next.js function — critical for cost/perf). |
| `POST /api/proctor/identity` | Stores the identity photo key + consent timestamp. |
| `GET /api/proctor/session/:contestId/:userId` | Reviewer view: flags + signed GET URLs for evidence + risk score. |
| `GET /api/proctor/overview/:contestId` | All candidates ranked by risk (reviewer triage). |

All authenticated, rate-limited, and ownership-checked exactly like the routes fixed in the production audit (`requireContestOwner` for the reviewer endpoints).

---

## 9. Privacy, consent & legal

Recording faces, voices, and screens is **personal/biometric data**. This is not optional polish — get it wrong and you have a bigger problem than cheating.

- **Explicit, logged consent** before capture (store `consentGivenAt`). Tell candidates exactly what's recorded and why.
- **Data minimisation**: prefer snapshots + on-device inference over full recordings; low resolution; capture only during the active attempt.
- **Retention policy**: auto-delete media after the review window (e.g. 30–90 days). Object-store lifecycle rules make this one config line. Put a TTL on `ProctorFlag` evidence too.
- **Access control**: evidence only via short-lived signed URLs, only to the contest owner/admin. Never public.
- **Jurisdiction**: India → DPDP Act; EU candidates → GDPR (biometric = special category, needs a lawful basis + DPIA); US states vary (BIPA in Illinois is strict on biometrics). If you'll have EU/US candidates, get a one-page policy reviewed. Aadhaar-based identity specifically requires licensed AUA/KUA status — do **not** DIY it.
- **Accessibility / fairness**: gaze/face models have known bias (lighting, skin tone, disability). This is *another* reason detection must be **evidence for a human**, never an automatic fail. Provide an appeal path.

---

## 10. Deployment — what to use and why

FaktCheck has **three** things to run, with different needs. The single most important deployment fact: **FaktCheck uses SSE (`sseManager.ts`) and an in-memory rate-limit fallback, which want a persistent server, and media proctoring adds long-lived connections and heartbeats.** That pushes you off pure serverless for the app tier.

### 10.1 The app (Next.js 16)
**Recommended: a persistent Node host — Railway (or Render / Fly.io / a VPS).** Not Vercel serverless, for these concrete reasons:
- Vercel runs SSE/WebSocket **inside a function with a duration cap** (5 min default; 30 min beta on Pro/Enterprise). Your SSE role-sync channel and any proctor heartbeat get recycled and must reconnect constantly.
- The in-memory rate-limit fallback and `sseManager`'s connection `Map` are **per-instance** — they fracture across serverless instances. (The production audit already made auth rate limits durable in Mongo to survive this, but a persistent host removes the whole class of problem.)
- Railway is repeatedly cited as the pragmatic "Vercel-like DX, container model, predictable at scale" choice for exactly this SSE/WebSocket + long-running situation.

**If you must stay on Vercel:** it's viable *with* the mitigations already in place (durable rate limiting done; SSE degrades to reconnect+sync, also already handled) — but move the real-time channel to a managed pub/sub (Ably/Pusher/Upstash) rather than the in-process `Map`, and never rely on in-memory state. For a proctoring-heavy product, a persistent host is simpler and cheaper to reason about.

### 10.2 Judge0 (code execution)
**Self-host on a Linux VPS with Docker Compose** — Hetzner (best price/perf), DigitalOcean, or an AWS EC2. Non-negotiable specifics:
- **Linux only** (not Windows/Mac for prod). Ubuntu 22.04/24.04.
- **Judge0 needs cgroup v1.** Modern distros default to cgroup v2 → append `systemd.unified_cgroup_hierarchy=0 systemd.legacy_systemd_cgroup_controller=1` to GRUB and reboot. This is the #1 self-host gotcha.
- Docker + Docker Compose; open the API port to **only your app server** (not `0.0.0.0/0`) — put Judge0 on a private network / firewall it to the app's IP. Add `JUDGE0_API_KEY`.
- Size: a 2–4 vCPU / 4–8 GB box handles a club-scale contest; scale workers for bigger fields. Keep it separate from the app host so a heavy compile can't starve the web tier.

### 10.3 Media storage (snapshots / clips / identity photos)
**Use object storage with a signed-upload flow, NOT Cloudinary, NOT MongoDB.**
- **Cloudflare R2** is the standout: **$0.015/GB storage and $0 egress**. Egress is the killer with proctoring media (reviewers re-watch clips) — R2's free egress vs S3's ~$0.09/GB out is the difference between ~$1.50 and ~$47 for a 100 GB + 500 GB-egress month.
- **AWS S3** is fine if you're already in AWS (and pairs naturally with Rekognition if you add ID-matching), just budget egress.
- **Backblaze B2** is even cheaper on storage (~$0.006/GB) if you want rock-bottom.
- **Cloudinary** (what FaktCheck uses today for question images) is convenient for *images/transforms* but not the right economics for volume video/audio evidence. Keep Cloudinary for question banners/images; put proctoring evidence in R2.
- Upload path: browser → `POST /api/proctor/upload-url` → signed PUT → object store. The Next.js function never touches the bytes. Reviewer reads via signed GET. Lifecycle rule auto-deletes after the retention window (§9).

### 10.4 The real-time channel (as media scales)
The current SSE is fine for role-sync. For **proctor flag streaming to a live reviewer** at scale, consider a managed channel (**Ably / Pusher / Upstash**) or a small dedicated WebSocket process — the common production pattern is "Next.js for UI + a separate process/service for real-time." Not needed for launch (flags can be polled or SSE'd), but plan for it if you want live invigilation of many candidates at once.

### 10.5 Reference topology
```
Cloudflare (DNS + CDN + R2 object storage, $0 egress)
        │
        ├── App: Railway  → Next.js 16 (SSE, proctor APIs, reviewer dashboard)
        │        └── MongoDB Atlas (dedicated DB, backups on)   ← audit: move off "test"
        │
        └── Judge0: Hetzner VPS (Docker Compose, cgroup v1, firewalled to app IP)

Optional at scale: Ably/Pusher for live proctor streaming; AWS Rekognition for ID-face-match.
```

---

## 11. Phased rollout plan

Ordered by value ÷ effort. Each phase is independently shippable and independently useful.

| Phase | Ships | Effort | Why this order |
|---|---|---|---|
| **0. Foundation** | `ProctorFlag` model, `riskScore` on progress, `POST /api/proctor/flag`, weighted scoring, soft-warn/terminate thresholds. Reviewer dashboard shows risk score + flag timeline (no media yet). | S–M | Converts today's hard 3-strike into a fair, extensible risk model. Immediate fairness win, no camera needed. |
| **1. Cheap browser signals** | Multi-monitor detection, paste-content logging (record pasted text in `details`), extended-display check. | S | Nearly free; closes real gaps (second monitor, ChatGPT paste-ins). |
| **2. Pre-exam UX** | System-check wizard + consent screen + identity photo capture → object storage. | M | The biggest *perceived* professionalism jump; also cuts mid-exam failures. Introduces the R2 signed-upload flow. |
| **3. Video proctoring** | `getUserMedia` + MediaPipe face (presence/multi-face/gaze) + COCO-SSD (phone/book) on-device; adaptive 15 s→5 s snapshot evidence to R2; snapshots surface in the dashboard filmstrip. | L | The core HackerRank-parity feature. Reuses the identity-capture plumbing from Phase 2. |
| **4. Audio proctoring** | Silero VAD (`@ricky0123/vad-web`) for background-voice flags; optional short speech-clip evidence. | M | Cheap add-on once media plumbing exists; catches coaching/calls. |
| **5. Screen proctoring** | `getDisplayMedia` monitor-only snapshots (adaptive); "screen share stopped" flag. | M | Catches other-window AI tools; per-contest toggle. |
| **6. Higher tiers (as needed)** | Full session recording (video/screen via chunked `MediaRecorder`), ID-face-match (Rekognition/KYC), code-similarity/plagiarism (MOSS-style), live invigilation channel. | L+ | Only when a client's stakes justify the cost/complexity. |

**Deployment migration** (do alongside Phase 0–2): move app to Railway, stand up Judge0 on Hetzner, provision an R2 bucket + lifecycle rules, move MongoDB to a dedicated Atlas DB with backups (the production audit already flagged this).

---

## 12. Cost estimate

Rough, for planning. Assume a **500-candidate, 60-minute** contest, video snapshots at 15 s cadence, no full recording.

- **Snapshots**: ~4/min × 60 min = 240 webcam snapshots/candidate. Add ~240 screen snapshots if screen proctoring is on. At ~50 KB each: ~12 MB (video only) or ~24 MB (video+screen) per candidate → **6–12 GB per contest**.
- **R2 storage**: 12 GB × $0.015 = **~$0.18** for that contest's media; **$0 egress** when reviewers watch. Even 100 such contests/month ≈ 1.2 TB ≈ **~$18/month** storage.
- **Full recording** (if enabled): ~50–150 MB/candidate/hour → 25–75 GB per 500-candidate contest. Still cheap to store on R2; the cost is candidate bandwidth/CPU, so keep it opt-in.
- **Compute for ML**: **$0** — runs on candidate devices.
- **App host (Railway)**: ~$5–20/month at this scale.
- **Judge0 VPS (Hetzner)**: ~€4–15/month (CX22–CX32 class).
- **MongoDB Atlas**: free M0 for testing; ~$9+/month (M2/M10) for production with backups.
- **Optional ID-match (Rekognition)**: ~$1 per 1,000 `CompareFaces` calls — trivial at these volumes.

**Bottom line:** the media architecture is dominated by *storage*, which R2's zero-egress model makes cheap. The expensive commercial tools charge for *their* ML infra and reviewers — you're doing ML on-device and review in-house, so your marginal cost per candidate is cents.

---

## 13. Library / service cheat-sheet

| Need | Use | Notes |
|---|---|---|
| Camera/mic capture | `navigator.mediaDevices.getUserMedia` | Native; 640×480 @ 15fps |
| Screen capture | `navigator.mediaDevices.getDisplayMedia` | Verify `displaySurface==='monitor'` |
| Face presence / multi-face | **MediaPipe Tasks `FaceDetector`** (BlazeFace) | ~real-time, WASM/WebGL |
| Gaze / head pose | **MediaPipe `FaceLandmarker`** (478 pts) | Derive yaw/pitch |
| Phone / book / laptop | **TensorFlow.js `coco-ssd`** | Filter to `cell phone`,`book`,`laptop` |
| Background voice | **`@ricky0123/vad-web`** (Silero VAD, ONNX Runtime Web) | speech-start/end + probability |
| Audio level meter (system check) | Web Audio `AnalyserNode` (RMS) | High-pass filter to cut noise |
| Multi-monitor | Window Management API `getScreenDetails()` / `screen.isExtended` | Chromium |
| Chunked recording | `MediaRecorder` + `timeslice` + `ondataavailable` | WebM/VP8/VP9 only in Chromium/FF |
| Media storage | **Cloudflare R2** (signed PUT/GET) | $0 egress; lifecycle auto-delete |
| App host | **Railway** (or Render/Fly/VPS) | Persistent server for SSE/heartbeats |
| Code execution | **Self-hosted Judge0** on Hetzner (Docker, cgroup v1) | Firewall to app IP |
| Optional ID-face-match | AWS Rekognition `CompareFaces` | Or a KYC vendor; avoid DIY Aadhaar |
| Optional live streaming | Ably / Pusher / Upstash | Only at multi-candidate live-invigilation scale |
| Run heavy ML off the UI thread | Web Worker + OffscreenCanvas | Keeps the exam responsive |

---

## 14. Sources

**HackerRank**
- [Proctor Mode — HackerRank Knowledge Base](https://support.hackerrank.com/articles/5663779659-proctor-mode)
- [HackerRank Test Integrity](https://support.hackerrank.com/articles/1079706165-proctoring-hackerrank-tests)
- [Image Proctoring and Image Analysis (impersonation detection)](https://support.hackerrank.com/articles/7825915809-impersonation-detection)
- [Webcam Proctoring in Evaluation Software](https://www.hackerrank.com/writing/webcam-proctoring-in-evaluation-software-for-ai-skills-security-guide)
- [Proctor Mode vs Secure Mode — AI cheat detection (2025)](https://www.hackerrank.com/writing/proctor-mode-vs-secure-mode-hackerrank-detects-chatgpt-ai-cheats-2025)

**Unstop**
- [Unstop 360° Next-Gen Proctoring](https://unstop.com/employers/online-assessment-platform/360-degree-next-gen-proctoring)
- [Unstop AI Proctoring for Hiring at Scale](https://unstop.com/blog/unstop-ai-proctoring)
- [Features Needed in a Proctoring Tool](https://unstop.com/blog/features-needed-in-proctoring-tool)

**Browser ML / media**
- [Face & hand tracking with MediaPipe + TensorFlow.js (TF Blog)](https://blog.tensorflow.org/2020/03/face-and-hand-tracking-in-browser-with-mediapipe-and-tensorflowjs.html)
- [MediaPipe Face Detection](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_detection.md)
- [TensorFlow.js models (incl. coco-ssd)](https://www.tensorflow.org/js/models)
- [Integrating Face Detection & AI Proctoring with TF.js + MediaPipe (case study)](https://medium.com/@lahiri.arnab4/integrating-face-detection-and-ai-proctoring-in-a-vue-2-web-application-using-tensorflow-js-c49197f7183e)
- [MediaStream Recording API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API)
- [Screen + webcam mixing and recording with Web APIs (Nearform)](https://commerce.nearform.com/blog/2022/screen-webcam-mixing-recording/)
- [`@ricky0123/vad` — Voice Activity Detection for the browser](https://github.com/ricky0123/vad) · [docs](https://www.vad.ricky0123.com/)

**Deployment**
- [WebSockets on Vercel: native support, limits, options (Ably)](https://ably.com/vercel/websockets-on-vercel)
- [WebSockets with Next.js: SSR, App Router, Vercel (WebSocket.org)](https://websocket.org/guides/frameworks/nextjs/)
- [10 Best Next.js Hosting Providers 2026 (MakerKit)](https://makerkit.dev/blog/tutorials/best-hosting-nextjs)
- [Self-Hosting Judge0 step-by-step (TutorialsDojo)](https://tutorialsdojo.com/self-hosting-judge0-a-step-by-step-guide-using-aws-ec2-lambda-and-s3/)
- [Self-host Judge0 API with Docker (Medium)](https://denishoti.medium.com/how-to-self-host-judge0-api-on-your-pc-locally-all-you-need-to-know-ad8a2b64fd1)

**Storage cost**
- [Cloudflare R2 vs S3 vs Backblaze B2 — $0 egress (2026)](https://tech-insider.org/cloudflare-r2-vs-s3-vs-backblaze-b2-2026/)
- [Cloudflare R2 pricing explained vs S3 (2026)](https://mecanik.dev/en/posts/cloudflare-r2-pricing-explained-real-costs-vs-s3-and-backblaze/)
- [Media storage cost comparison, 7 platforms (LeanOps)](https://leanopstech.com/blog/media-storage-serverless-cost-comparison-2026/)

---

*Prepared 2026-07-15 for FaktCheck. This plan is additive to the production-readiness fixes in `PRODUCTION_READY_AUDIT.md` and the parity analysis in `SIMILARITY.md`. All ML inference is designed to run on-device (no GPU infrastructure required); the server stores evidence and computes risk. Treat all camera/mic/screen capture as regulated personal data — §9 is not optional.*
