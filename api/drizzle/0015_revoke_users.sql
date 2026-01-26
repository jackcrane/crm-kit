CREATE TYPE "user_status" AS ENUM ('active', 'revoked');
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" NOT NULL DEFAULT 'active';
