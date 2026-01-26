ALTER TABLE "applications" ADD COLUMN "jwtValidityTime" interval DEFAULT '1h' NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "cfTurnstileSiteKey" varchar(255);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "cfTurnstileSecretKey" varchar(255);