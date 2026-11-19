-- =====================================================================
-- Acompte obligatoire (decision du proprietaire, 19/11/2026) : une commande
-- SANS acompte n'est acceptee qu'avec le code du gerant. L'accord est trace
-- sur la commande, comme l'accord de remise :
--   "Commande"."sansAcompteAutorisePar" : nom declare du gerant
--   "Commande"."sansAcompteAutoriseLe"  : heure SERVEUR de l'accord
--
-- AJOUT SIMPLE, NON DESTRUCTIF : deux colonnes nullables sans valeur par
-- defaut, deux CHECK (les deux ou aucun ; nom non vide). Les commandes
-- existantes valent NULL et passent les CHECK. Aucune commande existante
-- n'est refusee : la regle « acompte obligatoire » vit dans le domaine et
-- ne s'applique qu'aux commandes creees ou modifiees a partir de maintenant.
--
-- Migration NOUVELLE : les precedentes ne sont JAMAIS modifiees.
--
-- Retour arriere (a la main, sur une copie d'abord) :
--   ALTER TABLE "Commande" DROP COLUMN "sansAcompteAutoriseLe",
--     DROP COLUMN "sansAcompteAutorisePar";   (les deux contraintes tombent avec)
-- =====================================================================

ALTER TABLE "Commande" ADD COLUMN "sansAcompteAutorisePar" TEXT,
ADD COLUMN "sansAcompteAutoriseLe" TIMESTAMP(3);

ALTER TABLE "Commande" ADD CONSTRAINT "Commande_sans_acompte_trace"
  CHECK (("sansAcompteAutorisePar" IS NULL) = ("sansAcompteAutoriseLe" IS NULL));
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_sans_acompte_nom_non_vide"
  CHECK ("sansAcompteAutorisePar" IS NULL OR length(btrim("sansAcompteAutorisePar")) > 0);
