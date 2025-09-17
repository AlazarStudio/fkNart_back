/*
  Warnings:

  - You are about to drop the column `matchId` on the `Referee` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."RefereeRole" AS ENUM ('MAIN', 'ASSISTANT1', 'ASSISTANT2', 'FOURTH', 'VAR', 'AVAR');

-- DropForeignKey
ALTER TABLE "public"."Referee" DROP CONSTRAINT "Referee_matchId_fkey";

-- AlterTable
ALTER TABLE "public"."Referee" DROP COLUMN "matchId";

-- CreateTable
CREATE TABLE "public"."MatchReferee" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "matchId" INTEGER NOT NULL,
    "refereeId" INTEGER NOT NULL,
    "role" "public"."RefereeRole",

    CONSTRAINT "MatchReferee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchReferee_matchId_refereeId_key" ON "public"."MatchReferee"("matchId", "refereeId");

-- AddForeignKey
ALTER TABLE "public"."MatchReferee" ADD CONSTRAINT "MatchReferee_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MatchReferee" ADD CONSTRAINT "MatchReferee_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "public"."Referee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
