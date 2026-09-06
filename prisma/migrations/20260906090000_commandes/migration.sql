-- Module commandes : ajout pur, aucun modele existant n'est touche.

CREATE TABLE "Tarif" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "categorie" TEXT NOT NULL DEFAULT 'Autres',
    "prixCentimes" INTEGER NOT NULL,
    "poste" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 999,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeAuComptoir" BOOLEAN NOT NULL DEFAULT false,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tarif_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tarif_nom_key" ON "Tarif"("nom");
CREATE INDEX "Tarif_actif_idx" ON "Tarif"("actif");
CREATE INDEX "Tarif_categorie_idx" ON "Tarif"("categorie");

CREATE TABLE "Commande" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "client" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "vendeur" TEXT NOT NULL,
    "priseLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origine" TEXT NOT NULL DEFAULT 'comptoir',
    "retraitLe" DATE NOT NULL,
    "retraitHeure" TEXT NOT NULL,
    "modePaiement" TEXT NOT NULL DEFAULT 'especes',
    "acompteCentimes" INTEGER NOT NULL DEFAULT 0,
    "acompteRecuLe" TIMESTAMP(3),
    "totalCentimes" INTEGER NOT NULL DEFAULT 0,
    "texteGateau" TEXT,
    "photoWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "remarques" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'a_imprimer',
    "imprimeeLe" TIMESTAMP(3),
    "remiseLe" TIMESTAMP(3),
    "annuleeLe" TIMESTAMP(3),
    "motif" TEXT,
    "avertissements" TEXT,
    "archiveeLe" TIMESTAMP(3),
    "anonymiseeLe" TIMESTAMP(3),
    CONSTRAINT "Commande_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Commande_numero_key" ON "Commande"("numero");
CREATE UNIQUE INDEX "Commande_annee_sequence_key" ON "Commande"("annee", "sequence");
CREATE INDEX "Commande_retraitLe_idx" ON "Commande"("retraitLe");
CREATE INDEX "Commande_statut_idx" ON "Commande"("statut");
CREATE INDEX "Commande_anonymiseeLe_idx" ON "Commande"("anonymiseeLe");

CREATE TABLE "LigneCommande" (
    "id" SERIAL NOT NULL,
    "libelle" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixCentimes" INTEGER NOT NULL,
    "poste" TEXT,
    "precision" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "commandeId" INTEGER NOT NULL,
    "tarifId" INTEGER,
    CONSTRAINT "LigneCommande_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LigneCommande_commandeId_idx" ON "LigneCommande"("commandeId");

CREATE TABLE "EvenementCommande" (
    "id" SERIAL NOT NULL,
    "quand" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auteur" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "commandeId" INTEGER NOT NULL,
    CONSTRAINT "EvenementCommande_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EvenementCommande_commandeId_idx" ON "EvenementCommande"("commandeId");

ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_commandeId_fkey"
    FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_tarifId_fkey"
    FOREIGN KEY ("tarifId") REFERENCES "Tarif"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EvenementCommande" ADD CONSTRAINT "EvenementCommande_commandeId_fkey"
    FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;
