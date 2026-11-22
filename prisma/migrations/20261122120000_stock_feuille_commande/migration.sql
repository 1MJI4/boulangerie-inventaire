-- =====================================================================
-- Stock de la feuille de commande (proprietaire, 22/11/2026) : farines,
-- congele, sacs a pain, emballages, entretien. Liste PROPRE, separee de
-- "Produit" (invendus) et de "ProduitCatalogue" (LOI 10) : aucune cle ne
-- croise les mondes. Un comptage par article et par jour (quantite restante) ;
-- pas de ligne = pas encore compte (different de 0).
--
-- AJOUT SIMPLE, NON DESTRUCTIF : deux tables neuves + la liste de depart.
-- Retour arriere :
--   DROP TABLE "ComptageStock"; DROP TABLE "ArticleStock";
-- =====================================================================

CREATE TABLE "ArticleStock" (
  "id"        SERIAL PRIMARY KEY,
  "nom"       TEXT NOT NULL,
  "categorie" TEXT NOT NULL,
  "ordre"     INTEGER NOT NULL,
  "actif"     BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX "ArticleStock_nom_key" ON "ArticleStock"("nom");

CREATE TABLE "ComptageStock" (
  "id"        SERIAL PRIMARY KEY,
  "journee"   DATE NOT NULL,
  "quantite"  INTEGER NOT NULL,
  "compteLe"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "articleId" INTEGER NOT NULL,
  CONSTRAINT "ComptageStock_quantite_valide" CHECK ("quantite" BETWEEN 0 AND 100000),
  CONSTRAINT "ComptageStock_articleId_fkey" FOREIGN KEY ("articleId")
    REFERENCES "ArticleStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ComptageStock_articleId_journee_key" ON "ComptageStock"("articleId", "journee");
CREATE INDEX "ComptageStock_journee_idx" ON "ComptageStock"("journee");

INSERT INTO "ArticleStock" ("nom", "categorie", "ordre") VALUES
  ('Semoule baguettes (Baraka)', 'Farines et ingrédients', 10),
  ('Oumeyma/Princesse', 'Farines et ingrédients', 20),
  ('Natural impérial', 'Farines et ingrédients', 30),
  ('Alpha', 'Farines et ingrédients', 40),
  ('Levure Bruggeman', 'Farines et ingrédients', 50),
  ('S500 puratos', 'Farines et ingrédients', 60),
  ('Boscus Artipan', 'Farines et ingrédients', 70),
  ('Seigle', 'Farines et ingrédients', 80),
  ('Décor céréales graines', 'Farines et ingrédients', 90),
  ('Sucre', 'Farines et ingrédients', 100),
  ('Sucre P4 perlé', 'Farines et ingrédients', 110),
  ('Sel', 'Farines et ingrédients', 120),
  ('Sésames', 'Farines et ingrédients', 130),
  ('Son', 'Farines et ingrédients', 140),
  ('Semoule harcha', 'Farines et ingrédients', 150),
  ('Œufs', 'Farines et ingrédients', 160),
  ('Papier cuisson 40x60', 'Farines et ingrédients', 170),
  ('Papier cuisson 80x60', 'Farines et ingrédients', 180),
  ('Papier imprimante alimentaire', 'Farines et ingrédients', 190),
  ('Croissant chocolat', 'Congelé', 200),
  ('Croissant amande', 'Congelé', 210),
  ('Croquant noisette chocolat', 'Congelé', 220),
  ('Amande cerise', 'Congelé', 230),
  ('Maton', 'Congelé', 240),
  ('Mini pecan', 'Congelé', 250),
  ('Noix de pécan', 'Congelé', 260),
  ('Boule de Berlin', 'Congelé', 270),
  ('P1', 'Sacs à pain', 280),
  ('P2', 'Sacs à pain', 290),
  ('P4', 'Sacs à pain', 300),
  ('P6', 'Sacs à pain', 310),
  ('Petit pain', 'Sacs à pain', 320),
  ('Grand pain Carré', 'Sacs à pain', 330),
  ('Grand pain Rond', 'Sacs à pain', 340),
  ('1 baguette', 'Sacs à pain', 350),
  ('2 baguettes', 'Sacs à pain', 360),
  ('Sandwich', 'Sacs à pain', 370),
  ('Sac plastique', 'Emballages', 380),
  ('Bobines papier', 'Emballages', 390),
  ('Papier toilette', 'Emballages', 400),
  ('Carton 1000cc', 'Emballages', 410),
  ('Carton 2000cc', 'Emballages', 420),
  ('Pots de wraps de 12 oz', 'Emballages', 430),
  ('Touillettes à café.', 'Emballages', 440),
  ('Serviettes sandwiches', 'Emballages', 450),
  ('Rouleaux bancontact', 'Emballages', 460),
  ('Gants noirs taille L', 'Emballages', 470),
  ('Petit gobelet à café', 'Emballages', 480),
  ('Couvercle Petit gobelet à café', 'Emballages', 490),
  ('Moyen gobelet à café', 'Emballages', 500),
  ('Couvercle Moyen gobelet à café', 'Emballages', 510),
  ('Grand gobelet à café', 'Emballages', 520),
  ('Couvercle Grand gobelet à café', 'Emballages', 530),
  ('Emballage Salade bowl 750', 'Emballages', 540),
  ('Bidon liquide vaisselle + rinçage', 'Entretien', 550),
  ('Savon mains', 'Entretien', 560),
  ('Javel', 'Entretien', 570),
  ('Produit four', 'Entretien', 580),
  ('Rouleau film pvc 45cm', 'Entretien', 590),
  ('Aluminium 45cm', 'Entretien', 600)
ON CONFLICT ("nom") DO NOTHING;
