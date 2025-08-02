/*
  Warnings:

  - Changed the type of `birhDate` on the `Player` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "public"."Player" DROP COLUMN "birhDate",
ADD COLUMN     "birhDate" TIMESTAMP(3) NOT NULL;
