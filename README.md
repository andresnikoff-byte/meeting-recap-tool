# Recap — meeting transcript summarizer

A free web tool: paste a messy meeting/call transcript, get a clean summary
and action-item list, share it with a link. No login, no database — the
"shareable link" just encodes the result into the URL itself.

This is a **zero-build, zero-dependency** project on purpose: it's a static
site (`index.html`, `r.html`, `styles.css`, `script.js`, `r.js`) plus three
tiny serverless functions in `/api`. Nothing to install, nothing that can
fail to compile — Vercel just serves the files and runs the functions.

## What you'll need (genuinely $0 to start)

1. A **GitHub** account — to hold the code so Vercel can deploy it.
2. A **Vercel** account — free hosting + the serverless functions.
3. A **Google AI Studio** account (aistudio.google.com) — this is what
   actually generates the recaps, and it's free: no credit card, ~1,500
   requests/day, using a Google account you probably already have. This is
   the default in the code (`AI_PROVIDER=gemini`), so running the tool
   costs nothing unless you later choose to switch providers (see "Cost
   control" below).
4. An **Upstash** account (console.upstash.com) — free Redis database, used
   only to count how many recaps have been generated (no personal data).
5. Optionally, a **domain name** (~$10–15/year from Namecheap or similar) —
   you can skip this at first and use the free `*.vercel.app` address Vercel
   gives you, then add a custom domain later with a couple of clicks.

## Launch checklist

1. **Create a GitHub repo.** Go to github.com → New repository → name it
   something like `meeting-recap-tool` → Create. On the empty repo page,
   click "uploading an existing file" and drag in every file from this
   folder (keep the `api` folder structure intact). Commit.

2. **Deploy on Vercel.** Go to vercel.com → sign up/log in with GitHub →
   "Add New Project" → pick the repo you just created → Deploy. No build
   settings needed — leave everything default. It'll fail on the first
   deploy because the environment variables aren't set yet; that's expected.

3. **Get a free Gemini API key.** aistudio.google.com → sign in with any
   Google account → "Get API key" → Create API key. No payment method
   needed — this stays free up to ~1,500 requests/day.

4. **Create a free Upstash Redis database.** console.upstash.com → Create
   Database → any name/region → Create. On the database's detail page, find
   the "REST API" section and copy the URL and token.

5. **Set environment variables in Vercel.** In your Vercel project → Settings
   → Environment Variables, add each of these (see `.env.example` for the
   full list): `AI_PROVIDER` (set to `gemini`), `GEMINI_API_KEY`,
   `GEMINI_MODEL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and
   `STATS_SECRET` (make up any long random string for this last one — it's
   the password that protects the usage-stats endpoint).

6. **Redeploy.** Back in the Vercel project → Deployments tab → click the
   "..." menu on the latest deployment → Redeploy. It should succeed this
   time and give you a live `https://your-project.vercel.app` URL.

7. **Test it.** Open the URL, paste in a sample transcript (even a fake one
   — "Alice: let's ship the update Friday. Bob: I'll write the spec." works)
   and confirm you get a summary and action items back.

8. **(Optional) Add your custom domain.** Vercel project → Settings →
   Domains → add the domain you bought → follow the DNS instructions shown
   (usually just adding one or two records at your registrar).

## Checking on it

The `/api/stats?key=YOUR_STATS_SECRET` endpoint returns total usage and a
7-day breakdown as JSON — this is what gets checked during the weekly
check-ins to see how the tool is doing, without needing to log into
anything.

## Cost control

**As shipped, this costs $0 to run.** It defaults to Gemini's free tier
(`AI_PROVIDER=gemini`), which has no billing attached at all — there's
nothing to accidentally overspend on. The only limit is ~1,500 requests/day;
if you ever hit that, extra requests just fail gracefully with a friendly
"try again in a few minutes" message instead of the tool going down or a
bill showing up.

If you outgrow that later (real traction, want higher-quality summaries, or
need more than 1,500/day), the code already supports switching to Anthropic:
set `AI_PROVIDER=anthropic` and add `ANTHROPIC_API_KEY` in Vercel. Real
numbers if you do: Claude Haiku costs about $1 per million input tokens and
$5 per million output tokens, and a typical meeting recap uses roughly
2,000 input + 300 output tokens — call it $0.003–0.005 per recap, so even
1,000 recaps in a month is around $3–5, not a scary ongoing bill. It's also
pure usage-based cost, not a subscription — $0 traffic means $0 spent. If
you do switch to it, set a hard spend limit at console.anthropic.com →
Settings → Billing so it's capped no matter what happens with traffic.

Transcripts are capped at 20,000 characters per request either way, which
also caps the maximum possible cost of any single request.
