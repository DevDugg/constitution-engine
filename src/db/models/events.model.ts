import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  ts: timestamp("ts", { withTimezone: true }).defaultNow().notNull(),
  actor: text("actor").notNull(),
  correlationId: uuid("correlation_id").notNull(),
  payload: jsonb("payload").notNull(),
});

export const eventsTypeIndex = index("events_type_idx").on(
  events.type,
  events.ts
);
