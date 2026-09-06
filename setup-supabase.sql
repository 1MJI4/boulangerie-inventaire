-- =====================================================================
-- Boulangerie - initialisation complete de la base Supabase
-- Mis a jour le 2026-09-06
--
-- A COLLER DANS : Supabase Dashboard > SQL Editor > New query > Run
--
--   1. cree les tables (inventaire + commandes + gateaux + reglages)
--   2. insere les 123 produits (categorie + poste compris)
--   3. enregistre les 12 migrations dans _prisma_migrations
--
-- Rejouable sans risque : rien n'est efface, aucun doublon cree.
-- Apres ce script, prisma migrate deploy ne doit plus rien a appliquer.
-- =====================================================================

-- ---------- tables inventaire ----------
CREATE TABLE IF NOT EXISTS "Produit" (
    "id"        SERIAL  NOT NULL,
    "nom"       TEXT    NOT NULL,
    "ordre"     INTEGER NOT NULL DEFAULT 999,
    "categorie" TEXT    NOT NULL DEFAULT 'Autres',
    "poste"     TEXT    NOT NULL DEFAULT 'boulanger',
    "actif"     BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Produit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Inventaire" (
    "id"               SERIAL  NOT NULL,
    "dateInventaire"   DATE    NOT NULL DEFAULT CURRENT_DATE,
    "quantiteRestante" INTEGER,
    "quantiteProduite" INTEGER,
    "quantitePrevue"   INTEGER,
    "quantiteCommande" INTEGER,
    "faitLe"           TIMESTAMP(3),
    "rupturePremiereA" TIMESTAMP(3),
    "produitId"        INTEGER NOT NULL,
    CONSTRAINT "Inventaire_pkey" PRIMARY KEY ("id")
);

-- colonnes ajoutees par les migrations successives (si les tables preexistaient)
ALTER TABLE "Produit"    ADD COLUMN IF NOT EXISTS "ordre" INTEGER NOT NULL DEFAULT 999;
ALTER TABLE "Produit"    ADD COLUMN IF NOT EXISTS "categorie" TEXT NOT NULL DEFAULT 'Autres';
ALTER TABLE "Produit"    ADD COLUMN IF NOT EXISTS "poste" TEXT NOT NULL DEFAULT 'boulanger';
ALTER TABLE "Produit"    ADD COLUMN IF NOT EXISTS "actif" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Inventaire" ADD COLUMN IF NOT EXISTS "quantitePrevue" INTEGER;
ALTER TABLE "Inventaire" ADD COLUMN IF NOT EXISTS "quantiteCommande" INTEGER;
ALTER TABLE "Inventaire" ADD COLUMN IF NOT EXISTS "faitLe" TIMESTAMP(3);
ALTER TABLE "Inventaire" ADD COLUMN IF NOT EXISTS "rupturePremiereA" TIMESTAMP(3);
ALTER TABLE "Inventaire" ALTER COLUMN "quantiteRestante" DROP NOT NULL;
-- Corrige un ancien DEFAULT CURRENT_TIMESTAMP sur une colonne DATE.
ALTER TABLE "Inventaire" ALTER COLUMN "dateInventaire" SET DEFAULT CURRENT_DATE;

CREATE UNIQUE INDEX IF NOT EXISTS "Produit_nom_key" ON "Produit"("nom");
CREATE UNIQUE INDEX IF NOT EXISTS "Inventaire_produitId_dateInventaire_key"
  ON "Inventaire"("produitId", "dateInventaire");
CREATE INDEX IF NOT EXISTS "Produit_ordre_idx" ON "Produit"("ordre");
CREATE INDEX IF NOT EXISTS "Produit_poste_idx" ON "Produit"("poste");
CREATE INDEX IF NOT EXISTS "Inventaire_dateInventaire_idx" ON "Inventaire"("dateInventaire");

DO $do$ BEGIN
  ALTER TABLE "Inventaire"
    ADD CONSTRAINT "Inventaire_produitId_fkey"
    FOREIGN KEY ("produitId") REFERENCES "Produit"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- Journal des comptages : une ligne par passage du vendeur devant le produit.
CREATE TABLE IF NOT EXISTS "Releve" (
    "id"               SERIAL       NOT NULL,
    "journee"          DATE         NOT NULL,
    "quantiteRestante" INTEGER      NOT NULL,
    "releveA"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "produitId"        INTEGER      NOT NULL,
    CONSTRAINT "Releve_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Releve_produitId_journee_idx" ON "Releve"("produitId", "journee");
CREATE INDEX IF NOT EXISTS "Releve_journee_idx" ON "Releve"("journee");

DO $do$ BEGIN
  ALTER TABLE "Releve"
    ADD CONSTRAINT "Releve_produitId_fkey"
    FOREIGN KEY ("produitId") REFERENCES "Produit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- ---------- tables commandes ----------
CREATE TABLE IF NOT EXISTS "Tarif" (
    "id"             SERIAL       NOT NULL,
    "nom"            TEXT         NOT NULL,
    "categorie"      TEXT         NOT NULL DEFAULT 'Autres',
    "prixCentimes"   INTEGER      NOT NULL,
    "poste"          TEXT,
    "ordre"          INTEGER      NOT NULL DEFAULT 999,
    "actif"          BOOLEAN      NOT NULL DEFAULT true,
    "creeAuComptoir" BOOLEAN      NOT NULL DEFAULT false,
    "modifieLe"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tarif_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Tarif_nom_key" ON "Tarif"("nom");
CREATE INDEX IF NOT EXISTS "Tarif_actif_idx" ON "Tarif"("actif");
CREATE INDEX IF NOT EXISTS "Tarif_categorie_idx" ON "Tarif"("categorie");

CREATE TABLE IF NOT EXISTS "Commande" (
    "id"              SERIAL       NOT NULL,
    "numero"          TEXT         NOT NULL,
    "annee"           INTEGER      NOT NULL,
    "sequence"        INTEGER      NOT NULL,
    "client"          TEXT         NOT NULL,
    "telephone"       TEXT         NOT NULL,
    "vendeur"         TEXT         NOT NULL,
    "priseLe"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origine"         TEXT         NOT NULL DEFAULT 'comptoir',
    "retraitLe"       DATE         NOT NULL,
    "retraitHeure"    TEXT         NOT NULL,
    "modePaiement"    TEXT         NOT NULL DEFAULT 'especes',
    "acompteCentimes" INTEGER      NOT NULL DEFAULT 0,
    "acompteRecuLe"   TIMESTAMP(3),
    "totalCentimes"   INTEGER      NOT NULL DEFAULT 0,
    "texteGateau"     TEXT,
    "sansEcriture"    BOOLEAN      NOT NULL DEFAULT false,
    "photoWhatsapp"   BOOLEAN      NOT NULL DEFAULT false,
    "photoImprimee"   BOOLEAN      NOT NULL DEFAULT false,
    "gateauComplexe"  BOOLEAN      NOT NULL DEFAULT false,
    "remarques"       TEXT,
    "statut"          TEXT         NOT NULL DEFAULT 'a_imprimer',
    "imprimeeLe"      TIMESTAMP(3),
    "remiseLe"        TIMESTAMP(3),
    "annuleeLe"       TIMESTAMP(3),
    "motif"           TEXT,
    "avertissements"  TEXT,
    "archiveeLe"      TIMESTAMP(3),
    "anonymiseeLe"    TIMESTAMP(3),
    CONSTRAINT "Commande_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Commande" ADD COLUMN IF NOT EXISTS "sansEcriture" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Commande" ADD COLUMN IF NOT EXISTS "photoImprimee" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Commande" ADD COLUMN IF NOT EXISTS "gateauComplexe" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "Commande_numero_key" ON "Commande"("numero");
CREATE UNIQUE INDEX IF NOT EXISTS "Commande_annee_sequence_key" ON "Commande"("annee", "sequence");
CREATE INDEX IF NOT EXISTS "Commande_retraitLe_idx" ON "Commande"("retraitLe");
CREATE INDEX IF NOT EXISTS "Commande_statut_idx" ON "Commande"("statut");
CREATE INDEX IF NOT EXISTS "Commande_anonymiseeLe_idx" ON "Commande"("anonymiseeLe");

CREATE TABLE IF NOT EXISTS "LigneCommande" (
    "id"           SERIAL  NOT NULL,
    "libelle"      TEXT    NOT NULL,
    "quantite"     INTEGER NOT NULL,
    "prixCentimes" INTEGER NOT NULL,
    "poste"        TEXT,
    "precision"    TEXT,
    "ordre"        INTEGER NOT NULL DEFAULT 0,
    "commandeId"   INTEGER NOT NULL,
    "tarifId"      INTEGER,
    CONSTRAINT "LigneCommande_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LigneCommande_commandeId_idx" ON "LigneCommande"("commandeId");

CREATE TABLE IF NOT EXISTS "EvenementCommande" (
    "id"         SERIAL       NOT NULL,
    "quand"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auteur"     TEXT         NOT NULL,
    "action"     TEXT         NOT NULL,
    "detail"     TEXT,
    "commandeId" INTEGER      NOT NULL,
    CONSTRAINT "EvenementCommande_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EvenementCommande_commandeId_idx" ON "EvenementCommande"("commandeId");

DO $do$ BEGIN
  ALTER TABLE "LigneCommande"
    ADD CONSTRAINT "LigneCommande_commandeId_fkey"
    FOREIGN KEY ("commandeId") REFERENCES "Commande"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  ALTER TABLE "LigneCommande"
    ADD CONSTRAINT "LigneCommande_tarifId_fkey"
    FOREIGN KEY ("tarifId") REFERENCES "Tarif"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  ALTER TABLE "EvenementCommande"
    ADD CONSTRAINT "EvenementCommande_commandeId_fkey"
    FOREIGN KEY ("commandeId") REFERENCES "Commande"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- ---------- tables gateaux / reglages ----------
CREATE TABLE IF NOT EXISTS "FamilleGateau" (
    "id"                  SERIAL       NOT NULL,
    "cle"                 TEXT         NOT NULL,
    "genre"               TEXT         NOT NULL DEFAULT 'gateau',
    "unite"               TEXT         NOT NULL DEFAULT 'personne',
    "libelle"             TEXT         NOT NULL,
    "parPersonneCentimes" INTEGER      NOT NULL,
    "minimumParts"        INTEGER,
    "formatsFixes"        TEXT,
    "paliers"             TEXT,
    "note"                TEXT,
    "ordre"               INTEGER      NOT NULL DEFAULT 999,
    "actif"               BOOLEAN      NOT NULL DEFAULT true,
    "modifieLe"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FamilleGateau_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FamilleGateau" ADD COLUMN IF NOT EXISTS "paliers" TEXT;
ALTER TABLE "FamilleGateau" ADD COLUMN IF NOT EXISTS "genre" TEXT NOT NULL DEFAULT 'gateau';
ALTER TABLE "FamilleGateau" ADD COLUMN IF NOT EXISTS "unite" TEXT NOT NULL DEFAULT 'personne';

CREATE UNIQUE INDEX IF NOT EXISTS "FamilleGateau_cle_key" ON "FamilleGateau"("cle");
CREATE INDEX IF NOT EXISTS "FamilleGateau_actif_idx" ON "FamilleGateau"("actif");

CREATE TABLE IF NOT EXISTS "OptionGateau" (
    "id"                 SERIAL       NOT NULL,
    "genre"              TEXT         NOT NULL,
    "nom"                TEXT         NOT NULL,
    "supplementCentimes" INTEGER      NOT NULL DEFAULT 0,
    "ordre"              INTEGER      NOT NULL DEFAULT 999,
    "actif"              BOOLEAN      NOT NULL DEFAULT true,
    "modifieLe"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OptionGateau_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OptionGateau_genre_nom_key" ON "OptionGateau"("genre", "nom");
CREATE INDEX IF NOT EXISTS "OptionGateau_genre_actif_idx" ON "OptionGateau"("genre", "actif");

CREATE TABLE IF NOT EXISTS "Reglage" (
    "cle"       TEXT         NOT NULL,
    "valeur"    TEXT         NOT NULL,
    "modifieLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reglage_pkey" PRIMARY KEY ("cle")
);

-- ---------- 123 produits ----------
INSERT INTO "Produit" ("nom", "ordre", "categorie", "poste") VALUES
  ('Pain marocain blanc', 10, 'Pains', 'boulanger'),
  ('Pain marocain gris', 20, 'Pains', 'boulanger'),
  ('Pain français', 30, 'Pains', 'boulanger'),
  ('Baguette blanche', 40, 'Pains', 'boulanger'),
  ('Baguette grise', 50, 'Pains', 'boulanger'),
  ('Baguette aux graines de sésame', 60, 'Pains', 'boulanger'),
  ('Baguette grise aux céréales', 70, 'Pains', 'boulanger'),
  ('Demi baguette grise aux céréales', 80, 'Pains', 'boulanger'),
  ('Pistolet blanc', 90, 'Pains', 'boulanger'),
  ('Pistolet gris', 100, 'Pains', 'boulanger'),
  ('Piccolo blanc', 110, 'Pains', 'boulanger'),
  ('Piccolo gris', 120, 'Pains', 'boulanger'),
  ('Grand pain blanc', 130, 'Pains', 'boulanger'),
  ('Petit pain blanc', 140, 'Pains', 'boulanger'),
  ('Grand pain gris', 150, 'Pains', 'boulanger'),
  ('Petit pain gris', 160, 'Pains', 'boulanger'),
  ('Grand pain demi gris', 170, 'Pains', 'boulanger'),
  ('Petit pain demi gris', 180, 'Pains', 'boulanger'),
  ('Grand pain aux 7 céréales', 190, 'Pains', 'boulanger'),
  ('Petit pain aux 7 céréales', 200, 'Pains', 'boulanger'),
  ('Grand pain au levain', 210, 'Pains', 'boulanger'),
  ('Petit pain au levain', 220, 'Pains', 'boulanger'),
  ('Grand pain seigle', 230, 'Pains', 'boulanger'),
  ('Petit pain seigle', 240, 'Pains', 'boulanger'),
  ('Grand campagne blanc', 250, 'Pains', 'boulanger'),
  ('Petit campagne blanc', 260, 'Pains', 'boulanger'),
  ('Grand campagne gris', 270, 'Pains', 'boulanger'),
  ('Petit campagne gris', 280, 'Pains', 'boulanger'),
  ('Grand campagne demi gris', 290, 'Pains', 'boulanger'),
  ('Petit campagne demi gris', 300, 'Pains', 'boulanger'),
  ('Grand campagne aux 7 céréales', 310, 'Pains', 'boulanger'),
  ('Petit campagne aux 7 céréales', 320, 'Pains', 'boulanger'),
  ('Pain artisanal blanc', 330, 'Pains', 'boulanger'),
  ('Pain artisanal gris', 340, 'Pains', 'boulanger'),
  ('Pain aux olives', 350, 'Pains', 'boulanger'),
  ('Ciabatta nature', 360, 'Pains', 'boulanger'),
  ('Ciabatta aux olives', 370, 'Pains', 'boulanger'),
  ('Pain italien (long, sésames)', 380, 'Pains', 'boulanger'),
  ('Pain espagnol', 390, 'Pains', 'boulanger'),
  ('Pain shawarma blanc', 400, 'Pains', 'boulanger'),
  ('Pain shawarma gris', 410, 'Pains', 'boulanger'),
  ('Bagnat blanc', 420, 'Pains', 'boulanger'),
  ('Bagnat gris', 430, 'Pains', 'boulanger'),
  ('Craquelin', 440, 'Pains', 'boulanger'),
  ('Cramique', 450, 'Pains', 'boulanger'),
  ('Brioche', 460, 'Pains', 'boulanger'),
  ('Brioche sucrée sésames', 470, 'Pains', 'boulanger'),
  ('Brioche sucrée crème', 480, 'Pains', 'boulanger'),
  ('Cougnou sucre', 490, 'Pains', 'boulanger'),
  ('Cougnou chocolat', 500, 'Pains', 'boulanger'),
  ('Cougnou raisin', 510, 'Pains', 'boulanger'),
  ('Msemen fromage', 520, 'Salé', 'traiteur'),
  ('Msemen fromage épinards', 530, 'Salé', 'traiteur'),
  ('Msemen kefta', 540, 'Salé', 'traiteur'),
  ('Msemen poulet', 550, 'Salé', 'traiteur'),
  ('Msemen épinards poulet', 560, 'Salé', 'traiteur'),
  ('Bestella poulet', 570, 'Salé', 'traiteur'),
  ('Briwate poulet', 580, 'Salé', 'traiteur'),
  ('Bestella poisson', 590, 'Salé', 'traiteur'),
  ('Cigare poisson', 600, 'Salé', 'traiteur'),
  ('Cigare fromage', 610, 'Salé', 'traiteur'),
  ('Romain fromage', 620, 'Salé', 'traiteur'),
  ('Quiche', 630, 'Salé', 'traiteur'),
  ('Morceau quiche', 640, 'Salé', 'traiteur'),
  ('Pizza', 650, 'Salé', 'traiteur'),
  ('Morceau pizza', 660, 'Salé', 'traiteur'),
  ('Lasagne bolognaise', 670, 'Salé', 'traiteur'),
  ('Lasagne saumon', 680, 'Salé', 'traiteur'),
  ('Salade poulet', 690, 'Salé', 'traiteur'),
  ('Salade saumon', 700, 'Salé', 'traiteur'),
  ('Salade thon', 710, 'Salé', 'traiteur'),
  ('Tacos poulet', 720, 'Salé', 'traiteur'),
  ('Wrap tenders', 730, 'Salé', 'traiteur'),
  ('Wrap marocain', 740, 'Salé', 'traiteur'),
  ('Battout healthy', 750, 'Salé', 'traiteur'),
  ('Mou healthy', 760, 'Salé', 'traiteur'),
  ('Msemen blanc', 770, 'Makla', 'patissier'),
  ('Msemen gris', 780, 'Makla', 'patissier'),
  ('Meloui', 790, 'Makla', 'patissier'),
  ('Grand Makla blanc', 800, 'Makla', 'patissier'),
  ('Grand Makla gris', 810, 'Makla', 'patissier'),
  ('Petit Makla blanc', 820, 'Makla', 'patissier'),
  ('Petit Makla gris', 830, 'Makla', 'patissier'),
  ('Battout blanc', 840, 'Makla', 'patissier'),
  ('Battout gris', 850, 'Makla', 'patissier'),
  ('Harcha smida', 860, 'Makla', 'patissier'),
  ('Harcha grise', 870, 'Makla', 'patissier'),
  ('Harcha céréales', 880, 'Makla', 'patissier'),
  ('Harcha lait', 890, 'Makla', 'patissier'),
  ('Baghrir', 900, 'Makla', 'patissier'),
  ('Sandwich mou', 910, 'Makla', 'patissier'),
  ('Beignet sucré', 920, 'Makla', 'patissier'),
  ('Beignet nature', 930, 'Makla', 'patissier'),
  ('Croissant', 940, 'Viennoiserie', 'patissier'),
  ('Couque au chocolat', 950, 'Viennoiserie', 'patissier'),
  ('Couque au beurre', 960, 'Viennoiserie', 'patissier'),
  ('Couque aux raisins', 970, 'Viennoiserie', 'patissier'),
  ('Croissant au chocolat', 980, 'Viennoiserie', 'patissier'),
  ('Croissant aux amandes', 990, 'Viennoiserie', 'patissier'),
  ('Torsade', 1000, 'Viennoiserie', 'patissier'),
  ('Couque suisse longue', 1010, 'Viennoiserie', 'patissier'),
  ('Couque suisse ronde', 1020, 'Viennoiserie', 'patissier'),
  ('Huit', 1030, 'Viennoiserie', 'patissier'),
  ('Noix de pécan', 1040, 'Viennoiserie', 'patissier'),
  ('Maton fromage', 1050, 'Viennoiserie', 'patissier'),
  ('Coque croquant amandes cerise', 1060, 'Viennoiserie', 'patissier'),
  ('Coque croquant noisettes chocolat', 1070, 'Viennoiserie', 'patissier'),
  ('Gosette pommes', 1080, 'Viennoiserie', 'patissier'),
  ('Gosette cerises', 1090, 'Viennoiserie', 'patissier'),
  ('Gosette abricot', 1100, 'Viennoiserie', 'patissier'),
  ('Feuilleté pommes', 1110, 'Viennoiserie', 'patissier'),
  ('Feuilleté poire', 1120, 'Viennoiserie', 'patissier'),
  ('Feuilleté abricot', 1130, 'Viennoiserie', 'patissier'),
  ('Mille feuille classique', 1140, 'Pâtisserie', 'patissier'),
  ('Mille feuille chocolat', 1150, 'Pâtisserie', 'patissier'),
  ('Mille feuille amande', 1160, 'Pâtisserie', 'patissier'),
  ('Éclair chocolat', 1170, 'Pâtisserie', 'patissier'),
  ('Éclair moka', 1180, 'Pâtisserie', 'patissier'),
  ('Éclair pistache', 1190, 'Pâtisserie', 'patissier'),
  ('Éclair framboise', 1200, 'Pâtisserie', 'patissier'),
  ('Éclair framboise fraise', 1210, 'Pâtisserie', 'patissier'),
  ('Couque à la crème', 1220, 'Pâtisserie', 'patissier'),
  ('Croissant à la crème', 1230, 'Pâtisserie', 'patissier')
ON CONFLICT ("nom") DO UPDATE SET
  "ordre"     = EXCLUDED."ordre",
  "categorie" = EXCLUDED."categorie",
  "poste"     = EXCLUDED."poste";

-- ---------- retrait des produits qui ne sont plus au catalogue ----------
-- Ceux qui ont un historique sont désactivés : ils disparaissent des écrans de
-- saisie mais leurs mois d'inventaire restent consultables.
UPDATE "Produit" SET "actif" = false
WHERE "nom" NOT IN (
  'Pain marocain blanc',
  'Pain marocain gris',
  'Pain français',
  'Baguette blanche',
  'Baguette grise',
  'Baguette aux graines de sésame',
  'Baguette grise aux céréales',
  'Demi baguette grise aux céréales',
  'Pistolet blanc',
  'Pistolet gris',
  'Piccolo blanc',
  'Piccolo gris',
  'Grand pain blanc',
  'Petit pain blanc',
  'Grand pain gris',
  'Petit pain gris',
  'Grand pain demi gris',
  'Petit pain demi gris',
  'Grand pain aux 7 céréales',
  'Petit pain aux 7 céréales',
  'Grand pain au levain',
  'Petit pain au levain',
  'Grand pain seigle',
  'Petit pain seigle',
  'Grand campagne blanc',
  'Petit campagne blanc',
  'Grand campagne gris',
  'Petit campagne gris',
  'Grand campagne demi gris',
  'Petit campagne demi gris',
  'Grand campagne aux 7 céréales',
  'Petit campagne aux 7 céréales',
  'Pain artisanal blanc',
  'Pain artisanal gris',
  'Pain aux olives',
  'Ciabatta nature',
  'Ciabatta aux olives',
  'Pain italien (long, sésames)',
  'Pain espagnol',
  'Pain shawarma blanc',
  'Pain shawarma gris',
  'Bagnat blanc',
  'Bagnat gris',
  'Craquelin',
  'Cramique',
  'Brioche',
  'Brioche sucrée sésames',
  'Brioche sucrée crème',
  'Cougnou sucre',
  'Cougnou chocolat',
  'Cougnou raisin',
  'Msemen fromage',
  'Msemen fromage épinards',
  'Msemen kefta',
  'Msemen poulet',
  'Msemen épinards poulet',
  'Bestella poulet',
  'Briwate poulet',
  'Bestella poisson',
  'Cigare poisson',
  'Cigare fromage',
  'Romain fromage',
  'Quiche',
  'Morceau quiche',
  'Pizza',
  'Morceau pizza',
  'Lasagne bolognaise',
  'Lasagne saumon',
  'Salade poulet',
  'Salade saumon',
  'Salade thon',
  'Tacos poulet',
  'Wrap tenders',
  'Wrap marocain',
  'Battout healthy',
  'Mou healthy',
  'Msemen blanc',
  'Msemen gris',
  'Meloui',
  'Grand Makla blanc',
  'Grand Makla gris',
  'Petit Makla blanc',
  'Petit Makla gris',
  'Battout blanc',
  'Battout gris',
  'Harcha smida',
  'Harcha grise',
  'Harcha céréales',
  'Harcha lait',
  'Baghrir',
  'Sandwich mou',
  'Beignet sucré',
  'Beignet nature',
  'Croissant',
  'Couque au chocolat',
  'Couque au beurre',
  'Couque aux raisins',
  'Croissant au chocolat',
  'Croissant aux amandes',
  'Torsade',
  'Couque suisse longue',
  'Couque suisse ronde',
  'Huit',
  'Noix de pécan',
  'Maton fromage',
  'Coque croquant amandes cerise',
  'Coque croquant noisettes chocolat',
  'Gosette pommes',
  'Gosette cerises',
  'Gosette abricot',
  'Feuilleté pommes',
  'Feuilleté poire',
  'Feuilleté abricot',
  'Mille feuille classique',
  'Mille feuille chocolat',
  'Mille feuille amande',
  'Éclair chocolat',
  'Éclair moka',
  'Éclair pistache',
  'Éclair framboise',
  'Éclair framboise fraise',
  'Couque à la crème',
  'Croissant à la crème'
);

-- Ceux qui n'ont jamais rien enregistré sont supprimés pour de bon.
DELETE FROM "Produit" p
WHERE p."nom" NOT IN (
  'Pain marocain blanc',
  'Pain marocain gris',
  'Pain français',
  'Baguette blanche',
  'Baguette grise',
  'Baguette aux graines de sésame',
  'Baguette grise aux céréales',
  'Demi baguette grise aux céréales',
  'Pistolet blanc',
  'Pistolet gris',
  'Piccolo blanc',
  'Piccolo gris',
  'Grand pain blanc',
  'Petit pain blanc',
  'Grand pain gris',
  'Petit pain gris',
  'Grand pain demi gris',
  'Petit pain demi gris',
  'Grand pain aux 7 céréales',
  'Petit pain aux 7 céréales',
  'Grand pain au levain',
  'Petit pain au levain',
  'Grand pain seigle',
  'Petit pain seigle',
  'Grand campagne blanc',
  'Petit campagne blanc',
  'Grand campagne gris',
  'Petit campagne gris',
  'Grand campagne demi gris',
  'Petit campagne demi gris',
  'Grand campagne aux 7 céréales',
  'Petit campagne aux 7 céréales',
  'Pain artisanal blanc',
  'Pain artisanal gris',
  'Pain aux olives',
  'Ciabatta nature',
  'Ciabatta aux olives',
  'Pain italien (long, sésames)',
  'Pain espagnol',
  'Pain shawarma blanc',
  'Pain shawarma gris',
  'Bagnat blanc',
  'Bagnat gris',
  'Craquelin',
  'Cramique',
  'Brioche',
  'Brioche sucrée sésames',
  'Brioche sucrée crème',
  'Cougnou sucre',
  'Cougnou chocolat',
  'Cougnou raisin',
  'Msemen fromage',
  'Msemen fromage épinards',
  'Msemen kefta',
  'Msemen poulet',
  'Msemen épinards poulet',
  'Bestella poulet',
  'Briwate poulet',
  'Bestella poisson',
  'Cigare poisson',
  'Cigare fromage',
  'Romain fromage',
  'Quiche',
  'Morceau quiche',
  'Pizza',
  'Morceau pizza',
  'Lasagne bolognaise',
  'Lasagne saumon',
  'Salade poulet',
  'Salade saumon',
  'Salade thon',
  'Tacos poulet',
  'Wrap tenders',
  'Wrap marocain',
  'Battout healthy',
  'Mou healthy',
  'Msemen blanc',
  'Msemen gris',
  'Meloui',
  'Grand Makla blanc',
  'Grand Makla gris',
  'Petit Makla blanc',
  'Petit Makla gris',
  'Battout blanc',
  'Battout gris',
  'Harcha smida',
  'Harcha grise',
  'Harcha céréales',
  'Harcha lait',
  'Baghrir',
  'Sandwich mou',
  'Beignet sucré',
  'Beignet nature',
  'Croissant',
  'Couque au chocolat',
  'Couque au beurre',
  'Couque aux raisins',
  'Croissant au chocolat',
  'Croissant aux amandes',
  'Torsade',
  'Couque suisse longue',
  'Couque suisse ronde',
  'Huit',
  'Noix de pécan',
  'Maton fromage',
  'Coque croquant amandes cerise',
  'Coque croquant noisettes chocolat',
  'Gosette pommes',
  'Gosette cerises',
  'Gosette abricot',
  'Feuilleté pommes',
  'Feuilleté poire',
  'Feuilleté abricot',
  'Mille feuille classique',
  'Mille feuille chocolat',
  'Mille feuille amande',
  'Éclair chocolat',
  'Éclair moka',
  'Éclair pistache',
  'Éclair framboise',
  'Éclair framboise fraise',
  'Couque à la crème',
  'Croissant à la crème'
)
AND NOT EXISTS (SELECT 1 FROM "Inventaire" i WHERE i."produitId" = p."id")
AND NOT EXISTS (SELECT 1 FROM "Releve" r WHERE r."produitId" = p."id");

-- ---------- historique des migrations Prisma ----------
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                  VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum"            VARCHAR(64) NOT NULL,
    "finished_at"         TIMESTAMPTZ,
    "migration_name"      VARCHAR(255) NOT NULL,
    "logs"                TEXT,
    "rolled_back_at"      TIMESTAMPTZ,
    "started_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

INSERT INTO "_prisma_migrations"
  ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
SELECT * FROM (VALUES
  (gen_random_uuid()::text, '198e939e227ccd86e22185956b84311b28785bd572b54da8b1e93ed5b7f20472', now(), '20251026193056_init', now(), 1),
  (gen_random_uuid()::text, 'dbcf0b53e3ed43ce812b2cda0c2e0fa2579adbe18879e196f949afedc030a10c', now(), '20251026200046_add_quantite_prevue', now(), 1),
  (gen_random_uuid()::text, '1abea4f6442c34102e8a4eb2393c1fee7d51f65bd8900f0ac330c9c1c6dff7ee', now(), '20251027200258_add_ordre_produits', now(), 1),
  (gen_random_uuid()::text, '1b1476841eff8cab727805181f2e49eab5ac3c7232b43e6e48c0163c5c127336', now(), '20260830210000_categories_postes_et_quantites_nullables', now(), 1),
  (gen_random_uuid()::text, 'cde5a0c4be6853588939ef29420f4a83087733f22aa45e98dac65c703ec29ea0', now(), '20260830230000_releves_horodates', now(), 1),
  (gen_random_uuid()::text, '9dfffe8ac413819491da8b1990588faf0ba082725d5b8fb5d4c5680bbb07c39b', now(), '20260906090000_commandes', now(), 1),
  (gen_random_uuid()::text, 'a058794fbec08813bb157b2d3d99d6c949baf50c39a0c196723db57da5ea9640', now(), '20260906180000_supplements_gateau', now(), 1),
  (gen_random_uuid()::text, '9a28b25dd41adc4d3c20b3eb16bd588b84c2f14f345de0bb5d58bc9d3b1010cc', now(), '20260906210000_composition_gateau', now(), 1),
  (gen_random_uuid()::text, '6386e3171f3791200dc6c0c9b60046f50a04ae47aeac41dc8539254b239fab10', now(), '20260907090000_paliers_et_complexe', now(), 1),
  (gen_random_uuid()::text, 'b9b9a2eef58618541261d0c3b7cb2e8796cd0eaf112fb7c9caffa3b5fa3471bf', now(), '20260907120000_sale_sur_mesure', now(), 1),
  (gen_random_uuid()::text, '9fd895dd7bd795c71c02f883a8feb4d0088eecc95e3d95f398e0f49d0201847b', now(), '20260907150000_reglages_coupes', now(), 1),
  (gen_random_uuid()::text, '68fe0ba93d137484f72928830c157d11ee36179cc0676dfe878a104f188c4c24', now(), '20260907180000_quantite_commande', now(), 1)
) AS v(id, checksum, finished_at, migration_name, started_at, applied_steps_count)
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" m WHERE m."migration_name" = v.migration_name
);

-- ---------- verification ----------
SELECT "categorie", count(*) AS produits FROM "Produit" WHERE "actif"
GROUP BY "categorie" ORDER BY min("ordre");
SELECT count(*) FILTER (WHERE "actif") AS actifs,
       count(*) FILTER (WHERE NOT "actif") AS desactives
FROM "Produit";
SELECT count(*) AS migrations_enregistrees FROM "_prisma_migrations";
