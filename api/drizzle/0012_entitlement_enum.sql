CREATE TYPE "entitlement" AS ENUM(
	'superuser',
	'users:read',
	'users:write',
	'invitations:read',
	'invitations:write'
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "entitlements" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "entitlements" TYPE entitlement[] USING "entitlements"::entitlement[];
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "entitlements" SET DEFAULT '{}'::entitlement[];
--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "entitlements" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "entitlements" TYPE entitlement[] USING "entitlements"::entitlement[];
--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "entitlements" SET DEFAULT '{}'::entitlement[];
