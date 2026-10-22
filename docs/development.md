[← Back to the README](../README.md)

# 🚀 Running locally

## 1. Backend (FastAPI)

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows  (source venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

**AI meal analysis (optional):** set `GEMINI_API_KEY` before starting the backend
(get a free key at [Google AI Studio](https://aistudio.google.com/apikey)):

```bash
GEMINI_API_KEY=your-key uvicorn app.main:app --reload --port 8000
```

Without a key the rest of the app works normally and the analyze endpoint returns
a clear 503. `MEAL_AI_MODEL` overrides the default model (`gemini-3.6-flash`).
Keep the key in your environment or an untracked `.env` — never commit it.

When AI analysis misbehaves, `GET /api/ai/status?probe=true` (authenticated) names
the cause — upstream outage, unreachable, misconfigured key, or quota — instead of
leaving you to read logs. See [`docs/runbook-ai-provider.md`](runbook-ai-provider.md).

Local development needs no database setup: with `DATABASE_URL` unset the backend
uses a repo-root SQLite file and creates the schema itself. Point `DATABASE_URL`
at Postgres (and set `JWT_SECRET`) for a production-like run — the schema is then
managed by Alembic (`alembic upgrade head`). All 23 env vars are documented in
[`backend/.env.example`](../backend/.env.example).

**Migrating from the single-user version:** the old `macros.db` isn't read by
the multi-user schema. Export your meals as CSV from the old app (or keep the
file), create an account, and use **You → Your data → Import meals**.

## 2. Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173 (the dev server proxies `/api` to the backend).

Or start both at once, with a throwaway database:

```bash
./scripts/dev.sh --fresh
```

**Adding a UI component.** `npx shadcn@latest add <name>` (from `frontend/`) puts it in `src/ui/`. Restyle it from `DESIGN.md` before using it: shadcn's default look is never shipped. If you add a `text-*` or `rounded-*` utility to `index.css` that is not a colour, add its name to `src/lib/utils.ts` as well; otherwise `cn()` treats it as a colour and drops the real colour beside it (`tests/cn.test.ts` checks this).

## Tests and gates

`scripts/check.sh` runs every pre-commit gate in one pass — the same six CI runs:

```bash
./scripts/check.sh              # all six
./scripts/check.sh --backend    # pytest + ruff only
./scripts/check.sh --frontend   # tsc + unit tests + oxlint + build only
```

| Gate | Command |
|---|---|
| backend tests | `venv/bin/python -m pytest -q` |
| backend lint | `ruff check app tests scripts` |
| frontend typecheck | `npx tsc --noEmit -p tsconfig.app.json` — `strict` **and** `noUncheckedIndexedAccess` |
| frontend unit tests | `npm test` — pure logic only, see below |
| frontend lint | `npm run lint` (oxlint) |
| frontend build | `npm run build` |

**The frontend's unit tests need no test framework.** `npm test` compiles
`frontend/tests/` with the project's own `tsc` (`tsconfig.test.json`) and runs the
output with Node's built-in `node --test`. Compiled rather than run as TypeScript
directly, because Node only strips types when it was built with TypeScript support
and distro builds are not. The price is that only DOM-free code can be tested this
way — which is why `lib/photoSize.ts` (the sizing decisions) is kept apart from
`lib/photoDownscale.ts` (the canvas work, covered by browser checks instead).

It deliberately does not stop at the first failure. `a && b && c` hides whether the
frontend is also broken once the backend fails, turning one fix-and-rerun cycle into
three; every gate runs, then a summary says which failed.

**Cross-tenant isolation is tested twice, deliberately.** `tests/test_isolation.py`
asserts it in-process (51 tests). `backend/scripts/smoke_multiuser.py` asserts it
against a *running* server — over a hundred live checks that sign up two accounts and
fire every verb at the other account's concrete row ids, which is the only version
that also covers routing, auth middleware and the deployed database:

```bash
cd backend
BASE_URL=http://localhost:8000 DATABASE_URL=... venv/bin/python scripts/smoke_multiuser.py
```

It removes both throwaway accounts when it finishes, **however it finishes** —
the cleanup is registered with `atexit`, not written at the end of the run, because
the runs that leave accounts behind are the ones that *failed*. Pass `--keep` to
inspect them instead; it then prints each email and its password.

For the one case that cannot go through the API — an account whose password is gone,
since `DELETE /api/auth/account` needs that account's own token and password —
`scripts/delete_account_by_email.py` does the same thing against the database. It is
a dry run unless given `--delete`, it never takes the connection string as an
argument, and it checks two separate claims afterwards: that the account is gone,
**and** that no rows of theirs are left under any of the twelve tables carrying a
`user_id`. Those are not the same claim — with SQLite's foreign keys off, the first
one passes while six tables keep their rows.

⚠️ **Set `DATABASE_URL` or the row-ownership half silently skips** and you get a
smaller, quieter pass. It also runs against the deployed URL — note that it leaves
its two throwaway accounts behind, so it is the wrong tool for probing production.

**Proving a refactor changed nothing.** `scripts/dom-snapshot.mjs` renders every
route with a signed-in, seeded account and dumps `document.body.innerHTML` with
every `class` attribute stripped. Run it on each branch and diff:

```bash
node scripts/dom-snapshot.mjs /tmp/snap-before   # on main
node scripts/dom-snapshot.mjs /tmp/snap-after    # on your branch
diff -ru /tmp/snap-before /tmp/snap-after
```

Stripping `class` is what makes it useful: a styling change passes, while a stray
wrapper `<div>`, a dropped attribute, a reordered sibling or a section that quietly
stopped rendering still fails. It needs a browser, so it is **not** part of
`check.sh`, and `playwright-core` is deliberately absent from `package.json` — it is
a local verification tool, not something the app ships, and CI has no reason to
download a browser to run `npm ci`. The one-time setup, including the no-root path
for the missing system libraries on Linux, is in the script's own header.

Browser-level checks beyond that diff are manual; backend tests do not catch
interaction bugs.
