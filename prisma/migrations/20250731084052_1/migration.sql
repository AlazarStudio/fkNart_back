/*
  Warnings:

  - You are about to drop the `LeagueStanding` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Match` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MatchEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Partner` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Photo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Player` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlayerStat` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Team` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Video` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."LeagueStanding" DROP CONSTRAINT "LeagueStanding_league_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."LeagueStanding" DROP CONSTRAINT "LeagueStanding_team_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."Match" DROP CONSTRAINT "Match_guest_team_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."Match" DROP CONSTRAINT "Match_home_team_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."Match" DROP CONSTRAINT "Match_league_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."MatchEvent" DROP CONSTRAINT "MatchEvent_assist_player_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."MatchEvent" DROP CONSTRAINT "MatchEvent_match_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."MatchEvent" DROP CONSTRAINT "MatchEvent_player_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."MatchEvent" DROP CONSTRAINT "MatchEvent_team_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."Photo" DROP CONSTRAINT "Photo_match_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."Player" DROP CONSTRAINT "Player_team_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."PlayerStat" DROP CONSTRAINT "PlayerStat_match_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."PlayerStat" DROP CONSTRAINT "PlayerStat_player_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."Video" DROP CONSTRAINT "Video_match_id_fkey";

-- DropTable
DROP TABLE "public"."LeagueStanding";

-- DropTable
DROP TABLE "public"."Match";

-- DropTable
DROP TABLE "public"."MatchEvent";

-- DropTable
DROP TABLE "public"."Partner";

-- DropTable
DROP TABLE "public"."Photo";

-- DropTable
DROP TABLE "public"."Player";

-- DropTable
DROP TABLE "public"."PlayerStat";

-- DropTable
DROP TABLE "public"."Team";

-- DropTable
DROP TABLE "public"."Video";

-- DropEnum
DROP TYPE "public"."EventType";

-- DropEnum
DROP TYPE "public"."MatchStatus";
