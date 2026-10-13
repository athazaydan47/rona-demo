CREATE TABLE "staff_locations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "staff_locations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"staff_id" integer NOT NULL,
	"location_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_login_attempts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "staff_login_attempts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"ip_hash" text DEFAULT '' NOT NULL,
	"success" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "staff_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"token_hash" text NOT NULL,
	"staff_id" integer NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "actor_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "summary" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "location_id" integer;--> statement-breakpoint
ALTER TABLE "staff_locations" ADD CONSTRAINT "staff_locations_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_locations" ADD CONSTRAINT "staff_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_locations_staff_location_idx" ON "staff_locations" USING btree ("staff_id","location_id");--> statement-breakpoint
CREATE INDEX "staff_login_attempts_email_idx" ON "staff_login_attempts" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "staff_login_attempts_ip_idx" ON "staff_login_attempts" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_sessions_token_idx" ON "staff_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "staff_sessions_staff_idx" ON "staff_sessions" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "audit_logs_staff_idx" ON "audit_logs" USING btree ("staff_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action","created_at");--> statement-breakpoint
-- Data: lokasi staf cabang lama (kolom staff.location_id) disalin ke staff_locations. Akun lain tetap tanpa batas lokasi.
INSERT INTO "staff_locations" ("staff_id", "location_id")
SELECT s."id", s."location_id" FROM "staff" s JOIN "roles" r ON r."id" = s."role_id"
WHERE r."slug" = 'staf_cabang' AND s."location_id" IS NOT NULL
ON CONFLICT DO NOTHING;
