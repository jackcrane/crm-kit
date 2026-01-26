ALTER TYPE "invitation_status" ADD VALUE IF NOT EXISTS 'expired';
-- Legacy data backfill (if needed) should be run in a separate transaction
-- once the new enum value is committed to avoid Postgres enum restrictions.
