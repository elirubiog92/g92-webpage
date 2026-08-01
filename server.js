require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const { nanoid } = require('nanoid');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// ---------- tiny JSON "database" ----------
// Fine for a small DSP careers site. Swap for Postgres/SQLite later if volume grows.
function dbFile(name) { return path.join(DATA_DIR, `${name}.json`); }
function readDb(name) {
  try { return JSON.parse(fs.readFileSync(dbFile(name), 'utf8')); }
  catch { return []; }
}
function writeDb(name, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(dbFile(name), JSON.stringify(data, null, 2));
}

// ---------- middleware ----------
app.use(express.json({ limit: '1mb' }));

// Optional site-wide password gate, for pre-launch review before the public sees it.
// Set SITE_PASSWORD in your environment to lock EVERY page (including the admin
// dashboard) behind a browser password prompt. Leave it unset and the site behaves
// normally. To open the site to the public later, just delete the SITE_PASSWORD
// environment variable in Render and redeploy/restart — no code changes needed.
app.use((req, res, next) => {
  if (!process.env.SITE_PASSWORD) return next();
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Basic ')) {
    const [, password] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
    if (password === process.env.SITE_PASSWORD) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="G92 Logistics Preview"');
  return res.status(401).send('This site is currently in private preview.');
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 } // 8 hour login
}));

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Not logged in.' });
}

// ---------- Anthropic client (optional: scoring is skipped gracefully if no key set) ----------
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const SCORING_RUBRIC = `You are screening applicants for a Delivery Associate (driver) role at G92 Logistics, an Amazon Delivery Service Partner. Applicants complete a "Driver Assessment," a mix of multiple-choice and open-response questions about reliability, accountability, safety mindset, coachability, customer experience, and how they handle pressure. You are NOT making the hiring decision; a human always makes the final call. Your job is to help staff triage a stack of applications quickly and fairly, the same way a human reviewer would fill out an internal scorecard.

Score the candidate on these six dimensions, each 1-5 (5 = strongest):
1. Reliability - shows up, follows through, owns their schedule
2. Accountability - owns mistakes, communicates problems instead of hiding them
3. Safety mindset - stays calm and safe under pressure, takes safety feedback seriously
4. Coachability - genuinely open to feedback and to doing things a new way
5. Customer experience - cares about doing right by the person receiving the package
6. Communication - answers are clear, specific, and easy to follow

For multiple-choice answers, weigh the option they picked directly (some options are clearly stronger than others (e.g. "I go anyway and figure it out tomorrow" is a weaker reliability signal than "I plan around my responsibilities"). For open-response answers, judge substance over polish.

Also return:
- overall_flag: one of "strong", "worth_a_look", "needs_more_info" (never a rejection label; humans decide that)
- summary: 2-3 plain sentences a busy dispatcher could read in five seconds
- notable_quote: one short (under 20 words) direct quote from the candidate's own open-response answers that best supports your read, or null if nothing stands out

Be fair and consistent. Do not penalize for typos, ESL phrasing, or informal writing style. Base every score only on what the candidate actually wrote or selected; never assume anything about their background, race, gender, age, or other protected characteristics.

Respond ONLY with valid JSON, no other text, in exactly this shape:
{"reliability":1-5,"accountability":1-5,"safety_mindset":1-5,"coachability":1-5,"customer_experience":1-5,"communication":1-5,"overall_flag":"strong|worth_a_look|needs_more_info","summary":"...","notable_quote":"..."}`;

async function scoreApplication(answers) {
  if (!anthropic) return { error: 'AI scoring not configured (no ANTHROPIC_API_KEY set). Review manually.' };
  try {
    const answerText = Object.entries(answers)
      .map(([q, a]) => `Q: ${q}\nA: ${a}`)
      .join('\n\n');

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 500,
      system: SCORING_RUBRIC,
      messages: [{ role: 'user', content: `Candidate's pre-interview answers:\n\n${answerText}` }]
    });

    const text = msg.content.find(b => b.type === 'text')?.text || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error('Scoring error:', err.message);
    return { error: 'AI scoring failed for this application. Review manually.' };
  }
}

// ============================================================
// PUBLIC: Applications
// ============================================================
app.post('/api/apply', async (req, res) => {
  const {
    name, email, phone, availability, hasLicense,
    employmentDesired, eligibility, answers
  } = req.body;

  if (!name || !email || !phone || !answers || Object.keys(answers).length === 0) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const application = {
    id: nanoid(10),
    submittedAt: new Date().toISOString(),
    name, email, phone,
    employmentDesired: employmentDesired || null,
    eligibility: eligibility || null,
    availability, hasLicense,
    answers,
    status: 'new', // new -> reviewed -> contacted -> hired -> archived
    recommendation: null, // null | 'move_to_interview' | 'maybe' | 'do_not_move_forward'
    aiScore: null
  };

  const applications = readDb('applications');
  applications.unshift(application);
  writeDb('applications', applications);

  // Score asynchronously so the applicant doesn't wait on the AI call.
  scoreApplication(answers).then(score => {
    const apps = readDb('applications');
    const idx = apps.findIndex(a => a.id === application.id);
    if (idx !== -1) {
      apps[idx].aiScore = score;
      writeDb('applications', apps);
    }
  });

  res.json({ ok: true, id: application.id });
});

// ============================================================
// PUBLIC: Company reviews (staff/DA reviews of G92 - shown on site)
// ============================================================
app.get('/api/reviews', (req, res) => {
  const reviews = readDb('reviews').filter(r => r.status === 'approved');
  res.json(reviews.map(({ id, name, role, rating, body, submittedAt }) => ({ id, name, role, rating, body, submittedAt })));
});

app.post('/api/reviews', (req, res) => {
  const { name, role, rating, body } = req.body;
  if (!body || !rating) return res.status(400).json({ error: 'Missing review text or rating.' });

  const review = {
    id: nanoid(10),
    submittedAt: new Date().toISOString(),
    name: name?.trim() || 'Anonymous',
    role: role || 'Delivery Associate',
    rating: Math.max(1, Math.min(5, Number(rating))),
    body: String(body).slice(0, 2000),
    status: 'pending' // pending -> approved / rejected, staff moderates before it goes public
  };

  const reviews = readDb('reviews');
  reviews.unshift(review);
  writeDb('reviews', reviews);
  res.json({ ok: true });
});

// ============================================================
// PUBLIC (unlisted link): First-day feedback from new drivers/trainers
// Never exposed publicly - internal eyes only, viewed via /admin.
// ============================================================
app.post('/api/first-day', (req, res) => {
  const { submittedBy, role, trainerName, rating, whatWentWell, whatNeedsWork, wouldRecommend } = req.body;
  if (!whatWentWell && !whatNeedsWork) {
    return res.status(400).json({ error: 'Please share at least one piece of feedback.' });
  }

  const entry = {
    id: nanoid(10),
    submittedAt: new Date().toISOString(),
    submittedBy: submittedBy?.trim() || 'Anonymous',
    role: role || 'New Driver', // "New Driver" or "Trainer"
    trainerName: trainerName || null,
    rating: rating ? Math.max(1, Math.min(5, Number(rating))) : null,
    whatWentWell: whatWentWell || '',
    whatNeedsWork: whatNeedsWork || '',
    wouldRecommend: !!wouldRecommend
  };

  const entries = readDb('firstday');
  entries.unshift(entry);
  writeDb('firstday', entries);
  res.json({ ok: true });
});

// ============================================================
// ADMIN AUTH
// ============================================================
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Server has no ADMIN_PASSWORD configured yet.' });
  }
  if (password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Wrong password.' });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/admin/session', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// ============================================================
// ADMIN: Applications
// ============================================================
app.get('/api/admin/applications', requireAdmin, (req, res) => {
  res.json(readDb('applications'));
});

app.post('/api/admin/applications/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  const applications = readDb('applications');
  const idx = applications.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found.' });
  applications[idx].status = status;
  writeDb('applications', applications);
  res.json({ ok: true });
});

app.post('/api/admin/applications/:id/recommendation', requireAdmin, (req, res) => {
  const { recommendation } = req.body; // 'move_to_interview' | 'maybe' | 'do_not_move_forward' | null
  const applications = readDb('applications');
  const idx = applications.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found.' });
  applications[idx].recommendation = recommendation || null;
  writeDb('applications', applications);
  res.json({ ok: true });
});

// Retry AI scoring manually (e.g. after adding an API key, or if it failed)
app.post('/api/admin/applications/:id/rescore', requireAdmin, async (req, res) => {
  const applications = readDb('applications');
  const idx = applications.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found.' });
  const score = await scoreApplication(applications[idx].answers);
  applications[idx].aiScore = score;
  writeDb('applications', applications);
  res.json({ ok: true, score });
});

// ============================================================
// ADMIN: Reviews moderation
// ============================================================
app.get('/api/admin/reviews', requireAdmin, (req, res) => {
  res.json(readDb('reviews'));
});

app.post('/api/admin/reviews/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body; // 'approved' or 'rejected'
  const reviews = readDb('reviews');
  const idx = reviews.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found.' });
  reviews[idx].status = status;
  writeDb('reviews', reviews);
  res.json({ ok: true });
});

// ============================================================
// ADMIN: First-day feedback (internal only, never public)
// ============================================================
app.get('/api/admin/first-day', requireAdmin, (req, res) => {
  res.json(readDb('firstday'));
});

// ============================================================
// PUBLIC: Contact messages
// ============================================================
app.post('/api/contact', (req, res) => {
  const { name, phone, email, message } = req.body;
  if (!name || !phone || !email || !message) {
    return res.status(400).json({ error: 'Please include your name, phone, email, and a message.' });
  }

  const entry = {
    id: nanoid(10),
    submittedAt: new Date().toISOString(),
    name: String(name).trim(),
    phone: String(phone).trim(),
    email: String(email).trim(),
    message: String(message).trim().slice(0, 2000),
    status: 'new' // new -> read -> replied
  };

  const messages = readDb('messages');
  messages.unshift(entry);
  writeDb('messages', messages);
  res.json({ ok: true });
});

app.get('/api/admin/messages', requireAdmin, (req, res) => {
  res.json(readDb('messages'));
});

app.post('/api/admin/messages/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  const messages = readDb('messages');
  const idx = messages.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found.' });
  messages[idx].status = status;
  writeDb('messages', messages);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`G92 careers site running at http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('Warning: ANTHROPIC_API_KEY not set. AI candidate scoring will be skipped.');
  }
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('Warning: ADMIN_PASSWORD not set. /admin login will fail until you set one in .env');
  }
});
