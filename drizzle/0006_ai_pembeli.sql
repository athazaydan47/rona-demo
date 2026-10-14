CREATE TABLE "ai_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"feature" text NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"feature" text NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"ok" boolean DEFAULT true NOT NULL,
	"error" text,
	"visitor_hash" text DEFAULT '' NOT NULL,
	"query" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_summaries" (
	"product_id" integer PRIMARY KEY NOT NULL,
	"review_hash" text NOT NULL,
	"review_count" integer NOT NULL,
	"summary" jsonb NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "source" text;--> statement-breakpoint
CREATE INDEX "ai_cache_expires_idx" ON "ai_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ai_logs_visitor_idx" ON "ai_logs" USING btree ("visitor_hash","feature","created_at");--> statement-breakpoint
CREATE INDEX "ai_logs_created_idx" ON "ai_logs" USING btree ("created_at");