CREATE TYPE "public"."entitlement" AS ENUM('superuser', 'users:read', 'users:write', 'invitations:read', 'invitations:write', 'entitlements:read', 'entitlements:write');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('USER_CREATED', 'USER_LOGIN', 'PASSWORD_CHANGED', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'rescinded', 'expired');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" text PRIMARY KEY DEFAULT 'app_' || replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"name" varchar(255) NOT NULL,
	"jwtValidityTime" text DEFAULT '1h' NOT NULL,
	"cfTurnstileSiteKey" varchar(255),
	"cfTurnstileSecretKey" varchar(255),
	"loginAvailable" boolean DEFAULT true NOT NULL,
	"enforceTurnstile" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY DEFAULT 'evt_' || replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"userId" text NOT NULL,
	"applicationId" text NOT NULL,
	"type" "event_type" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY DEFAULT 'inv_' || replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"applicationId" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"entitlements" "entitlement"[] DEFAULT '{}'::entitlement[] NOT NULL,
	"code" text NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY DEFAULT 'usr_' || replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"applicationId" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"mfaEnabled" boolean DEFAULT false NOT NULL,
	"otpSecret" text,
	"entitlements" "entitlement"[] DEFAULT '{}'::entitlement[] NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_applicationId_applications_id_fk" FOREIGN KEY ("applicationId") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_applicationId_applications_id_fk" FOREIGN KEY ("applicationId") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_applicationId_applications_id_fk" FOREIGN KEY ("applicationId") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;