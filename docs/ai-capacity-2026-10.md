# The app's AI capacity was 25x smaller than configured

**3–4 October 2026 · found during the photo-size A/B, fixed in the PR that adds this note**

The app was configured to allow **500 AI calls a day**. Google's free tier
actually allows **20 requests a day per model, for the whole app**, and it
counts failed attempts too. Nobody noticed, because the app's only heavy users
stayed just under the ceiling most days. It surfaced by accident, when an
experiment and a bad Gemini day used it up. Users would then have been told to
"try again in a minute" for the next nineteen hours.

| | Before | After |
|---|---|---|
| App-wide daily AI cap | 500 (real limit: 20 per model) | **40**, inside a chain of models with 20 each |
| Attempts one analysis may make in an overload | ~13 | **at most 4** |
| A daily-limit refusal says | "try again in a minute" | **"resets in about N hours"** |
| A daily-limit refusal tries the other model | never | **immediately** |
| A model already out for the day | asked again on every call | **skipped until midnight Pacific** |

---

## How it was found

The [photo-size experiment](photo-size-ab-2026-10.md) sent the same meal photos
to the model dozens of times. On 3 October, call 18 came back refused, with an
error that said exactly why:

```
quotaId:    GenerateRequestsPerDayPerProjectPerModel-FreeTier
quotaValue: 20
model:      gemini-3.5-flash
```

**Twenty a day per model, per Google project.** That one project is the whole
app: every photo analysis, every voice-note transcription and every
weekly-review summary, for every user.

The app's own settings had been written for a much larger free tier and never
re-checked. A comment in the code still said "the free tier's ~1500/day":

- **500** calls a day across all users;
- **20** analyses plus **40** voice notes per user. One person's allowance was
  three times the whole app's real one.

## What the real limits are

Google publishes the numbers only inside AI Studio, per project. Read from it
on 4 October (free tier):

| Model | Per minute | Per day |
|---|---|---|
| Gemini 3.5 / 3.6 / 3.7 / 3.8 Flash, 3 Flash, 2.5 Flash | 5 | **20** |
| Gemini 3.5 Flash-Lite, 3.1 Flash-Lite | 15 | **500** |
| Gemma 4 (26B, 31B) | 30 | 14,400 |

AI Studio's usage chart also showed it had been close before. On several days
in September the main model peaked at about **20 requests**: the app's whole
real traffic, from two people. On the experiment day it read **43 of 20**,
because refused requests are counted too.

## Three things the error taught

**1. Failed attempts count.** During a Gemini overload, the experiment's own
retries were billed against the day like answered calls:

| Model (separate test project) | Answered | Attempts before the day ran out |
|---|---|---|
| Gemini 3.7 Flash | 4 | 21 |
| Gemini 3.8 Flash | 5 | 20 |

The app's retry loop was built for outages. It kept trying for up to a minute,
and with the attempt cap removed, the test suite counts **13 attempts** for one
analysis in a sustained overload. On the free tier, that let one analysis on a
bad Gemini day use up most of the app's daily AI for everyone.

**2. The quota resets at midnight Pacific, and the error's own retry hint is
wrong.** The refusal said "retry in 4h40m", which points at midnight UTC.
Measured: a key that had made 18 calls on 3 October (UTC) got exactly two more
just after midnight UTC, then another refusal saying "retry in 22h". Google's
documentation says per-day quotas reset at midnight Pacific, and that's what
the key did. In Dubai that's 11:00, or 12:00 in winter.

**3. The message text can't tell a daily refusal from a per-minute one.** The
experiment's first guard searched the error's wording for "PerDay" and stopped
a run on what was really a per-minute limit; the model answered again seconds
later. The only reliable signal is the structured `QuotaFailure` in the error
body, whose `quotaId` names the window.

## The two bugs it exposed

Both were real, user-visible, and a few hours of quota away from production:

1. **Every 429 showed "The AI service is busy right now. Try again in a
   minute."** That's true for a per-minute limit and false for hours when the
   day is gone.
2. **A daily refusal never tried the fallback model.** Every model has its own
   20, so a second model was a second full allowance, sitting unused.
   Rate-limit errors were deliberately not retried. The reasoning ("asking again
   inside a 60-second window makes it worse") is right for a per-minute limit
   and wrong for a daily one.

## What changed

- **The quota id decides, never the wording.** A 429 whose `quotaId` contains
  `PerDay` becomes its own error type.
  - Anything else, including a 429 with no structured details, is treated as
    per-minute: the cautious reading.
  - The new type is a subtype of the old one, so refunding the user's slot and
    the diagnostics endpoint behave exactly as before.
- **A model that's out moves the call on at once.** No backoff sleep, because
  the next model's quota is separate. A per-minute refusal does the same, but
  the refusing model is never asked again within that call.
- **Out-for-the-day models are remembered.** The server notes the model and
  skips it until midnight Pacific, re-checking at most every hour, so switching
  billing on mid-day heals by itself. If every model is out, the user gets the
  answer without a call to Google at all.
- **Attempts are capped per action:** 4 for an analysis, 3 for a voice note,
  2 for a review summary, as well as the existing time limit.
  - On a paid key a failed attempt costs nothing, so the cap is one dashboard
    setting (`MEAL_AI_MAX_ATTEMPTS`) to raise.
- **The fallback setting takes a list of models**, so each model added is
  another daily allowance.
- **The caps were sized from real usage, not guessed.**
  - The heaviest user's busiest days in their own data export were 10 analyses
    and 14 voice notes.
  - So the defaults are **12 analyses and 16 voice notes per user, 40 a day
    app-wide**.
  - A first proposal of 12 voice notes would have locked that user out on
    three real days. It was caught by checking the export before shipping.
- **The messages say when the AI comes back.** "The AI has reached its daily
  limit. It resets in about 5 hours; until then, enter macros manually." The
  time is relative, because the server can't know the reader's time zone, and
  both reset points are someone else's midnight.

Every new behaviour was written as a failing test first. Then each fix was
broken on purpose to confirm a test catches it:

| Deliberate breakage | Tests that caught it |
|---|---|
| Match the message text instead of the quota id | 2 |
| Don't move a daily refusal to the next model | 4 |
| Forget out-for-the-day models between calls | 3 |
| Trust midnight UTC (the error's own hint) | 5 |
| Remove the hourly re-check | 1 |
| Remove the attempt cap | 7 |

The attempt-cap breakage first **survived**: removing the cap from the loop
changed nothing, because it was also enforced in a second place. Breaking it
where the value comes from is what proved the tests.

## What this fix is not

- **It doesn't add capacity by itself.** It stops the app wasting the capacity
  it has, and tells users the truth when it runs out. Adding capacity means
  adding models to the chain, and **which models are good enough is an accuracy
  question**. That's being measured separately against the owner's real meals,
  including meals whose calories are known without any AI.
- **It doesn't switch on billing.** That decision stays with the owner: on
  hold until there's a monetization plan or real users are being turned away.
  When it happens, the guardrails are a prepaid balance with auto-reload off, a
  spend cap, these app caps, and a dedicated project.

## Three things worth remembering

1. **A limit you configured is not a limit you have.** The number that
   mattered was on the provider's dashboard all along; the one in the code was
   a memory of an older free tier.
2. **A failed request is still a request.** Retry logic built for outages
   spends quota fastest exactly when the provider is struggling.
3. **Read the error's structure, not its prose, and not its advice.** The
   wording couldn't tell a minute from a day, and the "retry in" figure pointed
   at the wrong midnight.

The day after the experiment used up the quota, the author logged a day's
meals with a different AI tool, because this app's AI was out. That's the
failure this fix exists to prevent for everyone else.
