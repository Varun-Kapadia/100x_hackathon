# DEPLOY.md — Research Pipeline Extension

These steps assume you've copied this `diagnostic_extension/` folder's contents
(`supabase/` and `index_v2.html`) into your local clone of `100x_hackathon`, so
the final layout looks like:

```
100x_hackathon/
  index.html              (existing — untouched, kept as backup)
  index_v2.html           (new)
  MOVE2_HYPOTHESIS.md     (existing)
  MOVE5_RESULTS.md        (existing)
  supabase/
    migrations/0001_research_pipeline.sql   (new)
    functions/generate-diagnosis/index.ts   (new)
```

Run everything below from inside `100x_hackathon/` on your own machine — I
don't have your Supabase credentials, GitHub push access, or local CLI state,
so this part has to happen on your side.

---

## 0. Check whether the Supabase CLI is installed

```bash
supabase --version
```

- If you get a version number → skip to step 1.
- If you get "command not found":

```bash
# macOS
brew install supabase/tap/supabase

# Windows (scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Linux / no package manager — download the binary directly
curl -sL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz
sudo mv supabase /usr/local/bin/
```

Then confirm:

```bash
supabase --version
```

---

## 1. Log in and link the CLI to your project

```bash
supabase login
```

This opens a browser to authorize the CLI against your Supabase account.

Then link to the existing project (the one already live in `index.html`,
project ref `fwgaibdemgtczlzxmddd`):

```bash
supabase link --project-ref fwgaibdemgtczlzxmddd
```

It may ask for your database password — that's the Postgres password you set
when the project was created (in the Supabase dashboard under
Project Settings → Database, if you've forgotten it).

---

## 2. Set the Groq API key as an Edge Function secret

Never put this in the frontend — it lives server-side only, as a function secret:

```bash
supabase secrets set GROQ_API_KEY=your_actual_groq_key_here
```

Optional, only if you want to override the default model
(`llama-3.3-70b-versatile`):

```bash
supabase secrets set GROQ_MODEL=llama-3.3-70b-versatile
```

Verify both are set:

```bash
supabase secrets list
```

Note: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
injected automatically into every Edge Function by Supabase — you don't need
to set those yourself.

---

## 3. Run the migration

This adds the new tables/columns without touching existing data
(everything in the migration uses `if not exists` / `on conflict do nothing`):

```bash
supabase db push
```

This applies `supabase/migrations/0001_research_pipeline.sql` against your
live database. If it asks for confirmation, review the diff it shows first —
it should only be additive (new tables, new columns, new policies).

---

## 4. Deploy the Edge Function

```bash
supabase functions deploy generate-diagnosis
```

Once deployed, it'll be reachable at:

```
https://fwgaibdemgtczlzxmddd.supabase.co/functions/v1/generate-diagnosis
```

---

## 5. Test the function directly (before touching the UI)

Get a token for the demo account, then call the function:

```bash
# Get a token
curl -s -X POST 'https://fwgaibdemgtczlzxmddd.supabase.co/auth/v1/token?grant_type=password' \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3Z2FpYmRlbWd0Y3psenhtZGRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NTE2NzEsImV4cCI6MjA5NzUyNzY3MX0.430zCIH_MmhxOfRcgKCdsm5K1UYQsV7-HAovD-Tengw" \
  -H "Content-Type: application/json" \
  -d '{"email":"usera@test.com","password":"Test1234!"}'
```

Copy the `access_token` from the response, then create a test session and
call the function with it (replace `YOUR_TOKEN` and `YOUR_SESSION_ID`):

```bash
# Create a session first
curl -s -X POST 'https://fwgaibdemgtczlzxmddd.supabase.co/rest/v1/sessions' \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3Z2FpYmRlbWd0Y3psenhtZGRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NTE2NzEsImV4cCI6MjA5NzUyNzY3MX0.430zCIH_MmhxOfRcgKCdsm5K1UYQsV7-HAovD-Tengw" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"subject_name":"CLI Test","is_cold_uncoached":true}'

# Then call the function with the returned session id
curl -s -X POST 'https://fwgaibdemgtczlzxmddd.supabase.co/functions/v1/generate-diagnosis' \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"YOUR_SESSION_ID","description":"I keep meaning to use AI for my reports but I always just end up doing it by hand because by the time I write a good prompt I could have just finished it."}'
```

You should get back JSON containing `diagnosis`, `claims`,
`restatement_check`, `discrimination_check`, `attempts`, and `model`. If you
get a 500, check the function logs:

```bash
supabase functions logs generate-diagnosis
```

---

## 6. Swap in the new frontend

Once step 5 works, open `index_v2.html` directly (double-click, or serve it
locally) and run the same test through the UI. `index.html` is left
completely untouched as a fallback — don't delete or rename it yet.

When you're confident it's solid, decide whether to:
- Rename `index_v2.html` → `index.html` (replacing the old one), or
- Keep both and link to `index_v2.html` separately from your GitHub Pages
  deployment / submission writeup.

---

## 7. Push to GitHub

None of this is on GitHub yet — only the original hackathon submission is.
Once you're happy with local testing:

```bash
git add supabase/ index_v2.html DEPLOY.md
git commit -m "Add research pipeline extension: anti-restatement + anti-horoscope gates, outcome loop"
git push
```

---

## Test on yourself first

Before pointing this at real subjects, run through steps 5–6 using a
description of your own actual AI-tool blocker. Check that:
- The extracted claims actually match what you said (not invented detail).
- The candidate sentence names something you didn't explicitly say.
- The restatement check correctly fails if you deliberately feed in a
  description where the obvious "diagnosis" is just your own words restated.
- The discrimination check correctly fails if the candidate sentence is
  generic enough to fit 2+ of the seeded control profiles.
