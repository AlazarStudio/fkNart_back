/*
  Warnings:

  - You are about to drop the column `matchId` on the `PlayerStat` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[playerId]` on the table `PlayerStat` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."PlayerStat" DROP CONSTRAINT "PlayerStat_matchId_fkey";

-- DropIndex
DROP INDEX "public"."PlayerStat_playerId_matchId_key";

-- AlterTable
ALTER TABLE "public"."PlayerStat" DROP COLUMN "matchId",
ADD COLUMN     "matchesPlayed" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "PlayerStat_playerId_key" ON "public"."PlayerStat"("playerId");
