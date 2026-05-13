# CLAUDE.md

Guidance for Claude (or other AI assistants) working in this repository. Read this first before making changes.

## What this project is

**Hollywood Interview Engine** is a JSON-driven, drop-in React component for candidate self-screening on quadrant-style fit assessments. The component itself is instrument-agnostic — every assessment is fully defined by a JSON document under `instruments/`.

The v1 instrument is **vintage-mechanic-v1** (ID retained for stability; the shop actually works on modern sports cars and exotics): a 24-item Myers-Briggs-style self-screen for hiring mechanics at a modern sports car and exotics shop. The user (Kelly, owner of Axacraft / founder of Teligant) commissioned this after a call with his mechanic about the difficulty of hiring help who can reason from physics on cars no service manual covers.

Future instruments will likely include screens for telehealth provider intake (Teligant / Zaya / HedFirst) and other domains the user's digital agency serves. **The architecture is built to support that without code changes.**

## Architectural principle: JSON is the source of truth

The React code never references a question by ID, an axis by name, or a quadrant by hardcoded position. Everything flows from the instrument JSON:

- `instrument.axes[]` — exactly two, X then Y
- `instrument.quadrants[]` — typically four, addressed by `(x: high|low, y: high|low)`
- `instrument.groups[]` — ordered sections, each with `questions[]`
- `question.options[].axis` and `option.score` (-1 or +1) — the scoring key

Schema reference: `instruments/SCHEMA.md`. The schema is intentionally extensible — adding new question types (`likert-5`, `scenario`, `slider`) should be additive, not breaking.

**Hard rule:** never hardcode item content, axis labels, or quadrant copy in the React components. If you find yourself wanting to, add a field to the schema instead.

## File map

```
hollywood-interview-engine/
├── instruments/
│   ├── SCHEMA.md                    ← Read this before editing instrument JSON
│   └── vintage-mechanic-v1.json     ← v1 instrument; bump `version` on edits
├── src/
│   ├── MechanicAssessment.jsx       ← Main component; orchestrates stages
│   ├── BrochureIntro.jsx            ← Marketing-style landing (renders from JSON)
│   ├── SubmissionsView.jsx          ← Hiring-authority admin view (?submissions=1)
│   ├── QuadrantChart.jsx            ← SVG quadrant plot
│   ├── scoring.js                   ← Pure scoring functions; usable server-side
│   ├── styles.css                   ← Scoped .via-* CSS; CSS custom properties for theming
│   └── main.jsx                     ← Demo bootstrap only — NOT shipped to integrators
├── server/
│   └── dev-api.mjs                  ← Vite middleware: /api/leads, /api/submissions, /api/admin
├── api/
│   └── submit.example.js            ← Reference Express endpoint for prod
├── scripts/
│   └── check.mjs                    ← Sanity checks; run via `npm run check`
├── data/
│   └── submissions.json             ← Auto-created by dev-api on first submission
├── index.html                       ← Marketing landing page (front-of-funnel)
├── app.html                         ← Vite SPA entrypoint (the quiz; loads src/main.jsx)
├── images/                          ← Photo slots referenced by index.html
├── package.json                     ← Exposes component, scoring, instrument, styles as exports
└── vite.config.js                   ← Registers devApiPlugin; multi-entry rollupOptions
```

## Commands

```bash
npm install
npm run dev          # Vite dev server, localhost:5173. Append ?admin=1 for admin view.
npm run build        # Production bundle into dist/. Last clean build: 165 KB JS, 6.4 KB CSS.
npm run check        # Structural + scoring sanity checks. MUST pass before committing.
```

`npm run check` asserts the four canonical response sets (all-low, all-high, mixed→tinkerer, mixed→master-technician) each route to the correct quadrant, plus schema invariants (brochure.hero set, every quadrant has postResultMessage, leadCapture.mode is pre-test). Add a case here whenever you add a new instrument or question type.

## Candidate flow

```
Brochure intro  →  Email gate  →  Questions (24)  →  Result + fit-tiered CTA
   (marketing)     (POST /leads)  (one at a time)    (POST /submissions/:id)
```

The flow is **email-gate-first** by design — the candidate's contact info is captured before the test starts so retakes can be detected and abandoned attempts are still recorded. The dev API tracks `attemptNumber` per email per instrument.

## API contract

Three endpoints, swappable for any production backend:

| Method | Path | In | Out |
|--------|------|----|-----|
| POST | `/api/leads` | `{ instrumentId, instrumentVersion, email, name, phone?, experienceYears? }` | `{ ok, sessionId, attemptNumber }` |
| POST | `/api/submissions/:sessionId` | `{ responses, axisScores, quadrantId, borderline, completedAt }` | `{ ok, message? }` |
| GET  | `/api/admin/submissions?token=...` | — | `{ ok, submissions: [...] }` |

Dev implementation is in `server/dev-api.mjs` (Vite middleware, JSON file storage). Production users override via `leadEndpoint` / `submissionEndpoint` props or `onLeadCapture` / `onSubmit` callbacks. Don't add server dependencies to the React component itself.

## Conventions

**CSS class names** are all prefixed `via-` (Vintage Interview Assessment) to avoid collisions with host sites. Don't add unprefixed classes. Theming hooks are exposed as CSS custom properties on `.via-root` — integrators override colors by setting those, not by editing rules.

**The component is a library, not an app.** `src/main.jsx` is only for the demo. The shipped surface is `MechanicAssessment.jsx`, `scoring.js`, the instrument JSON files, and `styles.css`. Don't add app-level dependencies (routing, state libraries, etc.) to those files.

**Versioning rule:** bump `instrument.version` on every item-content change so downstream submissions stay comparable only within a version. Don't reuse IDs.

**Scoring is pure.** `src/scoring.js` has no React, no DOM, no fetch. Keep it that way so it can run server-side too (validating submissions, recomputing scores from raw responses).

## The two axes (vintage-mechanic-v1)

- **X — Cognitive Style:** Procedural (-1) ↔ Exploratory (+1). Adapted from Need for Cognition and CEI-II.
- **Y — Motivation Source:** Task-driven (-1) ↔ Mastery-driven (+1). Adapted from Self-Determination Theory's intrinsic motivation construct.

Quadrants:
- (high, high) `vintage-specialist` — **ideal fit**
- (low, high) `master-technician` — secondary
- (high, low) `tinkerer` — weak
- (low, low) `service-mechanic` — exclude

The user explicitly wants to filter out the bottom-left quadrant (dealer-mechanic profile) and find the top-right.

## Question type roadmap

v1 ships `forced-choice` only. Forced choice was deliberate — it reduces social-desirability faking, which matters for a candidate-facing instrument. Likely future additions:

1. **`likert-5`** — five-point scale, score `-2..+2`. Useful when forced choice feels artificial.
2. **`scenario`** — paragraph stem with 3–4 options, varied scores. Best for behavioral prediction. The instrument JSON already conceptually supports this (just more than 2 options per item) but the renderer needs a branch.
3. **`slider`** — continuous -1 to +1. Avoid for hiring; better for self-discovery contexts.

When adding a type, the change is: (1) extend the renderer's switch on `question.type`, (2) confirm `scoring.js` handles the option count without assumption, (3) add a check case to `scripts/check.mjs`.

## Lead capture / submission flow

Hybrid by design: candidate sees their quadrant result first, then is offered an optional lead-capture form. Configured via `instrument.leadCapture` (mode: `pre-result` | `post-result` | `gated`). Submission payload shape is documented in README.md.

Downstream routing is the integrator's responsibility — `api/submit.example.js` shows the switch pattern (`vintage-specialist` → notify hiring, `master-technician` → nurture list, etc.).

## User context

Kelly's preferences (from session profile):
- Wants technical detail and jargon — don't soften.
- Wants trade-offs explicit, with pros/cons or key considerations.
- Wants concise, actionable advice (bullets/frameworks > prose walls).
- Primary domain is telehealth (Teligant, Zaya, HedFirst). This screening engine is a side project for his mechanic, who works at a shop on modern sports cars and exotics, but **the architecture should generalize** — he may use it for other roles.

## Things to be careful about

- **Don't break instrument backward-compat without a version bump.** If a field semantics changes, the JSON `version` must change too.
- **Don't add server dependencies to the component.** It must remain a drop-in for any React/Next.js host site.
- **Don't hardcode the modern-sports-cars-and-exotics theme into the component.** Colors and copy should be themeable; the only domain-specific thing in the React code is the component name (`MechanicAssessment`), which is a v1 naming concession — renaming to a generic `QuadrantAssessment` is a reasonable future refactor.
- **Item wording is a stakeholder decision, not a Claude decision.** Don't rewrite items without an explicit ask. Validity comes from items written in the practitioner's voice, not the model's.
