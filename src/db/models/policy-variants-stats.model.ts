import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

export const policyVariantsStats = pgTable("policy_variants_stats", {
  variant: text("variant").primaryKey(),
  alpha: integer("alpha").notNull(),
  beta: integer("beta").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
