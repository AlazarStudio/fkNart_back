/*
  Warnings:

  - A unique constraint covering the columns `[playerId,matchId]` on the table `PlayerStat` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "PlayerStat_playerId_matchId_key" ON "public"."PlayerStat"("playerId", "matchId");
