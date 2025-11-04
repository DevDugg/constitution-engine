import { desc } from "drizzle-orm";
import {
  pgTable,
  timestamp,
  jsonb,
  index,
  serial,
  text,
} from "drizzle-orm/pg-core";

export const policyVersions = pgTable("policy_versions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  doc: jsonb("doc").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const policyVersionsNameCreatedAtIndex = index(
  "policy_versions_name_created_at_idx"
).on(policyVersions.name, desc(policyVersions.createdAt));
