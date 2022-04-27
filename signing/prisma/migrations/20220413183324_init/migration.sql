-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "to" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT E'',
    "value" TEXT NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);
