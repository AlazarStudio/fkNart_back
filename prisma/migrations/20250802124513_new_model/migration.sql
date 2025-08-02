/*
  Warnings:

  - You are about to drop the column `created_at` on the `PlayerStat` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `PlayerStat` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `PlayerStat` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."PlayerStat_playerId_key";

-- AlterTable
ALTER TABLE "public"."PlayerStat" DROP COLUMN "created_at",
DROP COLUMN "updated_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "public"."PlayerMatch" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "matchId" INTEGER NOT NULL,

    CONSTRAINT "PlayerMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerMatch_playerId_matchId_key" ON "public"."PlayerMatch"("playerId", "matchId");
