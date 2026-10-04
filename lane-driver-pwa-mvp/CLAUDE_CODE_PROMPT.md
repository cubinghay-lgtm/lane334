# Lane — Master Build Prompt

You are a senior full-stack engineer and design lead building "Lane", a Progressive Web App (PWA) created for the Congressional App Challenge to help teenage drivers pass the California DMV permit test and build real-world defensive driving habits.

## 1. Product Vision & Core Experience

Lane reimagines the fast, satisfying feeling of vertical social scrolling (like Instagram Reels or TikTok) into a self-learning driver education platform. Instead of passive mindless scrolling, every card delivers high-impact safety knowledge:

- **Vertical Feed:** A short driving video or quick-reference card plays/appears.
- **Interactive Question / QTE:** Immediately below the clip or card, the driver interacts:
  - Multiple Choice
  - Fill in the Blank
  - Quick-Time Reaction Event (QTE): at an intersection or blind spot, a real-time hazard appears with a timer (3–5 s) requiring an immediate defensive choice (e.g. Yield to Right, Slow Down, Mirror Check).
- **Test-Out Fast Track:** Users can tap a 3-dots menu to select "I already know this." If they answer a harder confirmation question correctly, they skip the lesson.
- **Spaced Review:** Users can choose "Review later", which queues the rule into the daily spaced repetition cycle.
- **Anti-Punishment UI:** If a user struggles or scores under 60%, the app never says "You failed." Instead it says: "Almost. Here is the rule that changes the answer," reveals an illustrated explanation, and provides a similar follow-up question.
- **Live Driver Readiness Meter:** A real-time score (0–100%) showing how DMV Permit Test Ready and Highway Confident the driver is.
- **Roadside Emergency Checklist:** Immediate 1-tap protocols for traffic accidents, police traffic stops, and freeway breakdowns with California Vehicle Code tips.
- **Community Road Hazard & Test Tip Board:** Local student drivers share real-world road risks (e.g., Novato Blvd overgrown hedges, tight freeway on-ramps) with upvotes and safety moderation.
- **Privacy & Terms of Service:** Modal ensuring compliance with student privacy and non-distracted driving rules.

## 2. The 4-Part Self-Learning Algorithm Specification

1. **Accuracy Score (A):** `A = 0.60*C1 + 0.25*C2 + 0.15*C3` — C1 = first-answer correctness [0 or 1], C2 = correction correctness [0 or 1], C3 = historical review rate [0.0 to 1.0, default 0.5].
2. **Work Score (W):** `W = 0.40*Q + 0.30*R + 0.20*I + 0.10*H` — Q = question submitted, R = retry completed, I = interactive QTE completed, H = help opened.
3. **Attention Score (N):** `N = 0.50*V + 0.30*K + 0.20*E` — V = video completion ratio [0 to 1], K = key timestamp watched [0 or 1], E = purposeful actions [0 to 1].
4. **Time-Quality Score (T):** ratio `r = active_seconds / expected_benchmark` (default 25 s)
   - 0.50 ≤ r ≤ 2.00 → T = 1.00 (healthy deliberative pace)
   - 0.25 ≤ r < 0.50 → T = 0.70
   - r < 0.25 → T = 0.45 (rushed/guessing)
   - 2.00 < r ≤ 4.00 → T = 0.75
   - r > 4.00 → T = 0.55 (stall/struggle)

**Combined Session Mastery (M):** `M = 0.55*A + 0.15*W + 0.20*N + 0.10*T`
**Smoothed Mastery:** `new_mastery = 0.70 * prior_mastery + 0.30 * M`

**Feed / Review Priority Score (P):** `P = 0.50*(1 - M) + 0.20*min(D/7, 1) + 0.20*min(X/3, 1) + 0.10*S` (D = days since practice, X = skip count, S = safety weight [0.50 to 1.00])

**Readiness Meter:** Score = average(mastery of all curriculum topics) × 100. Status: <50 "Needs Foundation", 50–69 "Developing", 70–84 "Permit Test Ready", 85+ "Highway Confident".

## 3. Architecture & Tech Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS (v4) + shadcn/ui components (Sonner for toasts, Dialog, DropdownMenu, Badge, Button, Input, Textarea, Card).
- **Backend / API:** Node.js + Express + tRPC (type-safe contracts) + Drizzle ORM (MySQL / TiDB / SQLite).
- **PWA Features:** `manifest.json` configured for standalone mobile mode, dark mode theme (#0B132B), touch-friendly gestures, and snap vertical scrolling.

## 4. Implementation Steps

1. Review the existing project structure under `lane-driver-pwa-mvp/`.
2. Inspect `shared/algorithm.ts` to see the complete mathematical implementation of all four formulas and the readiness meter.
3. Review `shared/curriculum.ts` for seeded California handbook lessons, QTE configurations, and emergency checklists.
4. Review `server/routers.ts` for curriculum, interaction recording, and community hazard queries.
5. Review `client/src/pages/Home.tsx` and components (`LessonFeedCard.tsx`, `QTEPlayer.tsx`, `HazardBoard.tsx`, `EmergencyChecklistView.tsx`, `LegalModal.tsx`).
6. Polish the styling, add smooth video embeds, and ensure the offline PWA caching service worker is enabled.

## Product guardrails (from the algorithm design doc)

- Never call a learner a failure.
- Never make time spent the main measure of learning.
- Never allow video completion to substitute for a correct answer.
- Do not create an infinite-scroll loop that rewards compulsive use; cap daily review length and let the learner stop.
- For safety-critical driving rules, a curriculum author should be able to mark a topic as high S and require a minimum knowledge check before completion.
- Store only the behavior needed to improve learning, with clear privacy controls and an opt-out for analytics beyond core progress tracking.
