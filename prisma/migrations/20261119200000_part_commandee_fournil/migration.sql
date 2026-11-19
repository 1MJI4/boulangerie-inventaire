-- =====================================================================
-- R72 — Part des commandes clients sur la feuille du fournil (decision du
-- proprietaire, 19/11/2026). Le croissant a la pate d'amande et la couque au
-- chocolat double se font a partir du Croissant / de la Couque au chocolat :
-- leurs commandes augmentent la base, et l'historique doit le montrer
-- (« Prevu 48 + 16 commandes, Produit 64 »).
--
-- "Inventaire"."commandeAuto"     : pieces commandees dans l'application pour
--                                   ce produit et cette journee (derives compris).
-- "Inventaire"."plateauCommandes" : pieces a SORTIR EN PLUS pour ces commandes
--                                   (plateaux entiers partages entre sortes ;
--                                   0 si prises sur la vente normale).
--
-- Les deux sont RECALCULEES en entier par le serveur (src/lib/serveur/
-- partCommandee.ts) depuis les commandes non annulees : jamais saisies a la
-- main, jamais additionnees au fil de l'eau. NULL = jamais calcule.
-- "quantitePrevue" et "quantiteCommande" (le « + » tape par le manager) ne
-- changent pas de sens. Tout reste en PIECES (LOI 2).
--
-- AJOUT SIMPLE, NON DESTRUCTIF : deux colonnes nullables sans valeur par
-- defaut, un CHECK. Aucune donnee existante n'est modifiee.
--
-- Migration NOUVELLE : les precedentes ne sont JAMAIS modifiees.
--
-- Retour arriere (a la main, sur une copie d'abord) :
--   ALTER TABLE "Inventaire" DROP CONSTRAINT "Inventaire_part_commandee_positive";
--   ALTER TABLE "Inventaire" DROP COLUMN "plateauCommandes";
--   ALTER TABLE "Inventaire" DROP COLUMN "commandeAuto";
-- =====================================================================

ALTER TABLE "Inventaire" ADD COLUMN "commandeAuto" INTEGER;
ALTER TABLE "Inventaire" ADD COLUMN "plateauCommandes" INTEGER;

ALTER TABLE "Inventaire" ADD CONSTRAINT "Inventaire_part_commandee_positive"
  CHECK (
    ("commandeAuto" IS NULL OR "commandeAuto" >= 0)
    AND ("plateauCommandes" IS NULL OR "plateauCommandes" >= 0)
  );
