import { pgTable, uuid, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { decisions } from "./decisions.model";

export const outcomes = pgTable("outcomes", {
  decisionId: uuid("decision_id")
    .references(() => decisions.id)
    .primaryKey(),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  metrics: jsonb("metrics").notNull(),
});

export const outcomesDecisionIdIndex = index("outcomes_decision_id_idx").on(
  outcomes.recordedAt
);
