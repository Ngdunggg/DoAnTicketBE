-- DropIndex
DROP INDEX IF EXISTS "idx_ticket_types_reservation_expires";

-- AlterTable
ALTER TABLE "ticket_types" DROP COLUMN IF EXISTS "reservation_expires_at";
