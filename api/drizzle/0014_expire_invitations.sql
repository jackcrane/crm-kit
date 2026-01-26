ALTER TYPE "invitation_status" ADD VALUE IF NOT EXISTS 'expired';
--> statement-breakpoint
-- Mark existing pending invitations older than 24 hours as expired
UPDATE "invitations"
SET "status" = 'expired', "updated_at" = now()
WHERE "status" = 'pending' AND "created_at" < now() - interval '24 hours';
