# Hollywood Interview Engine

A JSON-driven, drop-in React component for candidate self-screening on quadrant-style fit assessments. The v1 instrument is **Vintage Mechanic Fit** — a Myers-Briggs-style 24-item self-screen for shops that need mechanics who can reason from physics on cars no manual covers.

## What's in the box

```
hollywood-interview-engine/
├── instruments/
│   ├── SCHEMA.md                       Schema reference for instrument JSON
│   └── vintage-mechanic-v1.json        The v1 instrument (24 items, 4 groups)
├── src/
│   ├── MechanicAssessment.jsx          Main React component
│   ├── BrochureIntro.jsx               Marketing-style landing
│   ├── SubmissionsView.jsx             Admin view of all submissions
│   ├── QuadrantChart.jsx               SVG quadrant viz
│   ├── scoring.js                      Pure scoring functions
│   ├── styles.css                      Scoped .via-* styles
│   └── main.jsx                        Demo bootstrap
├── server/
│   └── dev-api.mjs                     Vite middleware: lead/submission endpoints
├── api/
│   └── submit.example.js               Reference Express endpoint (for prod)
├── scripts/
│   └── check.mjs                       Sanity check runner
├── data/
│   └── submissions.json                Auto-created on first submission (dev only)
├── index.html                          Marketing landing page (front-of-funnel)
├── app.html                            Vite SPA entrypoint (the quiz)
├── images/                             Photo slots referenced by index.html
├── package.json
└── vite.config.js
```

## Candidate flow

```
Brochure intro  →  Email gate  →  Questions (24)  →  Result + fit-tiered CTA
   (marketing)     (POST /leads)  (one at a time)    (POST /submissions/:id)
```

1. **Brochure intro** — Renders the four archetypes upfront ("Are you a Tinkerer, Service Mechanic, Master Technician, or Hollywood Mechanic?"). Curiosity hook before the ask.
2. **Email gate** — Collects name, email, phone, experience. POSTs to `/api/leads`, receives `{ sessionId, attemptNumber }`. The lead is now in your database even if the candidate abandons.
3. **Questions** — One forced-choice item at a time with progress bar. Grouped into 4 sections (problem approach, motivation, off-the-clock, in-the-shop scenarios).
4. **Result** — Quadrant chart + axis breakdown + fit-tiered post-result message. Submission PATCHed to `/api/submissions/:sessionId`.

## Running the demo

```bash
npm install
npm run dev          # opens http://localhost:5173
npm run check        # runs scoring sanity checks
```

Demo URLs:

- `http://localhost:5173/` — marketing landing page (front of funnel)
- `http://localhost:5173/app.html` — candidate flow (the assessment itself)
- `http://localhost:5173/app.html?admin=1` — instrument preview (every question with scoring keys)
- `http://localhost:5173/app.html?submissions=1` — hiring authority view; gated by PIN (default `dev-admin-token`; set `ADMIN_TOKEN` env var to override)

## Where the hiring authority sees results

> Owner-facing instruction manual: **[docs/SUBMISSIONS-ADMIN.md](docs/SUBMISSIONS-ADMIN.md)** — how the shop owner signs in with a PIN, reads submissions, exports CSV, etc. Read that if you're the one setting up the deploy or training the owner.

The dev API stores everything in `data/submissions.json`. Open the submissions admin view (link above) to see:

- All leads (one row per attempt; same email across attempts is flagged)
- Quadrant fit with color-coded rows (Ideal Fit row is highlighted in red)
- Axis scores (-1 to +1 on each axis)
- Started/Completed timestamps (incomplete = candidate abandoned)
- CSV export for handing to a hiring manager

For production, swap the dev API for your real backend by reimplementing three endpoints:

| Method | Path | In | Out |
|--------|------|----|-----|
| POST | `/api/leads` | `{ instrumentId, instrumentVersion, email, name, phone?, experienceYears? }` | `{ ok, sessionId, attemptNumber }` |
| POST | `/api/submissions/:sessionId` | `{ responses, axisScores, quadrantId, borderline, completedAt }` | `{ ok, message? }` |
| GET  | `/api/admin/submissions?token=...` | — | `{ ok, submissions: [...] }` |

Suggested production backends:

- **Supabase** — Postgres + auth + admin UI in one. ~30 min to wire up. Best long-term.
- **Airtable** — Fastest path. Submissions become spreadsheet rows. Limited query power.
- **Your existing Postgres** — If you already have backend infrastructure (Teligant stack, etc.), drop in a new table and reuse your ops.

## Integrating into your own site

```jsx
import MechanicAssessment from 'hollywood-interview-engine';
import instrument from 'hollywood-interview-engine/instruments/vintage-mechanic-v1';
import 'hollywood-interview-engine/styles.css';

export default function HirePage() {
  return (
    <MechanicAssessment
      instrument={instrument}
      branding={{ companyName: 'Your Shop Name' }}
      leadEndpoint="https://api.yourshop.com/mechanic-assessment/leads"
      submissionEndpoint="https://api.yourshop.com/mechanic-assessment/submissions/:sessionId"
    />
  );
}
```

Or override fetch with your own functions:

```jsx
<MechanicAssessment
  instrument={instrument}
  onLeadCapture={async (lead) => {
    // call your own service; must return { ok, sessionId, attemptNumber }
    return await api.createLead(lead);
  }}
  onSubmit={async (sessionId, results) => {
    return await api.completeAssessment(sessionId, results);
  }}
/>
```

## Component props

| Prop                 | Type     | Description |
|----------------------|----------|-------------|
| `instrument`         | object   | Parsed instrument JSON. Required unless `instrumentUrl` is given. |
| `instrumentUrl`      | string   | Fetch instrument JSON from this URL on mount. |
| `leadEndpoint`       | string   | URL to POST lead capture. Default `/api/leads`. |
| `submissionEndpoint` | string   | URL template for result POST, with `:sessionId` placeholder. Default `/api/submissions/:sessionId`. |
| `onLeadCapture`      | async fn | Override the lead POST. Returns `{ ok, sessionId, attemptNumber, message? }`. |
| `onSubmit`           | async fn | Override the result POST. Takes `(sessionId, payload)`. Returns `{ ok, message? }`. |
| `adminMode`          | boolean  | Render instrument preview at this URL. |
| `submissionsMode`    | boolean  | Render the hiring authority's submissions table. |
| `adminToken`         | string   | Token sent to `/api/admin/submissions` when in submissions mode. |
| `branding`           | object   | `{ companyName, logoUrl }`. Surfaces shop branding. |

## Submission payload shapes

**Lead capture (Phase 1, when email is entered):**

```jsonc
{
  "instrumentId": "vintage-mechanic-v1",
  "instrumentVersion": 1,
  "email": "jane@example.com",
  "name": "Jane Doe",
  "phone": "+1 555 123 4567",
  "experienceYears": "12"
}
```

**Result (Phase 2, when test is completed):**

```jsonc
{
  "responses": { "c1": 1, "c2": 0, /* ... */ },
  "axisScores": { "curiosity": 0.83, "mastery": 0.67 },
  "quadrantId": "vintage-specialist",
  "borderline": false,
  "completedAt": "2026-05-13T18:00:00.000Z"
}
```

The dev API stores both phases in a single row keyed by `sessionId`, so the hiring authority sees the full record (lead + result) when complete, or just the lead when abandoned.

## Iterating on the instrument

Item wording is the most important driver of validity. Recommended workflow:

1. Run `?admin=1` and review every prompt + scoring key with a stakeholder who knows the trade.
2. Edit `instruments/vintage-mechanic-v1.json` directly.
3. Bump `version` whenever items change so downstream submissions are comparable only within a version.
4. Re-run `npm run check` — it asserts the four canonical response sets land in the correct quadrants.

When you have ~50 real submissions, plot the distribution per item and look for items that everybody answers the same way (low discrimination) or correlate weakly with their axis (low item-total correlation). Replace those first.

## Adding new instruments

Add a new JSON file in `instruments/` following the schema in `SCHEMA.md`. Common variations:

- **Service writer / customer-facing** — *Conflict tolerance* × *Detail orientation*
- **Telehealth provider intake** — *Clinical rigor* × *Patient empathy*

The schema supports `forced-choice` (v1), and is extensible to `likert-5`, `scenario`, `slider` without component refactors.

## Validity notes

Items are adapted from validated scales (Need for Cognition, CEI-II, Self-Determination Theory). The composite is **not independently validated**. Treat results as one input among many in your hiring process.
