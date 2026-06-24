
// supabase/functions/generate-diagnosis/index.ts
//
// Pipeline: extract claims -> generate candidate sentence -> restatement check
// (Idea 1) -> discrimination check against control_set (Idea 3) -> retry once on
// failure -> save everything.
//
// SECURITY NOTE (do not regress this): ownership verification (confirming the
// calling user actually owns `session_id`) MUST use the user's own JWT against
// the anon-key client, NOT the service-role client. The service-role key
// bypasses RLS entirely -- using it for the ownership check would make the
// check a no-op, since it would "succeed" against any session_id regardless
// of who owns it. Service role is only safe to use AFTER ownership has
// already been confirmed via the anon-key client, for writes that need to
// cross multiple tables in one transaction-like sequence.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") ?? "llama-3.3-70b-versatile";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callGroq(messages: { role: string; content: string }[]) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data.choices[0].message.content as string;
}

function extractJson(text: string): any {
  // Models sometimes wrap JSON in prose or code fences despite instructions.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in model output");
  return JSON.parse(raw.slice(start, end + 1));
}

async function extractClaims(description: string): Promise<string[]> {
  const content = await callGroq([
    {
      role: "system",
      content:
        "You extract only what a person explicitly stated about their AI usage blocker. " +
        "Return ONLY JSON, no preamble, no markdown fences: " +
        '{"claims": ["...", "..."]}. Each claim must be a short, literal restatement ' +
        "of something the person actually said -- do not infer, interpret, or add anything beyond their words.",
    },
    { role: "user", content: description },
  ]);
  const parsed = extractJson(content);
  return parsed.claims as string[];
}

async function generateCandidate(description: string, claims: string[]): Promise<string> {
  const content = await callGroq([
    {
      role: "system",
      content:
        "You are diagnosing a person's real AI usage blocker in exactly one precise sentence. " +
        "The sentence must name something the person did NOT already say themselves -- " +
        "an underlying pattern, not a summary of their own words. " +
        'Return ONLY JSON, no preamble: {"sentence": "..."}',
    },
    {
      role: "user",
      content: `Description: ${description}\n\nThings they explicitly said: ${claims.join("; ")}`,
    },
  ]);
  const parsed = extractJson(content);
  return parsed.sentence as string;
}

async function restatementCheck(
  claims: string[],
  candidate: string,
): Promise<{ passed: boolean; reasoning: string }> {
  const content = await callGroq([
    {
      role: "system",
      content:
        "You check whether a candidate diagnosis sentence is JUST a restatement or " +
        "reorganization of claims the person already made themselves, versus naming " +
        "something genuinely new. Restatements get flat polite agreement, not real recognition. " +
        'Return ONLY JSON: {"passed": true|false, "reasoning": "..."}. ' +
        "passed=true means the candidate names something NEW (good). passed=false means it's just a restatement (bad, must regenerate).",
    },
    {
      role: "user",
      content: `Explicit claims: ${claims.join("; ")}\n\nCandidate sentence: ${candidate}`,
    },
  ]);
  return extractJson(content);
}

async function discriminationCheck(
  candidate: string,
  controlProfiles: { id: string; profile_text: string }[],
): Promise<{
  passed: boolean;
  reasoning: string;
  matched_profiles: string[];
  perProfile: { control_profile_id: string; is_plausible_fit: boolean; reasoning: string }[];
}> {
  const content = await callGroq([
    {
      role: "system",
      content:
        "You test whether a candidate diagnosis sentence is too generic -- i.e. whether it " +
        "is a plausible fit for multiple unrelated 'stuck with AI' profiles (a horoscope-style " +
        "diagnosis that sounds insightful but fits anyone). For EACH control profile listed, " +
        "judge if the candidate sentence could plausibly also describe that profile. " +
        'Return ONLY JSON: {"results": [{"profile_index": 0, "is_plausible_fit": true|false, "reasoning": "..."}, ...]}',
    },
    {
      role: "user",
      content:
        `Candidate sentence: ${candidate}\n\nControl profiles:\n` +
        controlProfiles.map((p, i) => `${i}. ${p.profile_text}`).join("\n"),
    },
  ]);
  const parsed = extractJson(content);
  const perProfile = (parsed.results as any[]).map((r) => ({
    control_profile_id: controlProfiles[r.profile_index].id,
    is_plausible_fit: r.is_plausible_fit,
    reasoning: r.reasoning,
  }));
  const matched = perProfile.filter((p) => p.is_plausible_fit);
  // Threshold: fitting 2 or more generic profiles = too generic, reject as horoscope.
  const passed = matched.length < 2;
  return {
    passed,
    reasoning: passed
      ? "Candidate sentence does not plausibly fit multiple generic profiles."
      : `Candidate sentence plausibly fits ${matched.length} generic control profiles -- too generic.`,
    matched_profiles: matched.map((m) => m.control_profile_id),
    perProfile,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const { session_id, description } = await req.json();
    if (!session_id || !description) {
      return json({ error: "session_id and description are required" }, 400);
    }

    // Ownership verification: MUST use anon key + caller's JWT, so RLS applies.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: session, error: sessionErr } = await userClient
      .from("sessions")
      .select("id")
      .eq("id", session_id)
      .single();

    if (sessionErr || !session) {
      return json({ error: "Session not found or not owned by caller" }, 403);
    }

    // From here on, ownership is confirmed. Service role is used only for the
    // multi-table writes below, scoped explicitly to this already-verified session_id.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1. Extract claims
    const claims = await extractClaims(description);
    const claimRows = claims.map((claim_text) => ({ session_id, claim_text, source: "manual" }));
    if (claimRows.length > 0) {
      await adminClient.from("extracted_claims").insert(claimRows);
    }

    // 2. Generate candidate, with one retry if either gate fails
    let candidate = await generateCandidate(description, claims);
    let restatement = await restatementCheck(claims, candidate);
    let discrimination: Awaited<ReturnType<typeof discriminationCheck>> | null = null;

    const { data: controlProfiles } = await adminClient
      .from("control_set")
      .select("id, profile_text")
      .eq("is_active", true);

    if (restatement.passed) {
      discrimination = await discriminationCheck(candidate, controlProfiles ?? []);
    }

    let attempt = 1;
    if (!restatement.passed || (discrimination && !discrimination.passed)) {
      attempt = 2;
      candidate = await generateCandidate(
        description,
        claims.concat([
          restatement.passed
            ? `(too generic, avoid resembling: ${discrimination?.matched_profiles.join(", ")})`
            : "(previous attempt was just a restatement, must name something new)",
        ]),
      );
      restatement = await restatementCheck(claims, candidate);
      discrimination = restatement.passed
        ? await discriminationCheck(candidate, controlProfiles ?? [])
        : null;
    }

    // 3. Save diagnosis row
    const { data: diagnosis, error: diagErr } = await adminClient
      .from("diagnoses")
      .insert({
        session_id,
        sentence_text: candidate,
        generated_by: "pipeline",
        status: "pending_outcome",
        restatement_check: restatement,
        discrimination_check: discrimination,
      })
      .select()
      .single();

    if (diagErr) throw diagErr;

    // 4. Log discrimination check rows for audit trail
    if (discrimination) {
      const rows = discrimination.perProfile.map((p) => ({
        diagnosis_id: diagnosis.id,
        control_profile_id: p.control_profile_id,
        is_plausible_fit: p.is_plausible_fit,
        reasoning: p.reasoning,
      }));
      if (rows.length > 0) await adminClient.from("discrimination_checks").insert(rows);
    }

    return json({
      diagnosis,
      claims,
      restatement_check: restatement,
      discrimination_check: discrimination,
      attempts: attempt,
      model: GROQ_MODEL,
    });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
