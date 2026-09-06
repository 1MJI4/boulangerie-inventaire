-- Les prix des gateaux sur mesure sont des prix « a partir de », et ils
-- changent par tranche de personnes : un massepain coute plus cher a la part
-- pour 12 personnes que pour 40. Un seul tarif par famille ne suffit pas.
ALTER TABLE "FamilleGateau" ADD COLUMN "paliers" TEXT;

-- Quand le vendeur juge la commande complexe, elle doit etre confirmee.
ALTER TABLE "Commande" ADD COLUMN "gateauComplexe" BOOLEAN NOT NULL DEFAULT false;
