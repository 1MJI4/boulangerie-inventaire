-- =====================================================================
-- R70 — Creme fraiche a la vanille ; un autre gout demande le code du
-- manager (decision du proprietaire, 17/11/2026). L'accord est trace sur la
-- ligne, comme l'accord de taille hors standard (LOI 11) :
--   "LigneCommande"."goutAutorisePar" : nom declare du manager
--   "LigneCommande"."goutAutoriseLe"  : heure SERVEUR de l'accord
--
-- AJOUT SIMPLE, NON DESTRUCTIF : deux colonnes nullables sans valeur par
-- defaut, deux CHECK (les deux ou aucun ; nom non vide). Les lignes
-- existantes valent NULL et passent les CHECK.
--
-- Migration NOUVELLE : les precedentes ne sont JAMAIS modifiees.
--
-- Retour arriere (a la main, sur une copie d'abord) :
--   ALTER TABLE "LigneCommande" DROP COLUMN "goutAutoriseLe",
--     DROP COLUMN "goutAutorisePar";   (les deux contraintes tombent avec)
-- =====================================================================

ALTER TABLE "LigneCommande" ADD COLUMN "goutAutorisePar" TEXT,
ADD COLUMN "goutAutoriseLe" TIMESTAMP(3);

ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_gout_trace"
  CHECK (("goutAutorisePar" IS NULL) = ("goutAutoriseLe" IS NULL));
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_gout_nom_non_vide"
  CHECK ("goutAutorisePar" IS NULL OR length(btrim("goutAutorisePar")) > 0);
