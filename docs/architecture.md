[← Back to the README](../README.md)

# 🏗️ Architecture

```
┌─────────────────────┐         ┌──────────────────────┐        ┌─────────────────┐
│  React SPA / PWA    │  HTTP   │  FastAPI REST API    │        │ Open Food Facts │
│  Tailwind, Recharts ├────────►│  /api/auth /meals    ├───────►│  public API     │
│  Router, shadcn/ui  │ Bearer  │  /foods /ai ...      │  httpx │  (packaged)     │
└─────────────────────┘  JWT    │ + 5 food tables, in  │        └─────────────────┘
                                │   memory (26k foods) │
                                └──────┬────────┬──────┘
                                       │SQLAlchemy  google-genai ┌─────────────────┐
                                ┌──────▼──────┐ └───────────────►│ Gemini 3.6 Flash│
                                │  PostgreSQL │ users · meals    │ (meal analysis) │
                                │ (Neon)/SQLite│ foods · settings└─────────────────┘
                                └─────────────┘ ai_analyses     ┌─────────────────┐
                                        password_resets  httpx  │ Resend          │
                                                 └─────────────►│ (password reset)│
                                                                └─────────────────┘
```

```
Trackaholic
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, lifespan (fails fast on a missing JWT_SECRET)
│   │   ├── db.py                # SQLAlchemy engine + session dependency
│   │   ├── env.py               # env_int / env_float — one idiom for ~23 environment variables
│   │   ├── models.py            # ORM models: users, password_resets, meals, meal_templates, foods,
│   │   │                        #   weights, water_logs, steps, supplements, supplement_logs,
│   │   │                        #   calorie_plan_days, settings, ai_analyses
│   │   ├── schemas.py           # Pydantic request/response models
│   │   ├── auth/                # signup/login/me, Argon2 + JWT, current-user dependency
│   │   ├── rate_limit.py        # per-IP limits on the public auth routes
│   │   ├── upsert.py            # the check-then-insert race, handled once instead of at five sites
│   │   ├── calculations.py      # macro scaling, weight trend, BMR/TDEE/target math
│   │   ├── targets.py           # body profile → daily targets, and measured TDEE
│   │   ├── banking.py           # moving calories between days: the split, the floors, the sum rules
│   │   ├── calibration.py       # how far you move the AI's numbers — coverage, bias, sample sizes
│   │   ├── review.py            # the weekly review's arithmetic: eight checks, each with its own window
│   │   ├── share.py             # the meal-code codec (a self-contained payload; no table)
│   │   ├── announcements.py     # committed release notes + an env-var status banner
│   │   ├── reference_foods.py   # the national food tables: loaded once, searched and ranked in memory
│   │   ├── data/reference/      # one CSV per table (USDA, CoFID, Ciqual, AFCD, CNF) + NOTICE.md credits
│   │   ├── routers/             # auth, meals, meal_templates, share, foods, weights, analytics,
│   │   │                        #   settings, data (CSV/JSON), ai, water, steps, plan,
│   │   │                        #   supplements, review, announcements, admin
│   │   └── services/
│   │       ├── off_client.py    # Open Food Facts client
│   │       ├── meal_ai.py       # AI meal analysis (the only AI-provider-aware module)
│   │       └── email.py         # password-reset email (the only Resend-aware module)
│   ├── alembic/                 # database migrations (Postgres)
│   ├── scripts/                 # smoke_multiuser.py — the live two-account isolation check
│   │                            # reference/ — build_<table>.py per food table, and ranking_report.py
│   │                            # delete_account_by_email.py — ops: remove an account whose password is gone
│   │                            # compare_estimates.py — same photos through the real model in
│   │                            #   several variants (sizes, models), against its own noise
│   ├── tests/                   # pytest suite incl. auth + cross-tenant isolation
│   └── requirements.txt
├── frontend/
│   ├── tests/                   # node --test unit tests for DOM-free code (npm test), incl. the
│   │                            #   colour tokens against DESIGN.md and WCAG contrast in every theme
│   ├── components.json          # shadcn/ui CLI config: new components land in src/ui/
│   ├── public/theme-init.js     # applies the device's theme before the first paint (a file:
│   │                            #   the CSP blocks inline scripts)
│   └── src/
│       ├── api/client.ts        # typed API client
│       ├── auth/                # AuthContext + token storage (guarded against blocked localStorage)
│       ├── settings/            # SettingsContext — one settings fetch for the whole app
│       ├── appearance/          # AppearanceContext — this device's theme, style and palette
│       ├── analysis/            # AnalysisContext — the AI estimate, held for the whole session
│       │                        #   so it keeps running while you move around the app
│       ├── ui/                  # the app's components: shadcn/ui (Radix) restyled from
│       │                        #   DESIGN.md (button, chip, field, toast), the segmented
│       │                        #   gauge, rolling numbers, quiet blocks, rows and stats, skeletons, and icons
│       │                        #   (Phosphor + the weigh-in scale)
│       ├── theme.css            # DESIGN.md's colour tokens, 9 palettes × light/dark + Label;
│       │                        #   generated from DESIGN.md and tested against it
│       ├── components/
│       │   ├── shell/           # the app shell: tab bar, side rail, wordmark, which tab is current
│       │   ├── auth/            # the frame the four signed-out pages share
│       │   ├── today/           # Today: the calories band, date control, meal list, the
│       │   │                    #   weigh-in card, the tracker block, the review card
│       │   ├── progress/        # Progress: daily burn and its meters, "Looking back"
│       │   ├── log/             # the Log panel: its address (?log), start screen, saved and
│       │   │                    #   recent meals, the estimate's stages and result, the AI tips
│       │   ├── you/             # You's screens: SettingsScreen (one draft + Save bar + leave
│       │   │                    #   guard per screen), ItemSheet, Your data, food duplicates
│       │   ├── settings/        # the body and calorie-plan fields You's screens share
│       │   └── ...              # Layout, DailyTrackerCard, MealAnalyzer,
│       │                        #   FoodAutocomplete, ShareCodePanel
│       ├── hooks/               # useAudioRecorder (MediaRecorder voice notes), useWarmup,
│       │                        #   useHeldDelete (a meal's delete, held ten seconds for Undo),
│       │                        #   useUnlockMoment (a lock opening, marked once), ...
│       ├── lib/                 # dates, parse, limits (mirrors the server's bounds), units,
│       │                        #   chartTheme (one place for every recharts colour), libraryMatch,
│       │                        #   photoSize + photoDownscale (shrink photos before upload),
│       │                        #   analysisInputs (is a re-run of an estimate unchanged?),
│       │                        #   foodSources (source badges, credits, the edited-number rule),
│       │                        #   staleChunk (reload once when a deploy removed a page's code),
│       │                        #   mealRows + saveMeal (one meal arithmetic for the form and
│       │                        #   the AI result), aiGuidance (the hidden-extras question),
│       │                        #   motion (animation tokens), utils (cn, the class merger),
│       │                        #   today + weighIn + review (Today's arithmetic and rules),
│       │                        #   progress + weight + accuracy (Progress's range, trend and
│       │                        #   locks)
│       └── pages/               # Today, Day (the day in detail), Meal (one meal's screen),
│                                #   LogMeal (the panel's by-hand form), Progress, WeighIns,
│                                #   DailyTotals, WeeklyReview, AiAccuracy, Admin, WhatsNew,
│                                #   You + you/ (one screen per row), Setup, HowItWorks, and the four auth pages
├── docs/                        # the README's long sections (features, screenshots, install,
│                                #   architecture, development, deployment, API, data sources),
│                                #   the AI provider runbook, the Gemini EEA-region incident
│                                #   write-up, the photo-size A/B note, and the goal-setting rules
├── scripts/                     # check.sh (all six gates), dev.sh, review-changes.sh,
│                                #   dom-snapshot.mjs (the refactor DOM-diff harness)
├── screenshots/                 # light/ and dark/, each desktop/ + mobile/, used by docs/screenshots.md
├── .github/workflows/           # ci.yml (the same six gates), backup.yml (daily export)
├── .github/pull_request_template.md  # asks contributors to agree to CONTRIBUTING.md
├── legacy/                      # original Streamlit app (v1)
├── PRODUCT.md                   # what the product is, who it serves, and what it must keep true
├── DESIGN.md                    # the app's look, as shipped in the redesign: colour tokens, palettes, type
├── CONTRIBUTING.md              # how to contribute, and the licence terms for contributions
├── LICENSE                      # MIT
└── render.yaml                  # Render blueprint — documentation of intent, NOT synced with
                                 #   the dashboard, which is the source of truth for every value
```
