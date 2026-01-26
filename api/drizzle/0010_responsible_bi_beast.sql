ALTER TABLE "users" ADD COLUMN "entitlements" text[] DEFAULT '{}'::text[] NOT NULL;
