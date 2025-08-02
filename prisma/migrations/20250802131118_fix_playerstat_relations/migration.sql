-- DropForeignKey
ALTER TABLE "public"."PlayerStat" DROP CONSTRAINT "PlayerStat_matchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PlayerStat" DROP CONSTRAINT "PlayerStat_playerId_fkey";

-- AlterTable
ALTER TABLE "public"."PlayerStat" ALTER COLUMN "matchId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."PlayerStat" ADD CONSTRAINT "PlayerStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlayerStat" ADD CONSTRAINT "PlayerStat_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
