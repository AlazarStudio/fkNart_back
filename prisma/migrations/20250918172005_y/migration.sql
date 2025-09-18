-- CreateEnum
CREATE TYPE "public"."LineupRole" AS ENUM ('STARTER', 'SUBSTITUTE', 'RESERVE');

-- CreateEnum
CREATE TYPE "public"."FieldPosition" AS ENUM ('GK', 'RB', 'CB', 'LB', 'RWB', 'LWB', 'DM', 'CM', 'AM', 'RW', 'LW', 'SS', 'ST');

-- AlterTable
ALTER TABLE "public"."Match" ADD COLUMN     "guestCoach" TEXT,
ADD COLUMN     "guestFormation" TEXT,
ADD COLUMN     "homeCoach" TEXT,
ADD COLUMN     "homeFormation" TEXT;

-- AlterTable
ALTER TABLE "public"."Player" ALTER COLUMN "number" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."PlayerMatch" ADD COLUMN     "isCaptain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minutesIn" INTEGER,
ADD COLUMN     "minutesOut" INTEGER,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "position" "public"."FieldPosition",
ADD COLUMN     "role" "public"."LineupRole" NOT NULL DEFAULT 'STARTER';

-- CreateIndex
CREATE INDEX "PlayerMatch_matchId_role_order_idx" ON "public"."PlayerMatch"("matchId", "role", "order");

-- AddForeignKey
ALTER TABLE "public"."PlayerMatch" ADD CONSTRAINT "PlayerMatch_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlayerMatch" ADD CONSTRAINT "PlayerMatch_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
