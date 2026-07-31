# G92 Logistics — Careers Site

A recruiting site for G92 Logistics: company info, driver applications with AI-assisted
pre-interview screening, a public reviews page, and a private first-day feedback form
for new drivers and trainers — all viewed through a password-protected staff dashboard.

## What's included

- **`/` (index.html)** — homepage: who G92 is, why drive here, our story, community, leadership,
  what makes a great driver, hiring process, growth path, and a live reviews teaser
- **`/culture.html`** — what the job actually looks like day to day, and how training works
- **`/apply.html`** — 5-step application (about you → eligibility → availability → Driver
  Assessment → review & submit)
- **`/reviews.html`** — "Life at G92": public reviews page + submission form (reviews are
  moderated before going live)
- **`/contact.html`** — hours, location, phone, and a contact form (name/phone/email all required)
- **`/first-day.html`** — unlisted, internal-only form for new drivers/trainers to rate day one.
  Never shown publicly — share this link directly with new hires (e.g. `yoursite.com/first-day.html`)
- **`/admin.html`** — password-gated staff dashboard: review applications with AI scores,
  approve/reject public reviews, read first-day feedback, read contact messages
- **`/images/`** — the three fleet photos used across the site (hero, culture, about sections)

## How the AI scoring works

When someone submits an application, their Driver Assessment answers (a mix of multiple-choice
and open-response questions covering reliability, accountability, safety mindset, coachability,
customer experience, and communication) are sent to Claude with a scoring rubric mirroring an
internal reviewer's scorecard. It returns a 1-5 score on each of those six dimensions, an overall
flag ("strong" / "worth a look" / "needs more info"), and a short summary — **never a hire/reject
decision**. Staff can also set their own recommendation per application (move to interview / maybe
/ do not move forward) independently of the AI score. That call is always yours. If you don't set
an API key, applications still come in fine — they just won't have an AI score, and staff can
review them manually.

## Running it locally

```bash
npm install
cp .env.example .env
# edit .env: set ANTHROPIC_API_KEY, ADMIN_PASSWORD, SESSION_SECRET
npm start
```

Visit `http://localhost:3000`. Log into `/admin.html` with the password you set.

## Deploying it for real

This is a standard Node/Express app, so it runs on any Node host. A few good, cheap options:

- **Render.com** — connect your GitHub repo, set it as a Web Service, add the env vars from
  `.env.example` in the dashboard, deploy. Free tier works for low traffic.
- **Railway.app** — similar flow, very fast to set up.
- **Vercel** — works too, but Vercel's serverless functions don't have a persistent filesystem,
  so the JSON file storage in `/data` won't survive between requests reliably. If you want
  Vercel, swap the storage layer for a real database first (see below).

Whichever host you use, you'll need to set these environment variables there (same as `.env`):
`ANTHROPIC_API_KEY`, `ADMIN_PASSWORD`, `SESSION_SECRET`.

**Important:** `ADMIN_PASSWORD` is a shared password for now — fine to get started, but if
more than one or two staff need access, it's worth upgrading to real per-person logins later.

## Connecting g92logistics.com (Render.com walkthrough)

1. **Get the code somewhere Render can see it.** Easiest path: create a free GitHub account
   if you don't have one, create a new repository, and upload this whole folder to it
   (GitHub's web uploader works fine for this, no command line needed).
2. **Create a Render account** at render.com and connect your GitHub account.
3. **New Web Service** → pick the repo you just created.
   - Build command: `npm install`
   - Start command: `npm start`
4. **Add environment variables** in Render's dashboard (under the service's "Environment" tab):
   `ANTHROPIC_API_KEY`, `ADMIN_PASSWORD`, `SESSION_SECRET` — same names as `.env.example`.
5. **Deploy.** Render gives you a URL like `g92-careers.onrender.com` — check that it works
   before moving to the domain.
6. **Add your custom domain** in Render: service settings → "Custom Domains" → add
   `g92logistics.com` and `www.g92logistics.com`. Render will show you the exact DNS records
   to add (usually an A record and a CNAME).
7. **Add those DNS records** wherever you bought g92logistics.com (GoDaddy, Namecheap, Google
   Domains, etc.) — their "DNS settings" or "manage DNS" page. Paste in exactly what Render gave
   you.
8. **Wait.** DNS changes can take anywhere from a few minutes to 24-48 hours to fully propagate.
   Render will show a green checkmark next to the domain once it's live.

That's it — g92logistics.com will serve the real app, not a static export. If any step throws
an error, the error message plus a screenshot is usually enough for me to help you past it.

## Storage — read this before you get real applicants

Right now, applications/reviews/first-day feedback are stored as JSON files in `/data`.
That's simple and fine for getting started, but two things to know:

1. **It's not backed up.** If your host wipes the disk (some free tiers do on redeploy),
   you lose the data. Download the `/data` folder periodically, or better:
2. **Swap in a real database once you're getting steady applicants.** The `readDb`/`writeDb`
   functions in `server.js` are the only place that touches storage — replacing them with
   calls to Postgres, SQLite, or a hosted DB (Supabase, Railway Postgres, etc.) is a contained
   change and won't require touching the frontend or the routes.

## Customizing

- **Driver Assessment questions** live in `public/apply.html` (step 3, the choice groups and
  textareas) and `public/js/apply.js` (the `ASSESSMENT_QUESTIONS` map, which doubles as what the
  AI sees). Keep the question text in both places in sync.
- **Scoring rubric** is the `SCORING_RUBRIC` constant near the top of `server.js` — edit the
  dimensions or wording any time without touching the frontend.
- **Copy and stats** on the homepage (fleet size, driver count) are hardcoded in `index.html` —
  update as your numbers change.
- **Colors/fonts** are all CSS variables at the top of `public/css/styles.css`.

## A note on fairness

The scoring rubric explicitly tells the model to score only on what a candidate wrote, not
to infer anything about protected characteristics, and to never output a reject decision —
only flags for a human to weigh. Worth re-reading that prompt occasionally as your hiring
needs evolve, and worth spot-checking scores against your own read on a handful of
applications so you trust what it's doing.
