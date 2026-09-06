-- Journal des comptages : une ligne par passage du vendeur devant le produit.
CREATE TABLE "Releve" (
    "id"               SERIAL       NOT NULL,
    "journee"          DATE         NOT NULL,
    "quantiteRestante" INTEGER      NOT NULL,
    "releveA"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "produitId"        INTEGER      NOT NULL,

    CONSTRAINT "Releve_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Releve_produitId_journee_idx" ON "Releve"("produitId", "journee");
CREATE INDEX "Releve_journee_idx" ON "Releve"("journee");

ALTER TABLE "Releve" ADD CONSTRAINT "Releve_produitId_fkey"
  FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Heure du premier zero de la journee, tenue a jour a chaque releve.
ALTER TABLE "Inventaire" ADD COLUMN "rupturePremiereA" TIMESTAMP(3);
