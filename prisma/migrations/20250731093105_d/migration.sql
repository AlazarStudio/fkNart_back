/*
  Warnings:

  - Changed the type of `type` on the `MatchEvent` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "public"."MatchEvent" DROP COLUMN "type",
ADD COLUMN     "type" "public"."EventType" NOT NULL;
