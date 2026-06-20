# MOVE 5 — Results

Two subjects, both cold/uncoached (neither had any prior context that this was a hackathon interview, and neither had seen any earlier diagnostic sentences). Both conversations were run live, over text, with the diagnosis delivered as a flat statement and the reaction captured verbatim, unprompted.

---

## Person A — "Dany" (cold/uncoached)

**Stated blocker:** When prompting AI, the context required is never fully captured upfront, forcing several rounds of follow-up questions to get the desired outcome.

**What surfaced through probing:**
- Concrete example: asked AI to build a weekly gym split across muscle groups using photos of his gym's equipment, specifying his desired split in advance.
- He had typed everything in one go the first time — goal, schedule, split, photos — and still expected a one-shot result.
- It took 4–5 follow-ups to fix the plan. Crucially, one or two of those follow-ups were **the exact same correction repeated**, because the AI re-introduced the same sequencing error (mixing up which muscle groups landed on which day) even after being told.
- He confirmed this wasn't a one-off — the same multi-round pattern happened on an unrelated task (compiling study material).
- When asked why he didn't just restart the chat with a cleaner prompt instead of patching the same thread repeatedly, he said restarting felt like a hassle and he believed staying in the same thread gave a "more personalised outcome" — even though his own account showed the opposite: the thread was accumulating repeated errors, not personalization.

**Diagnosis sentence delivered:**
> "I don't think this is really about the AI missing context — I think what's actually happening is you keep correcting the same mistakes inside one long thread because restarting feels like a hassle, but that thread isn't giving you the personalized result you're hoping for, it's just letting the same errors pile up and forcing you to re-fix them every time — the thing that would actually save you time is the option that feels like more effort upfront."

**Reaction:** "Sure."

**Classification: Polite confirmation.** No unprompted action, no follow-up question, no "how did you know" — a flat acknowledgment with no observable behavioral or verbal escalation, despite the sentence naming something (the false belief that the long thread was personalizing rather than degrading) that he had not stated himself.

---

## Person B — "MOTOR R" (cold/uncoached)

**Stated blocker:** AI feels functionally the same as a normal search engine — not a big deal, not very differentiated.

**What surfaced through probing:**
- Concrete example: asked AI for a summary of valvular heart diseases, got a table he could have gotten from Google.
- Explicitly said what he actually wants is more precise answers *and* visual/picture-based explanations — something showing the basic differences between things, not just text.
- He has used AI heavily — effectively replaced Google with it — so this isn't an unfamiliarity problem.
- Despite using it a lot, every example he gave was a text-based factual/explanatory request (long explanations, crisp answers on big medical topics). He had never actually asked it for the visual/multimodal output he says he wants.

**Diagnosis sentence delivered:**
> "I don't think this is actually about AI being the same as a search engine — I think what's happening is you've only ever asked it for the one kind of thing that does overlap with a search engine, text summaries of facts, and you've never actually asked it for the visual, picture-based explanation you just told me you actually want, so you've concluded it can't do something you've genuinely never tried asking it to do."

**Reaction:**
> "I wanted to get some clear and better answer for my query, i got it from google also but it does not solve my issues. Also i do think that ai needs to add some of its own mind to solve my queries, as i genuinely ask things which i am not clear of."

**Classification: Polite confirmation / non-engagement.** He did not contest the specific point made (that he'd never tried asking for visual output) and did not engage with it directly — instead he redirected to a related but different complaint (wanting the AI to handle ambiguity in his own query). No unprompted action, no "how did you know," no behavioral signal. Notably different in texture from a simple "ok" — this was a deflection rather than an acknowledgment — but it still produced zero evidence of recognition under the operational definition set in Move 2.

---

## Kill-condition check

Move 2's kill-number: *if both Move 5 subjects give only verbal agreement (no unprompted action, no unprompted "how did you know" / "what do I do now" follow-up) — write "my hypothesis was wrong."*

Both subjects met this condition. Person A gave flat agreement ("Sure"). Person B gave a deflection with no engagement with the specific novel claim. Neither produced an unprompted action or an unprompted escalating question.

**My hypothesis was wrong** — or more precisely, the positive half of it was never demonstrated: across all five interviews run in this project (three in Move 1, two in Move 5), there is exactly zero confirmed instance of a diagnostic sentence producing behavioral or verbal escalation, regardless of how novel, specific, or accurate the sentence was. The claim that "novelty produces recognition while restatement produces flatness" cannot be supported — flatness was the outcome in every single case, including the two Move 5 cases that were genuinely novel to the subject (neither Dany's false-personalization belief nor MOTOR R's never-asked-for-visual-output observation had been stated by them prior to the diagnosis).

## The surprise

Going in, the expectation (per the revised Move 2 hypothesis) was that *some* signal — even one instance — would separate a landed diagnosis from a horoscope-style guess. The actual surprise is how uniform the flatness was even when the sentence was demonstrably specific and non-restated. Dany's diagnosis named a belief he held (long thread = personalization) that directly contradicted what he had just described happening to him — a genuinely "new" framing by any reasonable definition — and it still produced only "Sure." This suggests the failure mode here isn't that the sentences weren't good enough or novel enough; it's that **conversational reaction, by itself, may not be a usable signal for this kind of diagnostic tool at all** — not because people are being dishonest or overly polite, but because recognizing a true thing about yourself in a text conversation doesn't reliably produce an externally observable reaction in the moment, even when it lands internally. If this is right, the real design implication isn't "write better diagnostic sentences" — it's that any future version of this tool needs a fundamentally different validation method than "watch what they say next," because that channel may simply be too narrow to detect the thing it's trying to measure.
