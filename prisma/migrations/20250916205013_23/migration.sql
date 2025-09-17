-- AlterTable
ALTER TABLE "public"."Match" ADD COLUMN     "stadiumId" INTEGER;

-- CreateTable
CREATE TABLE "public"."Stadium" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,

    CONSTRAINT "Stadium_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Referee" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "matchId" INTEGER NOT NULL,

    CONSTRAINT "Referee_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Referee" ADD CONSTRAINT "Referee_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_stadiumId_fkey" FOREIGN KEY ("stadiumId") REFERENCES "public"."Stadium"("id") ON DELETE SET NULL ON UPDATE CASCADE;
