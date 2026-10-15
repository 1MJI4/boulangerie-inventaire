-- File d'impression reseau. Table nouvelle : rien d'existant n'est touche.
CREATE TABLE "TravailImpression" (
    "id" SERIAL NOT NULL,
    "commandeId" INTEGER,
    "numero" TEXT NOT NULL DEFAULT '',
    "destination" TEXT NOT NULL,
    "media" TEXT NOT NULL DEFAULT 'image/png',
    "contenu" BYTEA NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remisLe" TIMESTAMP(3),
    "imprimeLe" TIMESTAMP(3),
    "erreur" TEXT,

    CONSTRAINT "TravailImpression_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TravailImpression_statut_id_idx" ON "TravailImpression"("statut", "id");
CREATE INDEX "TravailImpression_commandeId_idx" ON "TravailImpression"("commandeId");
