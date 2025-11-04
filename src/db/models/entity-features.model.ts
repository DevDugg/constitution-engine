import {
  pgTable,
  text,
  date,
  jsonb,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

export const entityFeatures = pgTable(
  "entity_features",
  {
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    asOfDate: date("as_of_date").notNull(),
    features: jsonb("features").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.entityType, table.entityId, table.asOfDate],
    }),
  ]
);

export const entityFeaturesAsOfDateIndex = index(
  "entity_features_as_of_date_idx"
).on(entityFeatures.asOfDate);
