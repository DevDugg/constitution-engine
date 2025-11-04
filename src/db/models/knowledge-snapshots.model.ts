import { desc } from "drizzle-orm";
import {
  pgTable,
  text,
  date,
  timestamp,
  index,
  serial,
  vector,
} from "drizzle-orm/pg-core";

export const knowledgeSnapshots = pgTable(
  "knowledge_snapshots",
  {
    id: serial("id").primaryKey(),
    scope: text("scope").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    summary: text("summary").notNull(),
    summaryVec: vector("summary_vec", { dimensions: 1536 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("knowledge_snapshots_scope_period_end_idx").on(
      table.scope,
      desc(table.periodEnd)
    ),
  ]
);
