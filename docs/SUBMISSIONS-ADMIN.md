# Submissions admin — how it works

This is the instruction manual for the **Submissions admin** page: the screen
the shop owner uses to see who has taken the assessment.

There are two audiences here:

- **The shop owner** (the person reading submissions): jump to [Using the page](#using-the-page).
- **The person who deployed the site** (Kelly / engineer): jump to [Setting up the PIN](#setting-up-the-pin).

---

## Using the page

### Where it lives

```
https://<your-site>/app.html?submissions=1
```

The shop owner should **bookmark that URL**. There's nothing secret about it —
the page itself is PIN-gated, so a stranger landing on it sees only the PIN
prompt.

### First visit

1. Open the bookmarked URL.
2. You'll see a card titled **"Submissions admin"** with a single input field
   labeled **"Access PIN"**.
3. Enter the PIN you were given.
4. Press **Sign in**.

That's it. From this point on, this device remembers you. You won't be asked
for the PIN again on this browser unless:

- You click **Sign out** in the top-right of the submissions table, **or**
- You clear your browser data, **or**
- The PIN was changed by the person who deployed the site (in which case the
  page will boot you back to the PIN prompt the next time you load it).

### What you can do on the page

- **Filter** by candidate fit (Hollywood Mechanic / Master Technician / Tinkerer
  / Service Mechanic) or show only abandoned/incomplete attempts.
- **Sort** by clicking any column header.
- **Export CSV** — downloads every row currently shown by the filter as a
  spreadsheet. Open in Numbers, Excel, or Google Sheets.
- **Sign out** — clears the saved PIN from this browser. Use this if you're on
  a shared/public computer.

### Each row tells you

| Column | What it means |
|---|---|
| Email | The candidate's email (the gate is email-first) |
| Name | Their name |
| Attempt | `1` for first try; a flagged number (e.g., `2`) means a retake |
| Quadrant | Which of the four archetypes they landed in. Top-right (vintage-specialist) is the ideal hire. |
| Curiosity / Mastery | The two axis scores, -1 to +1. Higher is more curious / more mastery-driven. |
| Started | When they began the test |
| Completed | When they finished. Blank means they abandoned mid-way. |

### "I forgot the PIN"

Ask the person who deployed the site. They can show you the current PIN or
set a new one. The owner of the site can also change the PIN at any time —
if it's changed, every browser you've signed in on will get bumped back to
the PIN prompt next time it loads the page.

### "It says my PIN didn't work"

Try again, carefully. If you're sure it's right, the PIN was probably rotated
on the server side. Ask the deployer to check or to give you the current
value.

---

## Setting up the PIN

This section is for whoever deploys the site.

### How the PIN works under the hood

The submissions page calls `GET /api/admin/submissions?token=<PIN>`. The server
compares `token` against the `ADMIN_TOKEN` environment variable. If they match,
it returns the submissions list. If not, it returns 401 and the client clears
its stored PIN and shows the entry form again.

**There is no PIN database.** The PIN is whatever you set `ADMIN_TOKEN` to in
the environment that runs `/api/admin/submissions`. To rotate the PIN, change
the env var and redeploy/restart.

### In local development

Default PIN is `dev-admin-token` (set in `server/dev-api.mjs:23`). The dev
demo nav link at the bottom of `/app.html` (visible only in `npm run dev`)
auto-fills it via the URL, so you don't see the gate during dev unless you
clear localStorage and visit `?submissions=1` without a token query string.

To override locally:

```bash
ADMIN_TOKEN=482917 npm run dev
```

### In production

`server/dev-api.mjs` is a **dev-only** Vite middleware — it does not ship to
production. Your production backend (Vercel function, Express server,
Supabase Edge function, whatever you wire up) must:

1. Implement `GET /api/admin/submissions?token=...`
2. Read `ADMIN_TOKEN` (or your chosen secret store) at request time
3. Return `{ ok: true, submissions: [...] }` on match, `{ ok: false, message: '...' }` with status 401 on mismatch

`api/submit.example.js` shows the rough pattern for a production endpoint —
adapt it for your stack.

### Choosing a good PIN

- 6+ characters, ideally numeric for owner-memorability (e.g., `482917`)
- Don't use anything trivially guessable (`123456`, `000000`, your shop phone
  number) — there is no rate-limit in the dev API, and you should add one
  on the production endpoint if you want to be paranoid
- Rotate it if the owner thinks it leaked, or quarterly as routine hygiene

### Rotating the PIN

1. Update `ADMIN_TOKEN` in your production environment (Vercel dashboard,
   Netlify env vars, `.env` file in whatever hosts your backend).
2. Redeploy or restart the backend.
3. Tell the shop owner the new PIN. Their existing browser sessions will be
   bumped to the PIN prompt automatically the next time they load the page —
   nothing to clean up.

### Security notes & known limits

This is a **PIN gate, not a full auth system**. What you get:

- ✅ Token is not in the URL (lives in localStorage after entry)
- ✅ Single secret rotates easily
- ✅ Wrong PIN auto-clears the stored value

What you do **not** get out of the box:

- ❌ Per-user identity (everyone shares one PIN)
- ❌ Rate limiting / brute-force protection (add this on the production
   endpoint — e.g., a 60-second lockout after 5 wrong attempts per IP)
- ❌ Audit log of who viewed what (everyone is "the admin")
- ❌ HTTPS enforcement (your hosting provider should handle this)

If candidate data sensitivity grows beyond "non-technical shop owner reads
20 entries a month," upgrade the auth model — Google sign-in with an email
allowlist is the natural next step, and `next-auth` / `lucia-auth` / Supabase
Auth all do this in a few hours.

### Where submissions are stored

- **Dev:** `data/submissions.json` (created automatically on first submission).
  Git-ignored.
- **Production:** wherever your backend persists them. The reference
  implementation in `api/submit.example.js` is just a sketch — for a real
  deploy, point it at Supabase / Postgres / Airtable / DynamoDB.

---

## Quick reference

| Task | Where |
|---|---|
| URL the owner uses | `https://<your-site>/app.html?submissions=1` |
| Set the PIN | `ADMIN_TOKEN` env var on the backend |
| Default dev PIN | `dev-admin-token` (`server/dev-api.mjs:23`) |
| PIN entry component | `src/SubmissionsView.jsx` |
| Endpoint that checks the PIN | `GET /api/admin/submissions?token=...` |
| Where the PIN is stored in the browser | `localStorage` key `via-admin-pin` |
