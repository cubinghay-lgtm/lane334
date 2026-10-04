# Lane — Driver Learning & Safety MVP

**Congressional App Challenge project.** Lane turns the fast feel of a vertical video feed into a self-learning driver-education app. Every card teaches a California rule that matters on the permit test or on the road, then checks it with a quiz, a fill-in-the-blank, or a timed hazard reaction.

The recommendation system optimizes for learning and safe decisions, not time in the app.

## Quick start

Requires Node 22+ and pnpm 10+ (run `corepack enable` once if `pnpm` isn't installed). Works on macOS, Linux and Windows.

```bash
git clone https://github.com/cubinghay-lgtm/lane334.git
cd lane334/lane-driver-pwa-mvp
pnpm install
pnpm dev          # http://localhost:3000 — Express + tRPC + Vite (hot reload)
pnpm test         # unit + router integration tests (vitest)
pnpm check        # TypeScript
pnpm build        # client → dist/public (with service worker), server → dist/index.js
pnpm start        # serve the production build
```

The SQLite database is created at `./data/lane.db` (override with `DATABASE_URL`). Migrations run automatically at startup.

## Put it online (free)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/cubinghay-lgtm/lane334)

1. Click the button and sign in to Render with GitHub.
2. Click **Apply**. Render reads [`render.yaml`](../render.yaml): a free Node web service that builds with pnpm and health-checks `/api/health`.
3. After about 3 minutes you get a public `https://lane-….onrender.com` link. It's HTTPS, so the app can be installed to a phone's home screen.

Every push to the default branch redeploys automatically.

Free-plan limits:
- **Sleeping:** the service sleeps after 15 minutes without visitors, and the first visit afterwards takes about a minute to wake it.
- **Data resets:** the disk isn't persistent, so learner progress and board posts reset whenever the service restarts or redeploys. That's fine for demos. For lasting data, add a Render persistent disk (paid) mounted at `lane-driver-pwa-mvp/data`, or move the database to a hosted service.

## Features

| | |
|---|---|
| **Vertical feed** | One lesson per screen with snap scrolling. Each card has a clip, the rule's real-world impact, and a question underneath. Clips autoplay muted while on screen. |
| **Three question types** | Multiple choice, fill in the blank, and Quick-Time Reaction Events (QTE): a hazard appears and you have 3–5 s to choose *Yield to right*, *Slow down*, *Mirror check*, and so on. |
| **Test-out fast track** | Tap ⋯ → *I already know this*. Answer a harder confirmation question correctly to skip the lesson. |
| **Review later** | Tap ⋯ → *Review later*. The topic goes into Daily Review and is never silently dropped. |
| **Anti-punishment UI** | A miss shows *"Almost. Here is the rule that changes the answer."* with an illustrated rule card and a similar follow-up question. A second miss assigns the key part of the clip, or a reaction drill. Lane never says "failed". |
| **Live readiness meter** | 0–100 in the header: *Needs Foundation → Developing → Permit Test Ready → Highway Confident*. |
| **Daily Review** | Spaced repetition ranked by priority P. It mixes review-later, skipped, missed, today's, yesterday's and two-days-ago topics, and is capped at 6 a day. |
| **Roadside Emergency (SOS)** | One-tap 911 plus step-by-step protocols for collisions, police stops, breakdowns and bad weather, with California Vehicle Code notes. Bundled, so it works offline. |
| **Road Board** | Anonymous local hazard reports and test tips with upvotes. Moderation blocks profanity, phone numbers, emails, plates, links and unsafe-driving content, and auto-hides a post after 3 reports. Rate limit: 5 posts/hour. |
| **Privacy & Terms** | Required on first launch, including a zero-distraction "never while driving" promise. You can opt out of analytics and delete all your data. |
| **PWA** | Installable and standalone, with dark theme `#0B132B`. It precaches the app shell and curriculum, serves the last-known API data when offline, and queues answers in an outbox that syncs on reconnect. |

## Directory structure

```
lane-driver-pwa-mvp/
├── CLAUDE_CODE_PROMPT.md          # The master build prompt
├── shared/                        # Pure TypeScript used by both server and client
│   ├── algorithm.ts               # The 4 component formulas, mastery, priority P, readiness, review queue
│   ├── scoring.ts                 # Maps one card interaction onto the formulas (server truth = offline estimate)
│   ├── curriculum.ts              # 19 lessons (one per Drive clip), questions, QTE configs, emergency checklist
│   └── moderation.ts              # Community post safety filter
├── server/
│   ├── index.ts                   # Express: /api/trpc, /videos, Vite middleware (dev) or static (prod)
│   ├── trpc.ts                    # Context + anonymous learner procedure
│   ├── routers.ts                 # curriculum, progress, learning, community, privacy
│   ├── learning.ts                # Records interactions, builds progress/readiness/review/feed order
│   ├── db.ts                      # SQLite + Drizzle helpers, community board, data deletion, seed posts
│   ├── algorithm.test.ts          # Every formula, band, and worked example
│   └── curriculum.test.ts         # Curriculum integrity, moderation, and router integration tests
├── drizzle/
│   ├── schema.ts                  # learners, topic_mastery, learning_events, hazard_posts, votes, reports
│   └── migrations/                # Generated SQL (pnpm db:generate)
└── client/
    ├── index.html
    ├── public/manifest.json, icons/
    └── src/
        ├── pages/Home.tsx                 # App shell: feed, review, SOS, board, you + readiness meter
        └── components/
            ├── LessonFeedCard.tsx         # Card state machine: question → correction/confirm → outcome
            ├── LessonVideo.tsx            # Self-hosted <video> with V/K tracking, or Drive embed
            ├── QTEPlayer.tsx              # Timed hazard reaction with top-down scene
            ├── QuestionPanel.tsx          # Multiple choice / fill in the blank
            ├── ReadinessMeter.tsx, ProgressPanel.tsx
            ├── HazardBoard.tsx, EmergencyChecklistView.tsx, LegalModal.tsx
            └── ui/                        # shadcn-style Button, Card, Badge, Dialog, DropdownMenu, Input, Textarea, Sonner
```

Stack: React 19, TypeScript, Tailwind CSS v4, shadcn/ui-style Radix components, Express 5, tRPC 11, Drizzle ORM (SQLite via better-sqlite3), vite-plugin-pwa (Workbox) and Vitest.

## Lesson videos

Each lesson points at one clip in the team's Google Drive folder by `driveFileId`. The player picks a source per lesson:

1. **Self-hosted: `client/public/videos/<lessonId>.mp4`** *(recommended)*. Lane plays the file in a native `<video>` element. It measures exactly which seconds were played, for V (completion) and K (key segment), and seeking past the rule doesn't count. These files also work in the installed app.
2. **Drive embed (fallback).** If that file is missing, the card embeds `drive.google.com/file/d/<id>/preview`. The Drive folder must be shared as *Anyone with the link → Viewer*. Drive's player has no progress API, so attention is **estimated** from time on the card after the learner taps into the player (assuming about 45 s per clip). The clip needs a connection.

To self-host, download each clip from Drive and save it under the lesson id:

| File | Drive clip |
|---|---|
| `lesson-01.mp4` | Scanning Ahead for Lane-End Warnings |
| `lesson-02.mp4` | After a Collision: California's Required Next Steps |
| `lesson-03.mp4` | Build a California-Ready Vehicle Emergency Kit |
| `lesson-04.mp4` | Stopping Safely Before a Front Curb |
| `lesson-05.mp4` | What to Do at a Nonworking Traffic Light |
| `lesson-06.mp4` | Pull Right and Stop for Approaching Emergency Vehicles |
| `lesson-07.mp4` | Emergency Vehicles: California's Right-Edge Yield Rule |
| `lesson-08.mp4` | Right-of-Way: Who Goes First at Intersections? |
| `lesson-09.mp4` | High-Beam Choices: Dark Roads, Rain, and Fog |
| `lesson-10.mp4` | Passing a Bicyclist Safely: Give 3 Feet |
| `lesson-11.mp4` | Entering a California Freeway Safely |
| `lesson-12.mp4` | Freeway Merging: Match Speed, Check, Signal, and Yield |
| `lesson-13.mp4` | Drive-Test Readiness: Scan, Space, and Core Maneuvers |
| `lesson-14.mp4` | Blind-Spot Checks: Look Over Both Shoulders |
| `lesson-15.mp4` | Slow Down for Blind Curves and Parked Cars |
| `lesson-16.mp4` | Blind Bends and Parked Cars: Poor-Visibility Driving |
| `lesson-17.mp4` | Making Space for a Trailer-Towing Vehicle Merging |
| `lesson-18.mp4` | Why More Speed Requires More Stopping Space |
| `lesson-19.mp4` | Use the Three-Second Following-Distance Check |

**Key segment.** Set `keyTimestampSeconds` on a lesson to mark where the tested rule appears in its clip. Until then, the middle 40–60% of the clip is treated as the key part.

## The self-learning algorithm

All component scores are normalized to 0–1. The weights live in one place (`WEIGHTS` in `shared/algorithm.ts`) and are shown to learners on the *You* tab.

```
A = 0.60·C1 + 0.25·C2 + 0.15·C3                   accuracy
W = 0.40·Q + 0.30·R + 0.20·I + 0.10·H             work (renormalized over assigned parts)
N = 0.50·V + 0.30·K + 0.20·E                      attention
T = 1.00 | 0.70 | 0.45 | 0.75 | 0.55 by r = t/b  time quality (b = 25 s default)
M = 0.55·A + 0.15·W + 0.20·N + 0.10·T             session mastery
mastery ← 0.70·mastery + 0.30·M                   smoothing (self-learning update)
P = 0.50·(1−M) + 0.20·min(D/7,1) + 0.20·min(X/3,1) + 0.10·S   feed / review priority
Readiness = average(topic mastery) × 100
```

The server computes the authoritative score. The client runs the same code (`shared/scoring.ts`) only to show an estimate while offline.

### How the spec maps onto the app

These are the interpretation choices where the spec left room:

- **C2, the follow-up answer,** is the similar correction question after a miss, or the optional harder "Lock it in" confirmation after a correct answer. With no follow-up, C2 = 0. This matches the spec's "correct immediately, no history → A = 0.675", so one lucky answer can't reach strong mastery. *The uploaded `algorithm.ts` defaulted C2 to C1, which gives A = 0.925 for that case; that was changed to follow the spec.*
- **C3, review history,** is the share of earlier first answers and confirmation answers on the topic that were correct. It defaults to 0.5 with no history.
- **Test-out pass:** answering the harder question correctly counts as both C1 and C2. A miss falls through to the normal correction path.
- **Work:** R is assigned only after a miss. I is assigned for QTE lessons and for the second-miss activity. Unassigned parts drop out of the denominator, as the spec says.
- **QTE time:** b = half the reaction window, so a 1–4 s reaction on a 4 s hazard scores T = 1.
- **Engagement E** is 1 for reacting to a QTE in time and 0 for a timeout. Otherwise it falls back to the uploaded engine's default.
- **Review mode** is question-first, so earlier clip exposure carries into N.
- **Routing:** a first miss leads to correction plus a similar question. A second miss assigns the key segment or a reaction drill. A correct answer whose provisional M is under 0.60 (for example, rushed with the clip unwatched) is nudged toward the harder confirmation.
- **Skips (X)** count *Review later*, plus scrolling past an unanswered card after ≥3 s on screen. Switching tabs or backgrounding the app doesn't count.
- **Readiness** keeps the uploaded engine's extra rule: *Highway Confident* also needs ≥80% of topics at 70%+.

### Spec errata

The formulas are implemented exactly as written. Several worked examples in the spec have arithmetic slips; the tests assert the formula's true values:

| Example | Spec says | Formula gives | Effect |
|---|---|---|---|
| A — already knows the topic | M = 0.69125 | **0.73125** | still *developing* |
| B — watched, missed, corrected | M = 0.61875 | **0.59875** | *needs support* (just under 0.60), not *developing* |
| C — skipped and guessed | M = 0.20225 | **0.22625** | still *instruction needed* |
| Priority, Topic 1 | P ≈ 0.54 | **0.5202** | ranking unchanged |
| Priority, Topic 2 | P ≈ 0.27 | **0.3164** | ranking unchanged |

Example C also lists N = 0.40 for 20% video with no key segment, but N can be at most 0.30 in that case.

## Product guardrails

- Copy never says "wrong" or "failed". The mastery bands are routing instructions, shown as *Locked in / Solid progress / Getting there / Let's rebuild this one*.
- The feed comes in sets of 6 with an explicit stopping point. Daily Review is capped at 6 topics a day, and topics already reviewed today are excluded.
- Video completion can never stand in for a correct answer: accuracy is 55% of M.
- Safety-critical lessons (`requiresKnowledgeCheck`) count as complete only after a correct answer.
- Learners are anonymous: a random device UUID, with no name, email, school or location. Turning off analytics stops (and deletes) the per-question event log; core progress still saves. *Delete my data* removes everything, including posts and votes.

## Database

SQLite through Drizzle (`drizzle/schema.ts`). After editing the schema, run `pnpm db:generate` to create a migration. To move to MySQL/TiDB, port the schema to `drizzle-orm/mysql-core`, switch the driver in `server/db.ts`, and change `dialect` in `drizzle.config.ts`. The query helpers use portable Drizzle APIs.

## Before publishing

- Have a driving instructor check each lesson, and every Vehicle Code reference, against the current *California Driver's Handbook*.
- Confirm the Drive folder's sharing setting, or self-host the clips.
- Set `keyTimestampSeconds` for each clip.
