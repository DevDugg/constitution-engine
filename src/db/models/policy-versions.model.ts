import { desc } from "drizzle-orm";
import {
  pgTable,
  timestamp,
  jsonb,
  index,
  serial,
  text,
} from "drizzle-orm/pg-core";
import type { PolicyDocument } from "../../core/policy/types";

export const policyVersions = pgTable(
  "policy_versions",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    doc: jsonb("doc").$type<PolicyDocument>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("policy_versions_name_created_at_idx").on(
      table.name,
      desc(table.createdAt)
    ),
  ]
);
