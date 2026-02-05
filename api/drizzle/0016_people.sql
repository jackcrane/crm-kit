ALTER TYPE "entitlement" ADD VALUE IF NOT EXISTS 'people:read';
ALTER TYPE "entitlement" ADD VALUE IF NOT EXISTS 'people.financial:read';
ALTER TYPE "entitlement" ADD VALUE IF NOT EXISTS 'people.contact:read';
--> statement-breakpoint
CREATE TABLE "people" (
  "id" text PRIMARY KEY DEFAULT 'psn_' || replace(gen_random_uuid()::text, '-', ''),
  "applicationId" text NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
  "name" varchar(255) NOT NULL,
  "ltv" numeric(12,2),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "people_fields" (
  "id" text PRIMARY KEY DEFAULT 'fld_' || replace(gen_random_uuid()::text, '-', ''),
  "applicationId" text NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
  "title" varchar(255) NOT NULL,
  "icon" varchar(255),
  "entitlements" entitlement[] NOT NULL DEFAULT '{}'::entitlement[],
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "people_field_values" (
  "personId" text NOT NULL REFERENCES "people"("id") ON DELETE cascade,
  "fieldId" text NOT NULL REFERENCES "people_fields"("id") ON DELETE cascade,
  "value" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("personId", "fieldId")
);
--> statement-breakpoint
CREATE TABLE "people_email_addresses" (
  "id" text PRIMARY KEY DEFAULT 'pem_' || replace(gen_random_uuid()::text, '-', ''),
  "personId" text NOT NULL REFERENCES "people"("id") ON DELETE cascade,
  "address" varchar(320) NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  "notes" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "people_phone_numbers" (
  "id" text PRIMARY KEY DEFAULT 'phn_' || replace(gen_random_uuid()::text, '-', ''),
  "personId" text NOT NULL REFERENCES "people"("id") ON DELETE cascade,
  "number" varchar(64) NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  "notes" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
