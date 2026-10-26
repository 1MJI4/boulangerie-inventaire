-- =====================================================================
-- Galerie de photos modeles (decision du proprietaire, 26/10/2026) :
-- quand la vendeuse touche une photo dans l'ecran de commande, l'app
-- choisit le produit ET memorise l'identifiant de la photo (« G043 »,
-- « S005 » : une lettre majuscule + 3 chiffres). Le bon imprime
-- « Photo selectionnee : G043 ». La photo se rattache a une LIGNE (un
-- gateau), pas a la commande.
--
-- Ajout simple, NON DESTRUCTIF : une colonne TEXT nullable, SANS valeur
-- par defaut. Les lignes existantes valent NULL : historique intact.
--
-- Persistance (niveau 3) : seul le format de l'identifiant est controle.
-- Le CHECK ne verifie PAS que la photo existe dans la galerie : la
-- galerie est une donnee qui evolue (photo retiree, renumerotee) et une
-- commande passee doit garder l'identifiant choisi a l'epoque.
--
-- A NE PAS CONFONDRE avec "Commande"."photoWhatsapp" (photo envoyee par
-- le client) ni "Commande"."photoImprimee" (photo imprimee sur le gateau,
-- supplement) : ce sont deux booleens de la commande, sans rapport.
--
-- Declencheurs existants sur "LigneCommande" : aucun ne lit la colonne.
--
-- Migration NOUVELLE : les precedentes sont deja appliquees et ne sont
-- JAMAIS modifiees apres coup.
-- =====================================================================

ALTER TABLE "LigneCommande" ADD COLUMN "photoModele" TEXT;

-- Galerie (26/10/2026) — identifiant de photo modele : 1 majuscule + 3 chiffres, ou rien.
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_photoModele_format"
  CHECK ("photoModele" IS NULL OR "photoModele" ~ '^[A-Z][0-9]{3}$');

-- Verification apres deploiement (doit renvoyer 0) :
--   SELECT count(*) FROM "LigneCommande"
--   WHERE "photoModele" IS NOT NULL AND "photoModele" !~ '^[A-Z][0-9]{3}$';
--
-- Retour arriere (manuel, a ne lancer qu'apres retour du code precedent,
-- qui ne lit ni n'ecrit la colonne) :
--   ALTER TABLE "LigneCommande" DROP CONSTRAINT "LigneCommande_photoModele_format";
--   ALTER TABLE "LigneCommande" DROP COLUMN "photoModele";
--   DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261026120000_photo_modele';
-- Perte : l'identifiant de photo modele des lignes commandees entre-temps.
