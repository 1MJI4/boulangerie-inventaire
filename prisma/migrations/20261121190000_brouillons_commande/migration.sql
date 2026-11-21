-- =====================================================================
-- Brouillons de commande WhatsApp (21/11/2026) : commandes en attente de paiement.
-- AJOUT SIMPLE, NON DESTRUCTIF : une table neuve, rien d'existant touche.
-- Migration NOUVELLE : les precedentes ne sont JAMAIS modifiees.
-- Retour arriere : DROP TABLE "BrouillonCommande";
-- =====================================================================

CREATE TABLE "BrouillonCommande" (
  "id" SERIAL NOT NULL,
  "reference" TEXT NOT NULL,
  "statut" TEXT NOT NULL DEFAULT 'en_attente',
  "langue" TEXT NOT NULL DEFAULT 'fr',
  "client" TEXT NOT NULL,
  "telephone" TEXT NOT NULL,
  "retraitLe" DATE NOT NULL,
  "retraitHeure" TEXT,
  "totalCentimes" INTEGER NOT NULL,
  "corps" JSONB NOT NULL,
  "idClient" TEXT NOT NULL,
  "auteur" TEXT NOT NULL,
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "echeanceLe" TIMESTAMP(3) NOT NULL,
  "relanceLe" TIMESTAMP(3),
  "expireNotifieLe" TIMESTAMP(3),
  "commandeId" INTEGER,
  "confirmeLe" TIMESTAMP(3),
  "confirmePar" TEXT,
  CONSTRAINT "BrouillonCommande_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BrouillonCommande_statut_valide" CHECK ("statut" IN ('en_attente', 'confirme', 'abandonne')),
  CONSTRAINT "BrouillonCommande_langue_valide" CHECK ("langue" IN ('fr', 'en')),
  CONSTRAINT "BrouillonCommande_total_positif" CHECK ("totalCentimes" > 0)
);
CREATE UNIQUE INDEX "BrouillonCommande_reference_key" ON "BrouillonCommande"("reference");
CREATE UNIQUE INDEX "BrouillonCommande_idClient_key" ON "BrouillonCommande"("idClient");
CREATE INDEX "BrouillonCommande_statut_echeanceLe_idx" ON "BrouillonCommande"("statut", "echeanceLe");
