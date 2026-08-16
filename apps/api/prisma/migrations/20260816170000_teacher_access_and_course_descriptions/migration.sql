ALTER TABLE "User" ADD COLUMN "teacherId" TEXT;
ALTER TABLE "DanceGroup" ADD COLUMN "description" TEXT;

CREATE UNIQUE INDEX "User_teacherId_key" ON "User"("teacherId");

ALTER TABLE "User"
ADD CONSTRAINT "User_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
