-- Un gateau de 13 parts se coupe mal. Le magasin doit pouvoir decourager --
-- ou interdire — ces tailles, et proposer celles qui se coupent proprement.
CREATE TABLE "Reglage" (
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Reglage_pkey" PRIMARY KEY ("cle")
);
