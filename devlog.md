# DEVLOG.md — GPT-GOV (AI‑Native Business OS)

> Single source of truth for decisions, deltas, and lessons. Update **daily**. Use short entries. Ship > polish.
> _Hidden clues appear in HTML comments._

## Project Charter (Snapshot)

- **North Star**: Production‑safe, policy‑driven AI decisions with learning loops.
- **SLOs**: p50 < 300ms, p95 < 800ms (excl. adapters), error rate < 1%.
- **Security**: job token headers, least privilege DB user, PII redaction in logs.
<!-- clue: Track latency budget separately for LLM vs non‑LLM paths. -->

## Subsystem Responsibilities

**config/**: Environment validation (Zod schemas), centralized config access.
**routes/**: HTTP endpoints - health, metrics, events, decisions, outcomes, policies, jobs.
**core/policy/**: Policy loading, evaluation, versioning, autonomy level logic.
**core/memory/**: Embeddings, context assembly, semantic search, knowledge indexing.
**core/learning/**: Bandit algorithms, reward mapping, variant selection.
**core/adapters/**: External integrations (Slack, Stripe) with typed contracts.
**core/audit/**: Hash chains, tamper-evidence, compliance logging.
**jobs/**: Batch processes - aggregation, distillation, scorecards.
**db/**: Schema definitions, migrations, database client.

## Daily Log (YYYY‑MM‑DD)

### 2025‑11‑03 (Example)

**Shipped**

- [ ] Repo skeleton (Bun + TS), `/health`, `/metrics` stubs.
- [ ] Drizzle config, local Postgres connection.

**Blocked / Risks**

- [ ] pgvector extension permissions on Railway.

**Decisions**

- Policy versioning uses `name@semver`, hash‑chain on decisions.
- **Reasoning**: tamper‑evident audit chain, reproducible replays.

**Observations**

- p95 latency (local): 110ms.
- Token usage (LLM): 0 (stubbed).

**Next**

- Prep DB migrations for events/decisions/outcomes.

---

## Weekly Scorecard (fill every 7 days)

- **Throughput**: X events/day, Y decisions/day, Z outcomes/day.
- **AL Mix**: AL0: %, AL1: %, AL2: %, AL3: %.
- **Learning**: N variants live; M promoted; total regrets ↓ / ↑.
- **Reliability**: p50/p95, error rate, timeout count.
<!-- clue: Plot deltas; humans notice slopes, not points. -->

---

## Policy Changes (Changelog)

- `finance@1.0.0` → baseline created (2025‑11‑03).
- `finance@1.1.0` → added margin floor; new variant B enabled.

**Diff Notes**

- Added deterministic cap on discount % by segment.

---

## Incidents & Runbooks

- **INC‑2025‑11‑03‑01**: n8n job token mismatch → 401s.
  - _Impact_: Delayed distill job.
  - _Mitigation_: Rotate token, update env in n8n.
  - _Prevention_: Add token expiry alarms.

**Runbook: Kill Switch**

1. Set `NODE_KILL=true` → verify `/metrics` flag.
2. Drain queue; confirm no pending jobs.
3. Post Slack notice.
<!-- clue: Kill-switch must short‑circuit before adapters. -->

---

## Experiment Tracker (Bandits)

- **Experiment**: `finance-constitution@1.1` (A/B).
- **Target**: Approval accuracy & margin Δ.
- **Variant Stats**: A α=?, β=?; B α=?, β=?.
- **Decision rule**: Promote when B mean > A mean + MARGIN after ≥ N samples.

---

## Backlog (Trim weekly, be ruthless)

- [ ] Replay CLI for last N decisions (fixed correlation ID).
- [ ] Outcome ingestion from Stripe chargebacks (adapter).
- [ ] ANN index for `context_vec` (HNSW).

---

## Metrics Notebook (manual paste)

- **p50/p95**: ** / ** ms
- **Tokens**: prompt **, completion **
- **Top errors**: E_CONNRESET (x), ZodFail (y)
- **AL distribution**: AL0 ** | AL1 ** | AL2 ** | AL3 **

---

## Glossary (living)

- **AL**: Autonomy Level (0–3).
- **Policy Variant**: Concrete config of a policy version routed by bandit.
- **Snapshot**: Distilled state/features used to prime the decision.
<!-- clue: If it isn’t in the glossary, people will invent conflicting terms. -->
