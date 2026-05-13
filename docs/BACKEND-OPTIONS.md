# Backend options — review document

Read this with the client. By the end you should be able to circle one of the
options at the bottom and we'll wire it up.

> **Audience:** Kelly (technical) + Micah/shop owner (non-technical). The
> "Owner UX" rows describe what the shop owner's day-to-day looks like under
> each option, so they can react to that without reading the technical detail.

---

## TL;DR

The candidate-facing assessment **already works without any backend** — it's a
static site, and the scoring math runs in the candidate's browser. They take
the test, they see their result.

What's missing is **persistence**: a place to save each completed test so the
shop owner can see who took it and how they scored.

Right now there's a "dev backend" (a small Node.js handler) that only runs on
the developer's laptop. In production, nothing is saving submissions yet.
This document is for choosing what to wire up.

---

## What needs a backend, exactly

Three small URLs. They're the only thing tying the frontend to data.

| Endpoint | When it fires | Why it matters |
|---|---|---|
| `POST /api/leads` | Candidate enters their email and starts the test | Capture even abandoned attempts — we know they tried |
| `POST /api/submissions/:id` | Candidate finishes the test | Save the result so we can see it later |
| `GET /api/admin/submissions` | Owner opens the PIN-gated admin page | Returns the saved data to the dashboard |

Any backend we pick has to do those three things (or replace them with an
equivalent — e.g., emailing the result instead of saving it).

---

## What works without a backend

So the shop owner understands what's not at risk:

- ✅ The marketing landing page
- ✅ Email gate at the start of the assessment
- ✅ All 24 questions, multiple-choice flow
- ✅ Scoring math (which quadrant the candidate falls into)
- ✅ Showing the candidate their archetype + result page
- ✅ The candidate-side CTA after the result

What breaks without a backend:

- ❌ Saving the submission anywhere
- ❌ The admin page (PIN form loads, then errors when it tries to fetch data)
- ❌ Knowing the candidate even took the test, unless they email you afterward

---

## Options at a glance

| | A. Form-to-email | B. Vercel/Netlify Functions | C. Supabase | D. Airtable | E. Existing infra |
|---|---|---|---|---|---|
| **Effort to set up** | ~15 min | ~1 hour | ~½ day | ~1 hour | ~2 hours |
| **Cost / month** | Free → $10 | Free → ~$20 | Free → ~$25 | Free → ~$10/seat | $0 (already pay) |
| **Code changes** | One URL | Three small files | Replace 3 endpoints | Replace 3 endpoints | Replace 3 endpoints |
| **Owner sees results via** | Email inbox | Our PIN-gated admin page | Supabase Studio *or* our page | Airtable spreadsheet | Existing admin or our page |
| **Historical view / search** | ❌ (just emails) | ✅ | ✅ | ✅ | ✅ |
| **CSV export** | ⚠️ Manual | ✅ | ✅ | ✅ Native | ✅ |
| **Filter by fit (ideal / weak / etc.)** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Owner needs to learn a new tool?** | ❌ (email only) | ❌ | ⚠️ Supabase Studio (if using it) | ⚠️ Airtable | ❌ |
| **Grows with us if we add more instruments** | ❌ | ⚠️ Manual | ✅ | ⚠️ Plan limits | Depends |
| **Vendor lock-in** | Medium | Low | Medium | High | None |

---

## Option detail

### A. Form-to-email service (Formspree / Basin / Web3Forms)

**What it is.** A third-party service that takes form submissions and emails
them to you. No code on our side beyond changing one URL.

**Setup.**
1. Sign up at formspree.io (or equivalent) — 5 min.
2. Get a form URL like `https://formspree.io/f/abc123`.
3. We point the assessment's `submissionEndpoint` prop at that URL.
4. Customize the email template (subject line, what fields show).

**Owner UX.**
Each time a candidate finishes the test, Micah gets an email like:

```
Subject: New Hollywood Mechanic submission — vintage-specialist
From: forms@formspree.io

Name: John Doe
Email: john@example.com
Phone: (555) 555-5555
Years exp: 12
Result: Hollywood Mechanic (vintage-specialist)
Curiosity: 0.92
Mastery: 0.83
```

To "review submissions," he just searches his inbox.

**Pros**
- Cheapest possible answer. Free tier covers ~50 submissions/month.
- No infrastructure to maintain.
- Email is the most familiar interface — zero learning curve.
- Can be set up in under 30 minutes.

**Cons**
- The PIN-gated admin page becomes dead UI — we'd either remove it or leave
  it broken with a "no data available" message.
- No way to filter / sort / compare candidates without manually digging
  through emails.
- No CSV export (you can copy/paste from email, manually).
- If an email goes to spam, that candidate is lost.
- "Did I already follow up with this candidate?" → no source of truth.

**When to pick.** Hiring volume is genuinely small (1-10 candidates/month),
the owner just wants notifications, and we're okay revisiting this if it
becomes a problem.

---

### B. Vercel/Netlify serverless functions

**What it is.** Small Node.js handlers that the hosting platform runs
on-demand. The hosting (Vercel/Netlify) already serves the static site;
we just add a few function files alongside.

**Setup.**
1. Pick a storage layer (most likely Vercel Postgres or Vercel KV; ~$20/mo
   on the paid tier, or use a free tier of Neon / PlanetScale / Turso).
2. Write three small JS files: `api/leads.js`, `api/submissions/[id].js`,
   `api/admin/submissions.js`. Reference implementation in
   `api/submit.example.js` already in the repo.
3. Set `ADMIN_TOKEN` environment variable on the hosting dashboard.
4. Deploy.

**Owner UX.**
Exactly the same as today's PIN-gated admin page (described in
[docs/SUBMISSIONS-ADMIN.md](SUBMISSIONS-ADMIN.md)). He goes to
`/app.html?submissions=1`, types his PIN, sees the table.

**Pros**
- Stays on the existing architecture — same 3-endpoint contract.
- The PIN-gated admin page we already built keeps working.
- Hosting and functions are on the same domain — no CORS gymnastics.
- Free tier covers most hiring volume.
- Can migrate to a more sophisticated backend later without rewriting the
  React code.

**Cons**
- Still need a database somewhere — pick Vercel Postgres, Neon, PlanetScale,
  Turso, or similar.
- A few hours of write-deploy-test work.
- Modest vendor lock-in to the chosen hosting (Vercel/Netlify).

**When to pick.** Want the existing admin UI to "just work" without learning
a new tool, and we're not ready for a bigger commitment like Supabase.

---

### C. Supabase

**What it is.** A hosted Postgres database with a generated REST/JS API and
an admin web UI ("Supabase Studio") on top. Used by a lot of small teams as
"backend in a box."

**Setup.**
1. Create a Supabase project (free) — ~10 min.
2. Create a `submissions` table with the right columns.
3. Replace the three `/api/*` endpoints with Supabase client calls in the
   React code — or alternately, keep the existing endpoints and have them
   wrap Supabase.
4. Configure row-level security (RLS): public can insert their own
   submission, only admin role can read all.

**Owner UX — two flavors.**

- **C-1 (recommended):** Owner uses **Supabase Studio** directly. It's a
  web-based spreadsheet view of the table. Built-in filtering, sorting, CSV
  export, full-text search. He bookmarks the Studio URL and logs in with
  Supabase auth (Google sign-in). Our React admin page can be retired.
- **C-2:** Keep our PIN-gated admin page; it queries Supabase under the hood.

**Pros**
- Most "real" answer. Postgres under the hood — query however you want.
- Studio is a genuinely good owner-facing UI without us building it.
- Free tier (500MB DB, 50K monthly users) covers hiring for years.
- If we add more instruments later (telehealth intake, etc.), Supabase scales
  with us — just add more tables.
- Built-in auth means we can ditch the shared-PIN model for real per-user
  login when we want.
- Easy to give a hiring manager read-only access without giving them
  developer powers.

**Cons**
- Half-day setup vs. an hour for the simpler options.
- Owner needs to learn Supabase Studio (~15 min of orientation) if going
  with C-1.
- Slight vendor lock-in (Supabase-specific schema / auth conventions).

**When to pick.** This is going to be more than a one-shot project. We'll
likely use it for multiple instruments. We want a "do this once and don't
revisit for years" answer.

---

### D. Airtable

**What it is.** A hosted spreadsheet that has an API. Each submission becomes
a new row in a base.

**Setup.**
1. Create an Airtable base with the right columns — ~15 min.
2. Get a Personal Access Token from Airtable.
3. Replace the three `/api/*` endpoints with Airtable API calls.
4. Owner gets logged into the base, sees a spreadsheet.

**Owner UX.**
Logs into Airtable, sees rows. Built-in filtering, sorting, multiple views
(grid / Kanban / calendar), CSV export. Familiar spreadsheet model.

**Pros**
- Owner gets a spreadsheet UI without us building one.
- Faster to set up than Supabase.
- Familiar interface for non-technical users.
- Built-in collaboration if you want to give other hiring managers access.

**Cons**
- Per-seat pricing if more than one person needs access (~$10/seat/mo).
- API rate limits are tight — fine for hiring volume, not for high-traffic apps.
- Less flexible than Postgres if requirements grow.
- Higher vendor lock-in than Supabase — leaving Airtable means exporting CSVs
  and rebuilding.

**When to pick.** Owner already uses Airtable, or strongly prefers a
spreadsheet model and we don't expect this to grow beyond a handful of
instruments.

---

### E. Existing infrastructure (Teligant / Axacraft Postgres)

**What it is.** Use the database and hosting Kelly already operates for
Teligant or other projects.

**Setup.**
1. Add a `hollywood_submissions` table to the existing Postgres.
2. Write a new endpoint on the existing app server (or a sibling Express
   service) that responds to the three URLs.
3. Configure CORS so the static hosting can call the API on the other domain.
4. Set `ADMIN_TOKEN` env var.

**Owner UX.**
Same as Option B — the PIN-gated admin page we already built, now reading
from your own infrastructure.

**Pros**
- No new vendor. No new bill.
- Familiar operations / backup story.

**Cons**
- Two unrelated apps now share infrastructure. An outage in Teligant takes
  down the hiring tool too.
- Cross-domain API calls add complexity (CORS configuration).
- Compliance posture of the bigger app applies to this small app too, even
  though it doesn't need to.

**When to pick.** Strong reason to consolidate — e.g., compliance constraints
that make new-vendor onboarding painful, or you want every project on one
backup/monitoring stack.

---

## Decision framework

Five questions to walk through with the client:

1. **How many candidates per month, realistically?**
   - 1-5: Option A is plenty.
   - 5-30: B or C.
   - 30+: C.

2. **Does the owner want a dashboard, or is email enough?**
   - Email is enough: A.
   - Dashboard, but minimal learning curve: B (uses our existing page).
   - Dashboard with built-in superpowers: C-1 (Supabase Studio) or D (Airtable).

3. **Will we build more instruments on this engine later?** (Telehealth
   intake, other roles, etc.)
   - Yes, probably: C. Picking Supabase now saves a migration later.
   - Probably not / one-and-done: A or B.

4. **Who else needs to see results?** (Just the owner? Hiring manager?
   Recruiter?)
   - Just the owner: any option works.
   - Multiple people: C (per-user auth) or D (Airtable collaboration).

5. **What's the bus factor tolerance?** (If Kelly disappeared, who keeps
   this running?)
   - Owner can't operate this without Kelly: B is the highest-friction.
   - Owner can SSH into a Supabase dashboard and read his data: C-1.
   - Owner can email himself: A.

---

## Recommendation matrix

| If the situation is... | Pick |
|---|---|
| Small volume, owner is okay with email, ship-it-and-move-on | **A** |
| Owner wants the dashboard we already built and you want fastest path | **B** |
| We're going to keep building on this engine | **C-1** |
| Owner is power-user-comfortable with spreadsheets, dashboard is needed | **D** |
| Strong "consolidate everything on existing infra" pressure | **E** |

**My default if forced to pick blind:** **C-1 (Supabase + Studio).** It costs
half a day instead of an hour, but the half-day is paid once and then this
problem is solved forever. The other options keep being decisions you
might need to revisit.

**My default for "ship something today":** **A**, with the understanding
that we'll likely upgrade to C within 6 months if volume grows.

---

## After you pick

Once we have a direction, the work breakdown is:

| Step | Who | Time |
|---|---|---|
| Create account / project on chosen platform | Kelly + client (just permissions) | ~10 min |
| Wire up the storage layer (table / form / function code) | Kelly | 30 min – 4 hours, by option |
| Update frontend to call the new endpoint(s) | Kelly | 15-30 min |
| Set environment variables (PIN, API keys) | Kelly | 5 min |
| Test end-to-end with a fake candidate | Kelly + client | 15 min |
| Train owner on the admin tool (if applicable) | Kelly + client | 15-30 min |
| Document the access info for the owner | Kelly | 10 min |

For the cheap options (A, B, D), realistic total is **~half a day**. For
C, **~1 day** including training the owner on Studio.

---

## Open questions for the client

Bring these to the review meeting:

1. Expected hiring volume per quarter?
2. Who, besides Micah, needs to see candidate data?
3. Are there compliance / data-residency requirements we should know about?
   (Vintage-mechanic hiring: probably no. But ask.)
4. Does Micah already use any of these tools (Airtable, Google Workspace,
   etc.) so we can lean on familiarity?
5. What's the budget for ongoing tooling? (All options have a free tier;
   none should exceed $30/month at hiring-volume scale.)
6. Do we want a path for the *candidate* to retake the test later and see
   their old result, or is this strictly owner-facing? (Affects whether we
   want per-candidate auth.)
