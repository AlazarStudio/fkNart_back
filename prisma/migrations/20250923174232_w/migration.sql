-- AlterTable
ALTER TABLE "public"."News" ADD COLUMN     "videos" TEXT[] DEFAULT ARRAY[]::TEXT[];
