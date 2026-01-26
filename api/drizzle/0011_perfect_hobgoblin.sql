CREATE TYPE "invitation_status" AS ENUM('pending', 'accepted', 'rescinded');
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY DEFAULT 'inv_' || replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"applicationId" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"entitlements" text[] DEFAULT '{}'::text[] NOT NULL,
	"code" text NOT NULL,
	"status" invitation_status DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_applicationId_applications_id_fk" FOREIGN KEY ("applicationId") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_code_unique" ON "invitations" USING btree ("code");
