# BUILD_PLAN.md

**Goal:** Ship a backend-only, memory-anchored, policy-driven AI governance MVP in **14 days** using **Bun + Express + TypeScript + PostgreSQL (+pgvector) + n8n + Vercel AI SDK**, deployable on **Railway**. Each task is atomic, includes exact commands, file paths, and verifications—no fluff.

**Assumptions**

- Repo: `gpt-gov` (rename if you want).
- OS: Unix-like shell available.
- You have a PostgreSQL instance (Railway or local) and an OpenAI API key.
- You’ll wire n8n (self-hosted or Cloud) to call your service webhooks.

---

## Stack & Prereqs

- **Runtime:** Bun 1.x
- **Server:** Express 5 + TypeScript
- **DB:** Postgres 15+ with `pgvector`
- **ORM:** Drizzle ORM (TS-first). (Swap for Prisma if you prefer.)
- **AI:** Vercel AI SDK (`ai`) + `@ai-sdk/openai` for embeddings/LLM
- **Jobs:** n8n (webhooks + scheduled crons)
- **Deploy:** Railway
- **Logs:** pino
- **Validation:** zod

---

# 14-Day Build Plan

> All commands run from repo root. Replace placeholders (`USER`, `PASS`, `HOST`, `DB`) in connection strings.

---

## Day 1 — Project Bootstrap (Bun + TS + Express)

**Actions**

1. Init project

```bash
mkdir gpt-gov && cd gpt-gov
bun init -y
```

2. TypeScript config

```bash
bun add -d typescript @types/node tsx
bun x tsc --init --rootDir src --outDir dist --esModuleInterop --resolveJsonModule --moduleResolution node --skipLibCheck true
```

3. Install runtime deps

```bash
bun add express pino zod dotenv
```

4. Scaffold directories & env

```bash
mkdir -p src/{routes,core,config,db,jobs}
printf 'PORT=3000\n' > .env.example && cp .env.example .env
```

5. Create files

- `src/config/env.ts` — load env, validate required vars (throw if missing).
- `src/server.ts` — Express app with JSON parser, `/health` route returning `{ ok: true }`.

6. Run dev

```bash
bun run --hot src/server.ts
curl -s localhost:3000/health
```

---

## Day 2 — PostgreSQL + Drizzle + pgvector

**Actions**

1. Install DB tooling

```bash
bun add drizzle-orm pg pgpool pgvector
bun add -d drizzle-kit
```

2. Set DB URL

```bash
echo 'DATABASE_URL=postgres://USER:PASS@HOST:5432/DB' >> .env
```

3. Drizzle config

```bash
cat > drizzle.config.ts << 'EOF'
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! }
} as const;
EOF
```

4. Create files

- `src/db/index.ts` — pg `Pool` + Drizzle instance, export `db`.
- `src/db/schema.ts` — define tables:
  - `events(id uuid pk, type text, ts timestamptz, actor text, correlation_id uuid, payload jsonb)`
  - `decisions(id uuid pk, node text, policy_version text, inputs jsonb, output jsonb, autonomy_level int, requires_human bool, human_approver uuid, latency_ms int, ts timestamptz, context_vec vector(1536))`
  - `outcomes(decision_id uuid pk refs decisions, recorded_at timestamptz, metrics jsonb)`
  - `policy_versions(id serial pk, name text, version text, doc jsonb, created_at timestamptz)`
  - `entity_features(entity_type text, entity_id text, as_of_date date, features jsonb, pk(entity_type,entity_id,as_of_date))`
  - `knowledge_snapshots(id serial pk, scope text, period_start date, period_end date, summary text, summary_vec vector(1536), created_at timestamptz)`

5. Enable pgvector

```bash
psql "$DATABASE_URL" -c 'CREATE EXTENSION IF NOT EXISTS vector;'
```

6. Generate & push schema

```bash
bun x drizzle-kit generate
bun x drizzle-kit push
```

---

## Day 3 — Append-only Events API

**Actions**

1. Create route

- `src/routes/events.ts` — POST `/events` accepts `{type, actor, correlationId?, payload}` (zod-validate), inserts into `events`, returns inserted row.

2. Wire routes

- Import/use router in `src/server.ts` at `/events`.

3. Verify

```bash
curl -X POST localhost:3000/events \
  -H 'content-type: application/json' \
  -d '{"type":"DiscountRequested","actor":"sales-node","payload":{"deal_id":"D1","deal_value":10000}}'
```

---

## Day 4 — Policy Engine v1 (Deterministic)

**Actions**

1. Policy types/loader

- `src/core/policy/types.ts` — define finance autonomy bands structure.
- `src/core/policy/loader.ts` — fetch latest row from `policy_versions` by `name`.

2. Seed initial policy

```bash
psql "$DATABASE_URL" -c "INSERT INTO policy_versions(name,version,doc) VALUES ('finance-constitution','1.0.0','{\"nodes\":{\"finance\":{\"authorities\":[{\"action\":\"approve_discount\",\"autonomy_bands\":[{\"level\":1,\"max_discount_pct\":0.05,\"min_margin_pct\":0.25},{\"level\":2,\"max_discount_pct\":0.12,\"min_margin_pct\":0.23},{\"level\":3,\"max_discount_pct\":0.15,\"min_margin_pct\":0.22}],\"escalation\":{\"if_outside\":\"CFO\"}}]}}}');"
```

3. Evaluator

- `src/core/policy/evaluator.ts` — pure function: inputs → compare against bands → return `{approved, discount_pct, autonomy_level, reason}`.

---

## Day 5 — Decisions API (Finance)

**Actions**

1. Create route

- `src/routes/decisions.ts` — POST `/decisions/finance` with `{deal_value, base_margin_pct, requested_discount_pct, customer_tier}`.
  - Load policy (loader).
  - Evaluate (evaluator).
  - Insert into `decisions` with `policy_version`, `autonomy_level`, `requires_human`, `latency_ms` (measure wall time).
  - Return inserted row.

2. Wire route

- `src/server.ts` → `app.use("/decisions", decisionsRouter)`

3. Verify

```bash
curl -X POST localhost:3000/decisions/finance \
  -H 'content-type: application/json' \
  -d '{"deal_value":12000,"base_margin_pct":0.31,"requested_discount_pct":0.08,"customer_tier":"A"}'
```

---

## Day 6 — Outcomes & n8n Ingest

**Actions**

1. Outcomes route

- `src/routes/outcomes.ts` — POST `/outcomes/:decisionId` upsert `{ metrics: json }` into `outcomes`.

2. n8n: Ingest flow

- HTTP Trigger → Function (normalize payload) → HTTP Request to `POST /events`.
- Store n8n flow as `flows/ingest.json` in repo.

3. Verify

```bash
curl -X POST localhost:3000/outcomes/<DECISION_ID> \
  -H 'content-type: application/json' \
  -d '{"metrics":{"won":true,"margin":0.24,"time_to_close_days":3}}'
```

---

## Day 7 — Embeddings & Vector Search (context_vec)

**Actions**

1. Install AI SDK

```bash
bun add ai @ai-sdk/openai
echo 'OPENAI_API_KEY=sk-...' >> .env
```

2. Embedding util

- `src/core/memory/embeddings.ts` — function to embed text via Vercel AI SDK (`text-embedding-3-small`), return `number[]`.

3. Decision indexer

- `src/core/memory/indexer.ts` — after inserting a decision: stringify `{inputs,output}` → embed → update `decisions.context_vec` with vector.

4. Similarity search helper

- `src/core/memory/similar.ts` — given current input, embed; SQL query: `ORDER BY context_vec <-> $1 LIMIT 3`.

5. Verify:

- Create 3–5 decisions with varied inputs; run similarity on a new request; ensure results are sensible.

---

## Day 8 — Context Assembler

**Actions**

1. Build assembler

- `src/core/memory/assembler.ts` — for node “finance”:
  - Load latest `knowledge_snapshots` for scope `finance-daily` (if any).
  - Compute `similar` via vector search (top-3).
  - Load current policy + version.
  - Return `{ policy, policyVersion, snapshot, similar }`.

2. Integrate

- In `/decisions/finance`, call assembler before evaluation; (evaluator may ignore for now, but store `inputs.context_used` in DB for audit).

3. Verify

- Log ms spent fetching snapshot + similar + policy; keep under 150ms locally.

---

## Day 9 — Daily Aggregator (Entity Features)

**Actions**

1. Aggregation SQL

- `src/jobs/aggregator.sql` — compute daily tiles: success rate, avg latency, avg margin (join `decisions`+`outcomes`).

2. Runner

- `src/jobs/aggregator.ts` — execute SQL; upsert into `entity_features` with `as_of_date = yesterday`.

3. Job endpoint

- `src/routes/jobs.ts` — POST `/jobs/aggregator/run` (protected by an internal token header).

4. n8n cron

- 06:00 daily → HTTP Request to `/jobs/aggregator/run`.

5. Verify

```bash
curl -X POST localhost:3000/jobs/aggregator/run -H 'x-internal-token: YOUR_TOKEN'
psql "$DATABASE_URL" -c 'select * from entity_features order by as_of_date desc limit 5;'
```

---

## Day 10 — Daily Distill (Knowledge Snapshots)

**Actions**

1. Distill job

- `src/jobs/distill.ts` — query yesterday’s finance decisions → craft summary prompt (bullets) → `ai.generateText` → insert `knowledge_snapshots(scope='finance-daily', period_start, period_end, summary)` + store `summary_vec`.

2. Endpoint + cron

- POST `/jobs/distill/run` (protected) and n8n cron at 06:10.

3. Verify

```bash
curl -X POST localhost:3000/jobs/distill/run -H 'x-internal-token: YOUR_TOKEN'
psql "$DATABASE_URL" -c 'select scope, period_start, period_end, left(summary,120) from knowledge_snapshots order by created_at desc limit 3;'
```

---

## Day 11 — Policy Variants + Router (Bandit A/B)

**Actions**

1. Insert variant

```bash
psql "$DATABASE_URL" -c "INSERT INTO policy_versions(name,version,doc) VALUES ('finance-constitution','1.1.B','{\"nodes\":{\"finance\":{\"authorities\":[{\"action\":\"approve_discount\",\"autonomy_bands\":[{\"level\":1,\"max_discount_pct\":0.05,\"min_margin_pct\":0.25},{\"level\":2,\"max_discount_pct\":0.10,\"min_margin_pct\":0.23},{\"level\":3,\"max_discount_pct\":0.15,\"min_margin_pct\":0.22}],\"escalation\":{\"if_outside\":\"CFO\"}}]}}}');"
```

2. Router

- `src/core/learning/bandit.ts` — Thompson Sampling (persisted tomorrow).
- Wrap `/decisions/finance` to choose between versions (A=1.0.0, B=1.1.B) and record chosen `policy_version`.

3. Verify

- Fire 100 requests; observe ~50/50 split initially.

---

## Day 12 — Outcomes → Rewards → Learn

**Actions**

1. Persistence for variants

- Create table `policy_variants_stats(variant text pk, alpha int, beta int, updated_at timestamptz)`.

2. Reward mapping

- `src/core/learning/reward.ts` — reward = `1` if `won == true && margin >= min_margin`, else `0`.

3. Update on outcome

- In `/outcomes/:decisionId`, look up decision’s `policy_version`; compute reward; update that variant’s `alpha/beta`.

4. Verify

- Post synthetic outcomes favoring B; query `policy_variants_stats` and ensure B’s `alpha` grows.

---

## Day 13 — Slack Adapter + Scorecards & Proposals

**Actions**

1. Slack client

```bash
bun add @slack/web-api
echo 'SLACK_BOT_TOKEN=xoxb-...' >> .env
```

2. Adapter

- `src/core/adapters/slack.ts` — `notify(channel: string, text: string)` using Slack Web API.

3. Scorecards

- `src/jobs/scorecards.ts` — join `decisions+outcomes` (yesterday), compute win rates per variant; if candidate beats baseline by threshold and `n >= min`, call Slack with a **promotion proposal** (include numbers).

4. Endpoint + cron

- POST `/jobs/scorecards/run` (protected) + n8n cron 06:20.

5. Verify

```bash
curl -X POST localhost:3000/jobs/scorecards/run -H 'x-internal-token: YOUR_TOKEN'
# Check Slack channel for message
```

---

## Day 14 — Hardening + Metrics + Deploy

**Actions**

1. Kill switches

- Create table `node_flags(node text pk, action text, enabled bool)`; check before evaluating `/decisions/finance`.

2. Tamper-evident chain

- Add columns `prev_hash text, hash text` to `decisions`; on insert, compute `hash = sha256(prev_hash || node || policy_version || inputs || output || ts)` (use crypto lib).

3. Policy publish

- POST `/policies/finance/publish` — accepts YAML/JSON, validates structure, inserts `policy_versions`.

4. Metrics

- GET `/metrics` — JSON with p50/p95 decision latency, error count, token usage, autonomy distribution.

5. Deploy to Railway

- Create new project → Postgres add-on → set `DATABASE_URL` + env keys.
- Build & start commands: `bun install && bun run --hot src/server.ts` (for dev) or transpile then `node dist/server.js`.
- Wire n8n cron webhooks to Railway URL.

6. E2E script

```bash
# 1) Create several discounts/decisions
for i in {1..10}; do
  curl -s -X POST "$RAILWAY_URL/decisions/finance" -H 'content-type: application/json' \
    -d '{"deal_value":10000,"base_margin_pct":0.30,"requested_discount_pct":0.08,"customer_tier":"A"}' >/dev/null
done

# 2) Post outcomes (simulate wins/losses)
# replace <DECISION_ID> with real IDs or write a tiny script to fetch & loop
# 3) Trigger daily jobs
curl -X POST "$RAILWAY_URL/jobs/aggregator/run" -H 'x-internal-token: YOUR_TOKEN'
curl -X POST "$RAILWAY_URL/jobs/distill/run" -H 'x-internal-token: YOUR_TOKEN'
curl -X POST "$RAILWAY_URL/jobs/scorecards/run" -H 'x-internal-token: YOUR_TOKEN'
```

---

## ENV Checklist

```
PORT=3000
DATABASE_URL=postgres://USER:PASS@HOST:5432/DB
OPENAI_API_KEY=sk-...
SLACK_BOT_TOKEN=xoxb-...
INTERNAL_JOB_TOKEN=...
NODE_ENV=production
```

---

## Quick Verifications

- Create Event

```bash
curl -XPOST localhost:3000/events -H 'content-type: application/json' \
 -d '{"type":"DiscountRequested","actor":"sales-node","payload":{"deal_id":"D1","deal_value":10000,"base_margin_pct":0.3,"requested_discount_pct":0.08}}'
```

- Get Decision

```bash
curl -XPOST localhost:3000/decisions/finance -H 'content-type: application/json' \
 -d '{"deal_value":10000,"base_margin_pct":0.30,"requested_discount_pct":0.08,"customer_tier":"A"}'
```

- Post Outcome

```bash
curl -XPOST localhost:3000/outcomes/<DECISION_ID> -H 'content-type: application/json' \
 -d '{"metrics":{"won":true,"margin":0.24,"time_to_close_days":2}}'
```

- Trigger Jobs

```bash
curl -XPOST localhost:3000/jobs/aggregator/run -H 'x-internal-token: YOUR_TOKEN'
curl -XPOST localhost:3000/jobs/distill/run -H 'x-internal-token: YOUR_TOKEN'
curl -XPOST localhost:3000/jobs/scorecards/run -H 'x-internal-token: YOUR_TOKEN'
```

- Health/Metrics

```bash
curl -s localhost:3000/health
curl -s localhost:3000/metrics | jq
```

---

## Needle-Mover Micro-Tasks (drop-in any day)

- **LRU cache policy**: Cache `loadFinancePolicy()`; measure cold vs warm latency.
- **Timeouts**: Wrap all LLM calls in `AbortController` @ 1500ms; log timeouts separately.
- **Idempotency**: Support `Idempotency-Key` on POST routes; store seen keys for 24h.
- **Replay**: `/decisions/replay?limit=50` — re-evaluate decisions against current policy; log diffs.
- **Shadow Mode**: Add `shadow=true` variant; evaluate but don’t act; compare outcomes for 24h.
- **Drift detection**: Daily check of requested vs approved discount by tier; Slack alert if delta > X%.
- **Escalation queue**: Table `escalations`; POST `/escalations/:id/approve`; write audit line.

---

**You now have a precise, 14-day execution map.** Build it line-by-line; when done, you’ll own a working, self-improving decision system with memory, metrics, and governance primitives—deployed and demoable.
