-- CreateTable
CREATE TABLE "Produit" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,

    CONSTRAINT "Produit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventaire" (
    "id" SERIAL NOT NULL,
    "dateInventaire" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantiteRestante" INTEGER NOT NULL,
    "quantiteProduite" INTEGER,
    "produitId" INTEGER NOT NULL,

    CONSTRAINT "Inventaire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Produit_nom_key" ON "Produit"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Inventaire_produitId_dateInventaire_key" ON "Inventaire"("produitId", "dateInventaire");

-- AddForeignKey
ALTER TABLE "Inventaire" ADD CONSTRAINT "Inventaire_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
