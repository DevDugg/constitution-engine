CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"correlation_id" uuid NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"node" text NOT NULL,
	"policy_version" text NOT NULL,
	"inputs" jsonb NOT NULL,
	"output" jsonb NOT NULL,
	"autonomy_level" integer NOT NULL,
	"hash" text NOT NULL,
	"correlation_id" uuid NOT NULL,
	"prev_hash" text,
	"context_vec" vector(1536),
	"latency_ms" integer,
	"human_approver" uuid
);
--> statement-breakpoint
CREATE TABLE "outcomes" (
	"decision_id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metrics" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"doc" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_features" (
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"as_of_date" date NOT NULL,
	"features" jsonb NOT NULL,
	CONSTRAINT "entity_features_entity_type_entity_id_as_of_date_pk" PRIMARY KEY("entity_type","entity_id","as_of_date")
);
--> statement-breakpoint
CREATE TABLE "knowledge_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"summary" text NOT NULL,
	"summary_vec" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_variants_stats" (
	"variant" text PRIMARY KEY NOT NULL,
	"alpha" integer NOT NULL,
	"beta" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_type_ts_idx" ON "events" USING btree ("type","ts");--> statement-breakpoint
CREATE INDEX "decisions_node_ts_idx" ON "decisions" USING btree ("node","ts");--> statement-breakpoint
CREATE INDEX "decisions_policy_version_idx" ON "decisions" USING btree ("policy_version");--> statement-breakpoint
CREATE INDEX "outcomes_recorded_at_idx" ON "outcomes" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "policy_versions_name_created_at_idx" ON "policy_versions" USING btree ("name","created_at" desc);--> statement-breakpoint
CREATE INDEX "entity_features_as_of_date_idx" ON "entity_features" USING btree ("as_of_date");--> statement-breakpoint
CREATE INDEX "knowledge_snapshots_scope_period_end_idx" ON "knowledge_snapshots" USING btree ("scope","period_end" desc);