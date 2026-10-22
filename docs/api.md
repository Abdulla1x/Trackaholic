[← Back to the README](../README.md)

# 🔌 API overview

59 paths. All of them require an `Authorization: Bearer <token>` header and operate
only on the caller's data, except these public ones: `/api/health`,
`/api/announcements`, `/api/auth/signup|login|google`, and
`/api/auth/forgot-password|reset-password`.

## Accounts

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create an account → JWT + user |
| POST | `/api/auth/login` | Log in → JWT + user |
| POST | `/api/auth/google` | Sign in or sign up with the ID token from Google's button → JWT + user. Matched on Google's account id, else links a verified email that already has an account; 401 bad token, 503 Google unreachable |
| GET | `/api/auth/me` | Current user (token check) |
| POST | `/api/auth/change-password` | Rotate password; revokes older tokens, returns a fresh one |
| POST | `/api/auth/forgot-password` | Email a reset link. Always 200, whether or not the address exists; 503 only when email isn't configured |
| POST | `/api/auth/reset-password` | Consume a link and set a new password; revokes every session |
| DELETE | `/api/auth/account` | Permanently delete the account and all its data; confirmed by the password, or by a fresh Google sign-in for an account without one |

## Meals, foods and sharing

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/meals` | List (optionally by `?date=`) / create meals |
| GET | `/api/meals/recent` | The most recent meal under each distinct name, for re-logging, with how many times each name was logged. `?demote_date=` sorts names already logged on that day to the end |
| PUT/DELETE | `/api/meals/{id}` | Edit or delete a meal |
| GET/POST | `/api/meal-templates` | List saved meals / save one (upsert by name) |
| DELETE | `/api/meal-templates/{id}` | Delete a saved meal template |
| GET/POST | `/api/foods` | The food library / save or update a food |
| PUT/DELETE | `/api/foods/{id}` | Rename and correct a saved food / remove it |
| POST | `/api/foods/{id}/normalize` | Rescale one food's macros to per 100 g, keeping its provenance |
| GET | `/api/foods/duplicates` | Pairs of saved foods that look like the same thing twice |
| GET | `/api/foods/search?q=` | Autocomplete over the local food library |
| GET | `/api/foods/reference?q=` | Generic foods from the five national tables, per 100 g, ranked |
| GET | `/api/foods/lookup?q=` | Open Food Facts search (normalized per serving) |
| GET | `/api/share/meal/{id}` | Encode one of your meals as a shareable code |
| GET | `/api/share/template/{id}` | Encode a saved meal as a shareable code |
| POST | `/api/share/decode` | Read a code back into an editable draft — no row is shared |

## AI

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/ai/analyze` | AI meal analysis from any of photo, audio, text (multipart) |
| POST | `/api/ai/transcribe` | Voice note (multipart audio) → editable text |
| PATCH | `/api/ai/analyses/{id}` | Link an analysis to the meal it was saved as |
| GET | `/api/ai/calibration` | How your corrections compare with the estimates — coverage, bias, sample size |
| GET | `/api/ai/status` | Provider health; `?probe=true` makes one live call and classifies the failure |

## Weight, trackers and planning

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/weights` | Weigh-in history / log one (upsert by date) |
| GET | `/api/weights/trend` | Smoothed trend line, latest trend weight, weekly rate and the goal-weight projection |
| DELETE | `/api/weights/{id}` | Delete a weigh-in |
| GET/POST | `/api/water` | One day's water (entries, total, derived goal) / log a drink |
| DELETE | `/api/water/{id}` | Remove one water entry (what the card's undo calls) |
| GET/POST/DELETE | `/api/steps` | One day's steps (count, goal, walking estimate, whether the account has ever logged any) / save it / clear it |
| POST | `/api/data/import/steps` | Import a step history from a two-column `date,steps` CSV; days already logged are kept |
| GET | `/api/supplements/day` | One day's doses: every scheduled slot and whether it was ticked |
| POST/DELETE | `/api/supplements/log` | Tick / un-tick one dose; both idempotent, both return the updated day |
| GET/POST | `/api/supplements` | The supplement list (paused ones included) / add one |
| PUT/DELETE | `/api/supplements/{id}` | Edit, pause or resume one / delete it and its check-offs |
| GET | `/api/plan/day` | One day's **effective** targets — the four numbers its rings are drawn against, after any plan |
| GET/POST | `/api/plan` | Upcoming plans / create one (validated as a set; refusals name every offending day) |
| DELETE | `/api/plan/{event_date}` | Cancel a plan, removing only the days it has not spent yet |
| GET | `/api/plan/surplus` | How far a finished day ran from its target, with what it was measured against |

## Review, settings and data

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/review` | The computed weekly review — eight checks, each with its own window and sample size |
| POST | `/api/review/summary` | An AI reading of those figures; nothing is stored |
| GET | `/api/analytics/daily` | Per-day totals + averages for a date range |
| GET/PUT | `/api/settings` | Daily goals, tracked-macro toggles, body profile, tracker goals, weigh-in reminder |
| GET | `/api/settings/targets` | BMI, BMR, measured-or-estimated TDEE, calorie + macro targets |
| POST | `/api/settings/targets/preview` | The target first-use setup would save, from its answers, without saving them |
| POST | `/api/settings/installed` | Record that the account has the app on a home screen (kept from the first call), so the browser stops offering it |
| GET | `/api/data/export` | CSV backup of every meal |
| POST | `/api/data/import` | Restore meals from CSV, with duplicate detection |
| GET | `/api/data/export/all` | Full JSON export of everything the account owns |
| POST | `/api/data/export/ticket` | A one-minute link to either export, for a phone to download without the login header |
| GET | `/api/data/export/file` | Follows that link: the CSV or the JSON as a download. Expired, tampered or pre-password-change links get a plain-text refusal |
| GET | `/api/announcements` | Committed release notes (the ones the pop-up may show, and the ones only What's new lists) + the status banner (public) |
| GET | `/api/health` | Liveness check (public). `?src=keepwarm` (cron-job.org) or `?src=homecron` (the home-machine cron) marks a request as a keep-warm ping |
| GET | `/api/admin/stats` | Usage metrics, the funnel and frozen retention, behind the `ADMIN_EMAILS` allowlist |
| GET | `/api/admin/users` | Per-account counts, presence and AI consumption; never meal or weight content |
| GET | `/api/admin/keep-warm` | Uptime, scheduler-ping counts and the ping window; in-memory, wiped at spin-down |
