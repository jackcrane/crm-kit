CREATE TYPE "public"."event_type" AS ENUM('USER_CREATED', 'USER_LOGIN', 'PASSWORD_CHANGED', 'SYSTEM');--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY DEFAULT 'evt_' || replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"userId" text NOT NULL,
	"type" "event_type" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY DEFAULT 'usr_' || replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;