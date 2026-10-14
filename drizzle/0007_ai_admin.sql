CREATE TABLE "advisor_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "advisor_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" text NOT NULL,
	"visitor_hash" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_briefs" (
	"day" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"narrative" text NOT NULL,
	"source" text NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_logs" ADD COLUMN "staff_id" integer;--> statement-breakpoint
ALTER TABLE "ai_logs" ADD COLUMN "door" text;--> statement-breakpoint
ALTER TABLE "ai_logs" ADD COLUMN "tools" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_logs" ADD COLUMN "warning" text;--> statement-breakpoint
CREATE INDEX "advisor_events_created_idx" ON "advisor_events" USING btree ("created_at","kind");--> statement-breakpoint
CREATE INDEX "ai_logs_staff_idx" ON "ai_logs" USING btree ("staff_id","created_at");