ALTER TABLE "locations" ADD COLUMN "closed_dates" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "flash_sales" ADD COLUMN "source" text DEFAULT 'otomatis' NOT NULL;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "art" jsonb;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "cta_label" text DEFAULT '' NOT NULL;