CREATE TABLE "order_number_counters" (
	"period" text PRIMARY KEY NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_status_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"actor" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "seen_price" integer;--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "seen_source" text;--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "carts" ADD COLUMN "voucher_code" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "order_id" integer;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "kind" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "normal_price" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "flash_sale_item_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_discount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "product_discount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "voucher_discount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pricing" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "access_token" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_status_history_order_idx" ON "order_status_history" USING btree ("order_id","created_at");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_flash_sale_item_id_flash_sale_items_id_fk" FOREIGN KEY ("flash_sale_item_id") REFERENCES "public"."flash_sale_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_order_idx" ON "notifications" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient","created_at");--> statement-breakpoint
CREATE INDEX "order_items_flash_idx" ON "order_items" USING btree ("flash_sale_item_id");