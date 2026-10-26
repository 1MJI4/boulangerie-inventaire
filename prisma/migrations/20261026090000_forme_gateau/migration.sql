-- =====================================================================
-- R63 (decision du proprietaire, 26/10/2026) : certains gateaux sur
-- commande (Bavarois, Creme fraiche, Entremet, Cake nature) portent une
-- FORME, 'carre' ou 'rond'. Valeur produite par le domaine
-- (src/domaine/formes.ts, LigneControlee.forme ; type `Forme`).
--
-- Ajout simple, NON DESTRUCTIF : une colonne TEXT nullable, SANS valeur
-- par defaut (la forme vient du domaine, la base ne la devine pas). Les
-- lignes existantes valent NULL : historique intact.
--
-- Persistance (LOI 3, niveau 3) : seules les deux valeurs du domaine sont
-- admises. Le CHECK ne decide PAS quand la forme est exigee (seuil 4-8
-- parts, carre d'office au-dessus) : cette regle est un REGLAGE du gerant
-- (ContexteCommande.formes), la figer ici bloquerait une correction
-- legitime. Elle est rejouee par le domaine cote serveur.
--
-- A ne pas confondre avec "formes" (Number Cake, texte libre, 22/10/2026).
--
-- Declencheurs existants sur "LigneCommande" : aucun ne lit la colonne.
--
-- Migration NOUVELLE : les precedentes sont deja appliquees et ne sont
-- JAMAIS modifiees apres coup.
-- =====================================================================

ALTER TABLE "LigneCommande" ADD COLUMN "forme" TEXT;

-- R63 — forme du gateau : 'carre' ou 'rond', ou rien.
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_forme_valide"
  CHECK ("forme" IS NULL OR "forme" IN ('carre', 'rond'));

-- Verification apres deploiement (doit renvoyer 0) :
--   SELECT count(*) FROM "LigneCommande"
--   WHERE "forme" IS NOT NULL AND "forme" NOT IN ('carre', 'rond');
--
-- Retour arriere (manuel, a ne lancer qu'apres retour du code precedent,
-- qui ne lit ni n'ecrit la colonne) :
--   ALTER TABLE "LigneCommande" DROP CONSTRAINT "LigneCommande_forme_valide";
--   ALTER TABLE "LigneCommande" DROP COLUMN "forme";
--   DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261026090000_forme_gateau';
-- Perte : la forme des gateaux commandes entre-temps.
