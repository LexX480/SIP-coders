# SaajhaRahat — Frontend (React + Vite + Tailwind)

Phase 2 of the build. Matches the Stitch prototype's exact design system
(colors, type scale, spacing) and wires every screen to the backend API
from Phase 1.

## 1. Prerequisites

- Node.js 18+ (same as the backend)
- The backend running (`npm run dev` inside `backend/`, listening on
  `http://localhost:5000`) — this app calls that API directly.

## 2. Setup

```bash
cd frontend
npm install
cp .env.example .env
```

Open `.env` — the default (`VITE_API_URL=http://localhost:5000/api`) is
correct if you're running the backend locally on its default port. Only
change it if your backend runs somewhere else.

## 3. Run it

```bash
npm run dev
```

Vite will print a local URL (usually `http://localhost:5173`). Open it in
your browser.

## 4. Try the full flow

1. Go to `/` (Landing) → click **Join as a Responder**
2. Register a new organization (or sign in with the seeded demo account:
   `demo-responder@saajharahat.test` / `Password123!`)
3. From Responder Home, click **Log a Distribution** → walk through
   Resource → Location (click the map to drop a pin) → Confirm
4. Go to **My Distributions** to see it listed
5. Go to **Public Transparency** (link in the nav) to see it on the public
   map/list
6. Go back to `/` and click **Government / Ward Committee login** at the
   bottom → sign in with the seeded demo account:
   `demo-coord@saajharahat.test` / `Password123!` (role: Ward Disaster
   Committee)
7. On the Coordination Dashboard you'll see stat cards + the priority-ranked
   ward list + a map
8. Log a *second* distribution of the same resource type in the same ward
   from a different org account to trigger a duplication alert, then check
   **Duplication Alerts** in the coordination nav → open it → **Confirm
   Duplicate** or **Dismiss Alert**
9. Check **Analytics** for the two chart cards

## 5. Screen map (matches the Stitch prompt batches)

| # | Screen | Route | File |
|---|---|---|---|
| 1 | Landing | `/` | `src/pages/Landing.jsx` |
| 2 | Responder login/signup | `/responder/auth` | `src/pages/ResponderAuth.jsx` |
| 3 | Responder home | `/responder/home` | `src/pages/ResponderHome.jsx` |
| 4 | Log a distribution | `/responder/log` | `src/pages/LogDistribution.jsx` |
| 5 | My Distributions | `/responder/distributions` | `src/pages/MyDistributions.jsx` |
| 6 | Report a need | `/needs/report` | `src/pages/ReportNeed.jsx` |
| 7 | Public transparency dashboard | `/transparency` | `src/pages/PublicTransparency.jsx` |
| 8 | Coordination login | `/coordination/login` | `src/pages/CoordinationLogin.jsx` |
| 9 | Coordination dashboard | `/coordination/dashboard` | `src/pages/CoordinationDashboard.jsx` |
| — | Duplication alerts list | `/coordination/alerts` | `src/pages/DuplicationAlerts.jsx` |
| 10 | Duplication alert detail | `/coordination/alerts/:id` | `src/pages/DuplicationAlertDetail.jsx` |
| 11 | Analytics | `/coordination/analytics` | `src/pages/Analytics.jsx` |

(The alerts list page isn't a numbered screen in your Stitch prompt, but the
prototype's own coordination nav links to "Duplication Alerts" as a list, so
I added it as the natural path into screen 10.)

## 6. Design system fidelity

`tailwind.config.js` contains the *exact* token values pulled out of your
Stitch prototype's `<script id="tailwind-config">` block — I checked all 16
generated screens and confirmed they share one identical config, so this
isn't a re-creation, it's the same source values. Fonts (Space Grotesk /
Inter), the Material Symbols icon set, and the vermilion/indigo accent split
between the responder and coordination sides all match the prototype
directly.

## 7. What I verified vs. what you should verify

I confirmed in this environment:
- `npm install` completes cleanly (195 packages)
- `npm run build` compiles all 22 source files with zero errors
- The dev server boots and serves pages with valid 200 responses

I could **not** fully click through the running app end-to-end against a
live browser in this sandbox. Please run through the flow in Section 4
yourself and tell me about anything that looks wrong (a map that doesn't
load, a style mismatch, an API call that fails) — that's exactly the kind
of thing I can fix quickly once you show me.

## 8. Known limitations / things to improve later

- **Ward matching** on the map pickers snaps to the *nearest ward centroid*
  by straight-line distance, since we don't have real ward boundary polygons
  yet. Fine for the MVP/demo; swap in real GeoJSON boundaries later for
  accuracy.
- **Bundle size warning** (`806 kB` main chunk) — harmless for a school/demo
  project; if you want, I can split Leaflet/Recharts into separate chunks
  later with `build.rollupOptions.output.manualChunks`.
- The duplication/allocation logic is still the rule-based MVP version from
  the backend (see backend README Section 7) — the frontend will work
  unchanged once you swap that for the real notebook-trained models.

## What's next

Phase 3, per your proposal: prototype the real duplication-detection
(DBSCAN-style) and allocation-scoring models in a Jupyter notebook
(pandas, scikit-learn) against simulated/historical data, then decide how to
integrate them — as a small Python microservice the Node backend calls, or
reimplemented in Node once validated. Let me know when you're ready and
I'll help set that up too.
