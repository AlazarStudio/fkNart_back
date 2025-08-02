/*
  Warnings:

  - You are about to drop the column `createdAt` on the `PlayerStat` table. All the data in the column will be lost.
  - You are about to drop the column `matchesPlayed` on the `PlayerStat` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `PlayerStat` table. All the data in the column will be lost.
  - Added the required column `matchId` to the `PlayerStat` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."PlayerStat" DROP CONSTRAINT "PlayerStat_playerId_fkey";

-- AlterTable
ALTER TABLE "public"."PlayerStat" DROP COLUMN "createdAt",
DROP COLUMN "matchesPlayed",
DROP COLUMN "updatedAt",
ADD COLUMN     "matchId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."PlayerStat" ADD CONSTRAINT "PlayerStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlayerStat" ADD CONSTRAINT "PlayerStat_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
