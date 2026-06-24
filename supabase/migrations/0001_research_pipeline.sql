
-- 0001_research_pipeline.sql
-- Research/portfolio extension to the AI Bottleneck Diagnostic (Track C) schema.
-- Safe to run against the live DB: every statement uses IF NOT EXISTS / ON CONFLICT,
-- so it will not touch or break existing rows in sessions / interview_transcripts /
-- diagnoses / reactions.

-- ============================================================
-- 1. New columns on existing tables
-- ============================================================

-- diagnoses: track pipeline state per the recurring-outcome-loop idea
alter table diagnoses
  add column if not exists status text not null default 'pending_outcome'
    check (status in ('pending_outcome', 'outcome_recorded'));

alter table diagnoses
  add column if not exists restatement_check jsonb;   -- { passed: bool, reasoning: text }

alter table diagnoses
  add column if not exists discrimination_check jsonb; -- { passed: bool, reasoning: text, matched_profiles: [...] }

alter table diagnoses
  add column if not exists generated_by text default 'human'
    check (generated_by in ('human', 'pipeline'));

-- sessions: no schema change needed yet, reserved for future cohort-rollout auth fields.

-- ============================================================
-- 2. extracted_claims
--    What the subject explicitly said, pulled out by the pipeline
--    before a candidate diagnosis sentence is generated.
-- ============================================================

create table if not exists extracted_claims (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  claim_text text not null,
  source text not null default 'transcript', -- 'transcript' | 'manual'
  created_at timestamptz not null default now()
);

create index if not exists idx_extracted_claims_session_id on extracted_claims(session_id);

-- ============================================================
-- 3. outcomes
--    The recurring-outcome-loop: what actually happened after a
--    diagnosis was shown to the subject. Distinct from `reactions`
--    (which captures immediate in-the-room reaction) — this is the
--    later, real-world follow-up.
-- ============================================================

create table if not exists outcomes (
  id uuid primary key default gen_random_uuid(),
  diagnosis_id uuid not null references diagnoses(id) on delete cascade,
  outcome_text text not null,
  outcome_type text not null check (outcome_type in (
    'unprompted_action',      -- they did something about it without being asked
    'unprompted_escalation',  -- "how did you know" / "what do I do" — real signal
    'polite_confirmation',    -- agreement only, no behavioral follow-through
    'disagreement',
    'no_response'
  )),
  reported_at timestamptz not null default now()
);

create index if not exists idx_outcomes_diagnosis_id on outcomes(diagnosis_id);

-- ============================================================
-- 4. control_set
--    Anti-horoscope verifier: a fixed bank of generic "stuck with AI"
--    profiles. Candidate diagnosis sentences are checked against this
--    set — if a sentence is a plausible fit for too many generic
--    profiles, it's rejected as too generic ("horoscope").
-- ============================================================

create table if not exists control_set (
  id uuid primary key default gen_random_uuid(),
  profile_text text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into control_set (profile_text)
values
  ('Person is overwhelmed by too many AI tools and doesn''t know which one to commit to.'),
  ('Person knows the AI capability exists but hasn''t built the habit of actually using it.'),
  ('Person is afraid the AI output isn''t reliable enough to trust without checking everything manually.'),
  ('Person is stuck because they don''t know how to write a good prompt for what they want.'),
  ('Person has tried AI for this before and got a bad result, so they quietly went back to doing it manually.')
on conflict do nothing;

-- ============================================================
-- 5. discrimination_checks
--    The actual log of every candidate sentence run against control_set,
--    so the anti-horoscope gate has an audit trail rather than just a
--    pass/fail jsonb blob on the diagnosis row.
-- ============================================================

create table if not exists discrimination_checks (
  id uuid primary key default gen_random_uuid(),
  diagnosis_id uuid not null references diagnoses(id) on delete cascade,
  control_profile_id uuid not null references control_set(id) on delete cascade,
  is_plausible_fit boolean not null,
  reasoning text,
  created_at timestamptz not null default now()
);

create index if not exists idx_discrimination_checks_diagnosis_id on discrimination_checks(diagnosis_id);

-- ============================================================
-- 6. Row-Level Security
--    Same pattern as the existing tables: scoped via sessions.user_id = auth.uid(),
--    cascaded through the foreign key chain.
-- ============================================================

alter table extracted_claims enable row level security;
alter table outcomes enable row level security;
alter table control_set enable row level security;
alter table discrimination_checks enable row level security;

-- extracted_claims: scoped through sessions
drop policy if exists "extracted_claims_owner_select" on extracted_claims;
create policy "extracted_claims_owner_select" on extracted_claims
  for select using (
    session_id in (select id from sessions where user_id = auth.uid())
  );

drop policy if exists "extracted_claims_owner_insert" on extracted_claims;
create policy "extracted_claims_owner_insert" on extracted_claims
  for insert with check (
    session_id in (select id from sessions where user_id = auth.uid())
  );

-- outcomes: scoped through diagnoses -> sessions
drop policy if exists "outcomes_owner_select" on outcomes;
create policy "outcomes_owner_select" on outcomes
  for select using (
    diagnosis_id in (
      select d.id from diagnoses d
      join sessions s on s.id = d.session_id
      where s.user_id = auth.uid()
    )
  );

drop policy if exists "outcomes_owner_insert" on outcomes;
create policy "outcomes_owner_insert" on outcomes
  for insert with check (
    diagnosis_id in (
      select d.id from diagnoses d
      join sessions s on s.id = d.session_id
      where s.user_id = auth.uid()
    )
  );

-- control_set: readable by any authenticated user (it's a shared, fixed reference
-- set, not per-user data), writable by no one via the API (seeded via migration only).
drop policy if exists "control_set_authenticated_read" on control_set;
create policy "control_set_authenticated_read" on control_set
  for select using (auth.role() = 'authenticated');

-- discrimination_checks: scoped through diagnoses -> sessions, same as outcomes
drop policy if exists "discrimination_checks_owner_select" on discrimination_checks;
create policy "discrimination_checks_owner_select" on discrimination_checks
  for select using (
    diagnosis_id in (
      select d.id from diagnoses d
      join sessions s on s.id = d.session_id
      where s.user_id = auth.uid()
    )
  );

drop policy if exists "discrimination_checks_owner_insert" on discrimination_checks;
create policy "discrimination_checks_owner_insert" on discrimination_checks
  for insert with check (
    diagnosis_id in (
      select d.id from diagnoses d
      join sessions s on s.id = d.session_id
      where s.user_id = auth.uid()
    )
  );
