-- =====================================================================
-- Lot 2 — UNE ECRITURE PAR GATEAU (decision du proprietaire, 28/10/2026 :
-- « une ecriture par gateau sur le bon, ca doit etre clair quelle
-- ecriture pour quel gateau »).
--
-- L'ecriture, « pas d'ecriture » et la photo a imprimer deviennent des
-- donnees de la LIGNE (un gateau). La photo d'exemple envoyee sur WhatsApp
-- reste au niveau de la commande.
--
-- Ajout simple, NON DESTRUCTIF : trois colonnes nullables, SANS valeur par
-- defaut. Aucune colonne supprimee ni renommee : Commande.texteGateau,
-- Commande.sansEcriture et Commande.photoImprimee restent. Les lignes
-- existantes valent NULL : une commande ancienne se LIT comme l'ecriture
-- de son premier gateau (src/lib/commandes.ts, surLesGateaux), sans
-- reecriture massive.
--
-- Pas de contrainte ici : « une fois par gateau » (supplements Ecriture /
-- Photo) depend du tarif et du nombre de gateaux, juge par le domaine et
-- rejoue cote serveur (controlerSupplementEcriture, controlerSupplementPhoto).
--
-- Declencheurs existants sur "LigneCommande" : aucun ne lit ces colonnes.
--
-- Migration NOUVELLE : les precedentes sont deja appliquees et ne sont
-- JAMAIS modifiees apres coup.
-- =====================================================================

ALTER TABLE "LigneCommande" ADD COLUMN "texteGateau" TEXT;
ALTER TABLE "LigneCommande" ADD COLUMN "sansEcriture" BOOLEAN;
ALTER TABLE "LigneCommande" ADD COLUMN "photoImprimee" BOOLEAN;
