-- Familles, parfums et decorations passent en base : le manager doit pouvoir
-- ajouter un parfum ou corriger un tarif sans mise a jour de l'application.

CREATE TABLE "FamilleGateau" (
    "id" SERIAL NOT NULL,
    "cle" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "parPersonneCentimes" INTEGER NOT NULL,
    "minimumParts" INTEGER,
    "formatsFixes" TEXT,
    "note" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 999,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FamilleGateau_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FamilleGateau_cle_key" ON "FamilleGateau"("cle");
CREATE INDEX "FamilleGateau_actif_idx" ON "FamilleGateau"("actif");

CREATE TABLE "OptionGateau" (
    "id" SERIAL NOT NULL,
    "genre" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "supplementCentimes" INTEGER NOT NULL DEFAULT 0,
    "ordre" INTEGER NOT NULL DEFAULT 999,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OptionGateau_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OptionGateau_genre_nom_key" ON "OptionGateau"("genre", "nom");
CREATE INDEX "OptionGateau_genre_actif_idx" ON "OptionGateau"("genre", "actif");
