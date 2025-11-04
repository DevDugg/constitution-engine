import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  vector,
  index,
} from "drizzle-orm/pg-core";

export const decisions = pgTable("decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  ts: timestamp("ts", { withTimezone: true }).defaultNow().notNull(),
  node: text("node").notNull(),
  policyVersion: text("policy_version").notNull(),
  inputs: jsonb("inputs").notNull(),
  output: jsonb("output").notNull(),
  autonomyLevel: integer("autonomy_level").notNull(),
  hash: text("hash").notNull(),
  correlationId: uuid("correlation_id").notNull(),
  prevHash: text("prev_hash"),
  contextVec: vector("context_vec", {
    dimensions: 1536,
  }),
  latencyMs: integer("latency_ms"),
  humanApprover: uuid("human_approver"),
});

export const decisionsNodeTsIndex = index("decisions_node_ts_idx").on(
  decisions.node,
  decisions.ts
);

export const decisionsPolicyVersionIndex = index(
  "decisions_policy_version_idx"
).on(decisions.policyVersion);
