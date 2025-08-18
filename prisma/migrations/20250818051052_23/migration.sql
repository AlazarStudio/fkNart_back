/*
  Warnings:

  - You are about to drop the column `guestLineup` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `guestSubs` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `homeLineup` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `homeSubs` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `referees` on the `Match` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Match" DROP COLUMN "guestLineup",
DROP COLUMN "guestSubs",
DROP COLUMN "homeLineup",
DROP COLUMN "homeSubs",
DROP COLUMN "referees";
