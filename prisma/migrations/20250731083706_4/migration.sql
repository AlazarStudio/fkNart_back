/*
  Warnings:

  - You are about to drop the column `logo` on the `League` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."League" DROP COLUMN "logo",
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];
