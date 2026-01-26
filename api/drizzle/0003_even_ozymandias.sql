ALTER TABLE "applications" ALTER COLUMN "jwtValidityTime" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "jwtValidityTime" SET DEFAULT '1h';