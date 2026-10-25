# Runbook: AI analysis is failing

Users report *"The AI service is temporarily unavailable"*, or any AI call failing.

`/api/health` is **not** an AI check — it returns `{"status":"ok"}` without touching
Google, and did so throughout both real outages. Start here instead.

---

## 1. Ask the server what's wrong

```bash
TOKEN=$(curl -s -X POST https://<api-host>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"..."}' | jq -r .access_token)

curl -s -H "Authorization: Bearer $TOKEN" \
  'https://<api-host>/api/ai/status?probe=true' | jq
```

`?probe=true` spends one real provider call (capped by `AI_PROBE_DAILY_LIMIT`, cached
60s process-wide). Drop it to see the model chain and SDK version for free.

Either way the answer carries `main_out` when the server already knows the main AI can't
estimate today: `daily_quota` (every model in the analysis chain is out for the day) or
`app_limit` (`AI_GLOBAL_DAILY_LIMIT` is used up), with `back_at` and whether the lighter AI
can take an estimate (`lighter`). That is what makes the Log panel offer the lighter AI
before anyone presses Estimate. It is this process's memory, so a restart empties it.

To include Google's own error text, set `MEAL_AI_STATUS_DETAIL=1` in the Render
dashboard, re-run, then **turn it back off** — signup is open, so any account can read it.

| `probe.status` | What it means | What to do |
|---|---|---|
| `ok` | Provider is answering | The fault is elsewhere — check the frontend CSP (`vercel.json` `connect-src`) and `VITE_API_URL` |
| `upstream_5xx` | **Google returned 5xx.** Its outage, not yours | Usually transient and already retried + failed over. If sustained, switch `MEAL_AI_MODEL` to another generation in the dashboard |
| `unreachable` | Never got a reply: DNS, TCP, TLS, or our deadline | Check Render's status and outbound networking |
| `internal_error` | The SDK itself raised | Compare `sdk_version` and the build log's `pip` output against the last good deploy |
| `rejected` | Key, model id, or region | **Read `message`** — it's the only thing that separates them (see §3) |
| `rate_limited` | A 429 on the **first** model: per-minute or per-day quota | Read the logs for `Gemini daily quota exhausted` (per-day) vs `Gemini rejected the request … code=429` (per-minute). The probe never falls back, so the app may still be answering on a fallback. Real limits: [aistudio.google.com/rate-limit](https://aistudio.google.com/rate-limit) |
| `not_configured` | `GEMINI_API_KEY` empty or removed | Re-set it in the dashboard |
| `quota_exhausted` | You've used today's probe allowance | Raise `AI_PROBE_DAILY_LIMIT`, or read the logs below |

## 2. Render logs

Filter Application logs on `Gemini`. Every branch logs a distinct string.

| Log line | Cause | How the traceback looks |
|---|---|---|
| `Gemini server error` | **Google 5xx** | Leaf is `google.genai.errors.ServerError: 503 UNAVAILABLE ... 'The model is overloaded'`; frames end in `_api_client.py` |
| `Gemini unreachable` | **Our network** | Leaf is an `httpx.*` type — `ConnectError` (DNS/refused), `ConnectTimeout`, `ReadTimeout` (our own deadline) — or `ssl.SSLCertVerificationError`. Nested `socket.gaierror: [Errno -2]` means DNS. `kind=` names it without reading the stack |
| `Gemini call raised an unexpected error` | **Dependency drift** | Leaf is `TypeError`/`AttributeError`/`ImportError`/pydantic `ValidationError`, and **every frame is inside `site-packages/google/genai/`** with none of ours. See §4 |
| `Gemini rejected the request` + `code=…` | **Key / model / region** | `ClientError`; read the message (§3) |
| `Retrying Gemini in …` | Retries firing; frequency tracks provider health | — |
| `Gemini daily quota exhausted (model=…, quota=…, resets_at=…)` | **That model's per-day quota is spent** (free tier: 20/day per model, failed attempts included). It is skipped until `resets_at` (midnight Pacific), re-checked hourly | Nothing, if a fallback answered. If they all ran out, see the next row |
| `Every Gemini model is out of quota for the day; not calling` | The whole chain is out; users see "resets in about N hours" | Wait for midnight Pacific (11:00 Dubai in summer time, 12:00 in winter), add a model to `MEAL_AI_FALLBACK_MODEL`, or turn billing on. **A restart clears the memory**, and so does the hourly re-check |
| `Gemini … refused (…); trying … now` | A 429 moved the call straight to the next model | — |
| `Gemini model not found (model=…): skipping it` | **Google no longer serves that model id to this project** (retired, or "no longer available to new users"; `gemini-2.5-flash` already is for new projects). The call carries on with the rest of the chain, and the model is re-asked hourly | Replace it in `MEAL_AI_MODEL` / `MEAL_AI_FALLBACK_MODEL`, and in `MEAL_AI_TRANSCRIBE_MODELS` / `MEAL_AI_REVIEW_MODELS` if set; Google's message, quoted in the line, usually names a successor |
| `No configured Gemini model is served to this project; not calling` | **Every model in the chain 404s.** Users see "AI analysis is misconfigured" | Set `MEAL_AI_MODEL` to a served model now (or the failing kind's `MEAL_AI_*_MODELS`); no reset will fix this |
| `Not retrying Gemini: Ns of budget left …, under the Ns an attempt needs` | Attempts to spare, but not enough time for one to answer, so none is started: it would still reach Google and spend a request. Expected on bad overload days, when refusals themselves take 2–30 s | — (the `Giving up` line follows) |
| `Gemini busy and this may be the last try that fits (…); asking gemini-3.5-flash-lite instead of …` | A voice note's Flash model was busy, so its next try went to the backup at the end of its chain, while one still fits | — (an `answered (model=gemini-3.5-flash-lite …)` line should follow) |
| `Giving up on Gemini after …` | The retry budget was spent — the attempt cap (`MEAL_AI_MAX_ATTEMPTS`) or the deadline, whichever came first | On a paid key, raise `MEAL_AI_MAX_ATTEMPTS` and/or `MEAL_AI_DEADLINE_S` (and the frontend timeout with it). On the free tier, don't: refused attempts spend the per-day quota |

Only the **final** attempt logs a full traceback; earlier ones log a one-line WARNING,
so an outage doesn't bury the decisive line under identical stacks.

## 3. Reading a `ClientError` (HTTP 400) message

All three of these are 400 — the status code cannot tell them apart, which is exactly
what made the July 2026 outage take three days.

| Message contains | Cause | Fix |
|---|---|---|
| `API key not valid` | Wrong or revoked key | Re-issue in AI Studio. `_env()` already strips whitespace/quotes, so a survivor is genuinely wrong |
| `is not found for API version` | Retired model id | Set `MEAL_AI_MODEL` to a current id — no deploy needed |
| `User location is not supported` | Server IP is in the EEA/UK/CH | Move the service outside those regions. See [`incident-2026-07-gemini-eea-region.md`](incident-2026-07-gemini-eea-region.md) |

A retired id does not always fail. On 2026-10-10 Google retired `gemini-3.5-flash` and
`gemini-3.7-flash` and began answering them with 3.6 and 3.8, with no error and nothing
in the logs, so the `model=` in a log line is the id that was asked for, not
necessarily the one that answered. Retirements are announced by email to the AI Studio
account; check those notices before trusting a pinned id.

## 4. Dependency drift

`render.yaml` runs `pip install -r requirements.txt` on every build. `google-genai`
declares its own dependencies as **ranges**, so a rebuild months later can resolve a
`pydantic` or `httpx` the pinned SDK has never run against — failing 100% of calls with
a `TypeError` from inside `site-packages`.

`backend/requirements.txt` now pins those transitives explicitly. If you bump
`google-genai`, bump them together and re-run the suite. To confirm drift as a cause,
diff the `Successfully installed …` line between the last good deploy and the current one.

## 5. What the app already does for you

Before escalating, note these are automatic:

- **Retry with backoff, within two budgets**: a deadline (`MEAL_AI_DEADLINE_S`, default
  60s) and an attempt cap (`MEAL_AI_MAX_ATTEMPTS`, defaults 4 / 4 / 2 for analysis /
  voice note / review). The cap exists because Google counts refused attempts against
  the per-day quota. Uncapped, one analysis in an overload made ~13 attempts, which is
  most of the free tier's 20 a day for the whole app.
- **A retry starts only if it has time to answer**: at least 20 s of the deadline left
  for an analysis, 10 s for a voice note or review (`*_MIN_ATTEMPT_S` in
  `services/meal_ai.py`). Measured 2026-10-04/05: answers took 9–23.5 s, while an
  overloaded model's refusals took 2–20 s (503) and 13–30 s (504). A running attempt is
  never cut short, because Google has already counted it.
- **Alternating model chain** (`MEAL_AI_FALLBACK_MODEL`, comma-separated, default
  `gemini-3.8-flash,gemini-2.5-flash`): attempt two already lands on another serving pool, since
  overload is per pool.
- **A chain per kind of call.** `MEAL_AI_MODEL` and `MEAL_AI_FALLBACK_MODEL` steer meal
  analysis only. Voice notes try `MEAL_AI_TRANSCRIBE_MODELS` (default 3.6 → 3.8 → 2.5 Flash →
  3.5 Flash-Lite). Lite is last in line but is asked as soon as a Flash model has been busy and
  only one more try may fit the 25 s budget, so a busy day still gets a transcript to edit. Before
  2026-10-25 two slow refusals spent the budget and Lite was never reached. The weekly review
  `MEAL_AI_REVIEW_MODELS` (default: 3.5 Flash-Lite alone, which has 500 free requests a day
  against Flash's 20; if Google ever stops serving it, the review's wording fails as
  "misconfigured" until this var names a served model, and the computed review still shows).
  The lighter AI's estimates try `MEAL_AI_LITE_MODELS` (default 3.5 Flash-Lite alone); set empty
  it keeps that default rather than borrowing the analysis chain. So when you swap a model during an
  outage, swap it in each chain that names it. `GET /api/ai/status` lists every chain under
  `chains`. A model out for the day is skipped by every kind, because Google's quota is per model.
- **The lighter AI, when the main AI is out.** When the analysis chain is out for the day,
  busy, or the app's shared 40 is spent, the Log panel offers an estimate from Flash-Lite, and
  only the user's yes sends one. It counts toward the user's `AI_DAILY_LIMIT` but not toward
  `AI_GLOBAL_DAILY_LIMIT`; it has its own ceiling, `AI_LITE_DAILY_LIMIT` (default 200 of
  Lite's 500 free requests a day, leaving the rest for the voice backup and the review).
  **`AI_LITE_DAILY_LIMIT=0` turns it off** without a deploy. Its rows are kind `analysis_lite`;
  /admin counts how often the offer was shown, used and declined.
- **A model Google no longer serves (404) leaves the chain** for the call and the next hour, and the
  next model is asked at once. Before 2026-10-05 a 404 on the fallback ended the call as
  "misconfigured" even while the primary was only busy.
- **A 429 is never retried on the same model.** It moves to the next model at once,
  since quotas are per model. A per-**day** 429 (read from the structured `quotaId`,
  never the message) also skips that model for later calls until midnight Pacific. The
  429's own `retryDelay` points at 00:00 UTC and is wrong. When every model is out,
  the user is told roughly when it resets.
- **Per-attempt request timeout**, so a hung provider fails fast instead of pinning a worker.

So a single user report of one failure is expected noise. Sustained failure across users
is what this runbook is for.
