# Trackaholic

[![CI](https://github.com/Abdulla1x/Trackaholic/actions/workflows/ci.yml/badge.svg)](https://github.com/Abdulla1x/Trackaholic/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-REST%20API-009688?logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.14-blue?logo=python&logoColor=white)
![Postgres](https://img.shields.io/badge/Database-PostgreSQL-4169e1?logo=postgresql&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-pytest-brightgreen)
[![License](https://img.shields.io/badge/License-MIT-lightgrey)](LICENSE)

*Formerly **Macros Calculator**; renamed in October 2026, and moved from `macros-calculator-mu.vercel.app` to `trackaholic.app` the same month.*

**🔗 Live app: [trackaholic.app](https://trackaholic.app)** — sign up and start logging. (Free-tier hosting: the first request after idle can take ~30–60 s.)

**📖 The story: [story.trackaholic.app](https://story.trackaholic.app/?ref=gh-readme)** — how it got here, from a 2024 notepad to the redesign, with every screen along the way.

## Read more

| | |
|---|---|
| [All features](docs/features.md) | everything the app does, in detail |
| [Screenshots](docs/screenshots.md) | every screen, phone and desktop, light and dark |
| [Install it on your phone](docs/install.md) | iPhone, Android, desktop |
| [Architecture](docs/architecture.md) | how the frontend, API, database and AI fit together |
| [Running locally](docs/development.md) | setup, tests and the six CI gates |
| [Deployment](docs/deployment.md) | Neon, Render and Vercel, and keeping the free server awake |
| [API](docs/api.md) | every endpoint |
| [Data sources and credits](docs/data-sources.md) | the food tables, fonts and icons, and their licences |

---

## 🔍 Engineering notes

- [**AI meal analysis down for three days**](docs/incident-2026-07-gemini-eea-region.md) — a
  post-mortem. The feature failed for every input; the API key was valid, the model existed,
  and the deployed code worked fine from a laptop. Six hypotheses were eliminated before the
  real one: Gemini's free tier is geo-blocked in the EEA, and the backend was hosted in
  Frankfurt. Covers the diagnosis, the region migration, what remains unproven, and the two
  further failures the migration caused.
- [**Picking a photo size with an A/B instead of a hunch**](docs/photo-size-ab-2026-10.md) —
  the plan was to shrink photos to 1024 px because "the model downsamples anyway". Measured
  first: the AI bill turned out not to depend on photo size at all, and 1024 px shifted the
  model's estimates upward on every plate it changed. Covers the experiment design (run
  against the model's own run-to-run noise), why 1536 px shipped instead, and exactly what
  the numbers can and cannot claim.
- [**Setting a calorie target from sources, not round numbers**](docs/goal-setting-rules.md) —
  every rule behind a day-one target checked against a primary source before the first-use
  screens were built. Five proposed rules didn't survive and were replaced; the activity
  multipliers turned out to be a decades-old convention that set desk workers' targets too
  low; and four everyday gaps turned up, from a goal weight that changed nothing to typed
  macros that couldn't add up. Covers each rule with its source, three decisions in detail,
  how it's tested, and where a competitor is still ahead.

---

## 🤝 Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first: opening a pull
request means agreeing to its licence terms. Your contribution is MIT-licensed, and I may also
relicense it in the future.

---

## 👨‍💻 Author

**Abdulla** — [github.com/Abdulla1x](https://github.com/Abdulla1x)
