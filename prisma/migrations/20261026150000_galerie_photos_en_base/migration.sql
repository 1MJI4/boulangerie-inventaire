-- =====================================================================
-- Galerie de photos modeles EN BASE (decision du proprietaire, 26/10/2026) :
-- le gerant gere lui-meme les photos (ajouter, ranger dans un rayon /
-- rattacher a un produit, modifier la note, masquer). Jusqu'ici la liste
-- etait figee dans src/catalogue/photosModeles.ts (152 entrees).
--
-- Ordre des operations (une seule transaction, comme toute migration Prisma) :
--   1. table "PhotoModele" + contraintes + sequence des nouvelles photos
--   2. REPRISE des 152 photos de src/catalogue/photosModeles.ts
--      (idempotente : ON CONFLICT DO NOTHING)
--   3. cle etrangere "LigneCommande"."photoModele" -> "PhotoModele"."id"
--   4. cle etrangere "PhotoModele"."produitCle" -> "ProduitCatalogue"."cleCatalogue"
--      (NOT VALID, puis validee ici si le catalogue est deja importe)
--
-- NON DESTRUCTIF : aucune colonne retiree, aucune donnee existante modifiee.
-- Le CHECK "LigneCommande_photoModele_format" (migration 20261026120000)
-- est CONSERVE. Migration NOUVELLE : les precedentes ne sont JAMAIS modifiees.
-- =====================================================================

-- 1. Numerotation des photos AJOUTEES par le gerant : lettre 'P' + numero
--    a 3 chiffres (P001, P002...), par une SEQUENCE PostgreSQL : nextval()
--    est atomique, deux tablettes qui ajoutent une photo en meme temps ne
--    recoivent jamais le meme numero (pas de max+1, pas de course).
--    Un numero consomme par une insertion annulee est perdu (trou dans la
--    numerotation) : sans consequence, l'identifiant n'est qu'une etiquette.
--    MAXVALUE 999 NO CYCLE : au-dela de P999 l'insertion echoue plutot que
--    de reemployer un numero deja cite par une commande.
--    Les photos reprises gardent leur identifiant G/S d'origine.
CREATE SEQUENCE "PhotoModele_numero_P_seq" AS integer
  START WITH 1 MINVALUE 1 MAXVALUE 999 NO CYCLE;

CREATE TABLE "PhotoModele" (
  "id"          TEXT         NOT NULL DEFAULT ('P'::text || lpad((nextval('"PhotoModele_numero_P_seq"'::regclass))::text, 3, '0'::text)),
  "categorie"   TEXT         NOT NULL,
  "produitCle"  TEXT,
  "supplements" TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "note"        TEXT,
  "masquee"     BOOLEAN      NOT NULL DEFAULT false,
  "ordre"       INTEGER      NOT NULL,
  "fichier"     TEXT         NOT NULL,
  "creeLe"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "modifieLe"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "creePar"     TEXT,
  CONSTRAINT "PhotoModele_pkey" PRIMARY KEY ("id")
);

ALTER SEQUENCE "PhotoModele_numero_P_seq" OWNED BY "PhotoModele"."id";

-- Meme format que "LigneCommande_photoModele_format" : imprime sur le bon.
ALTER TABLE "PhotoModele" ADD CONSTRAINT "PhotoModele_id_format"
  CHECK ("id" ~ '^[A-Z][0-9]{3}$');
-- Rayon de la galerie : jamais vide (une photo sans rayon serait introuvable).
ALTER TABLE "PhotoModele" ADD CONSTRAINT "PhotoModele_categorie_non_vide"
  CHECK (btrim("categorie") <> '' AND char_length("categorie") <= 60);
-- Produit rattache : NULL = la vendeuse choisit le produit ; sinon non vide.
ALTER TABLE "PhotoModele" ADD CONSTRAINT "PhotoModele_produitCle_non_vide"
  CHECK ("produitCle" IS NULL OR btrim("produitCle") <> '');
-- Supplements du modele : cles du catalogue, aucune vide ni NULL.
ALTER TABLE "PhotoModele" ADD CONSTRAINT "PhotoModele_supplements_valides"
  CHECK (array_position("supplements", NULL) IS NULL
         AND NOT ('' = ANY ("supplements")));
-- Note courte lisible par la vendeuse (120 caracteres max). LOI 1 : jamais
-- de prix dans une note -> ni « € » ni « euro ». Les CHIFFRES ne sont pas
-- refuses en base (« 2 etages » est legitime) : controle applicatif.
ALTER TABLE "PhotoModele" ADD CONSTRAINT "PhotoModele_note_valide"
  CHECK ("note" IS NULL OR (btrim("note") <> '' AND char_length("note") <= 120
         AND "note" !~* '€|euro'));
-- Ordre d'affichage dans le rayon.
ALTER TABLE "PhotoModele" ADD CONSTRAINT "PhotoModele_ordre_positif"
  CHECK ("ordre" >= 0);
-- Nom de fichier SIMPLE dans public/modeles/ (ni dossier, ni « .. »), qui
-- commence par l'identifiant : « G043.jpg », « P001-3fa9c2.jpg ».
ALTER TABLE "PhotoModele" ADD CONSTRAINT "PhotoModele_fichier_valide"
  CHECK ("fichier" ~* '^[A-Z][0-9]{3}([-_][A-Za-z0-9]+)*\.(jpg|jpeg|png|webp)$'
         AND left("fichier", 4) = "id");
-- Prenom declare (pas de comptes par employe) : NULL ou non vide.
ALTER TABLE "PhotoModele" ADD CONSTRAINT "PhotoModele_creePar_non_vide"
  CHECK ("creePar" IS NULL OR (btrim("creePar") <> '' AND char_length("creePar") <= 60));

CREATE UNIQUE INDEX "PhotoModele_fichier_key" ON "PhotoModele"("fichier");
-- Galerie : un rayon, photos visibles, dans l'ordre (une seule requete).
CREATE INDEX "PhotoModele_categorie_masquee_ordre_idx" ON "PhotoModele"("categorie", "masquee", "ordre");
CREATE INDEX "PhotoModele_produitCle_idx" ON "PhotoModele"("produitCle");

-- Aucune suppression physique (une ancienne commande peut citer la photo) :
-- on MASQUE. L'identifiant ne change jamais (il est imprime sur les bons).
CREATE OR REPLACE FUNCTION "photo_modele_controler"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_PHOTO_IMMUABLE',
      DETAIL = format('La photo %s ne se supprime pas : la masquer.', OLD."id"),
      HINT = 'champ=masquee';
  END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id" THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_PHOTO_IMMUABLE',
      DETAIL = format('L''identifiant %s est imprime sur des bons : il ne change jamais.', OLD."id"),
      HINT = 'champ=id';
  END IF;
  RETURN NEW;
END
$fn$;

CREATE TRIGGER "PhotoModele_controler"
  BEFORE UPDATE OR DELETE ON "PhotoModele"
  FOR EACH ROW EXECUTE FUNCTION "photo_modele_controler"();

-- Securite (rappel de 20261015130000) : RLS sur toute nouvelle table, aucun
-- droit pour les roles publics de Supabase (bloc saute hors Supabase).
ALTER TABLE "PhotoModele" ENABLE ROW LEVEL SECURITY;
DO $revoke$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE "PhotoModele" FROM %I', r);
      EXECUTE format('REVOKE ALL ON SEQUENCE "PhotoModele_numero_P_seq" FROM %I', r);
    END IF;
  END LOOP;
END
$revoke$;

-- 2. REPRISE — transcription de src/catalogue/photosModeles.ts au 26/10/2026
--    (generee par script, ordre du fichier ; ordre = rang x 10 pour pouvoir
--    intercaler une photo sans renumeroter). fichier = nom seul (« G043.jpg ») :
--    les images restent dans public/modeles/. creePar NULL (reprise).
INSERT INTO "PhotoModele" ("id", "categorie", "produitCle", "supplements", "note", "ordre", "fichier") VALUES
  ('G001', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], NULL, 10, 'G001.jpg'),
  ('G002', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], NULL, 20, 'G002.jpg'),
  ('G005', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], NULL, 30, 'G005.jpg'),
  ('G008', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], NULL, 40, 'G008.jpg'),
  ('G017', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], 'Bavarois mousse chocolat', 50, 'G017.jpg'),
  ('G022', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], NULL, 60, 'G022.jpg'),
  ('G025', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], 'Bavarois framboise', 70, 'G025.jpg'),
  ('G036', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], NULL, 80, 'G036.jpg'),
  ('G042', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], 'Bavarois citron', 90, 'G042.jpg'),
  ('G058', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], 'Forêt noire', 100, 'G058.jpg'),
  ('G062', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], NULL, 110, 'G062.jpg'),
  ('G067', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], NULL, 120, 'G067.jpg'),
  ('G074', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], NULL, 130, 'G074.jpg'),
  ('G097', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], NULL, 140, 'G097.jpg'),
  ('G102', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], 'Déco à valider sur WhatsApp', 150, 'G102.jpg'),
  ('G106', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], 'Modèle avec photo imprimée (+ supplément)', 160, 'G106.jpg'),
  ('G121', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], NULL, 170, 'G121.jpg'),
  ('G129', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], 'Modèle avec photo imprimée (+ supplément)', 180, 'G129.jpg'),
  ('G136', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], NULL, 190, 'G136.jpg'),
  ('G143', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], NULL, 200, 'G143.jpg'),
  ('G189', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], NULL, 210, 'G189.jpg'),
  ('G194', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], NULL, 220, 'G194.jpg'),
  ('G195', 'Bavarois', 'gateaux-sur-commande/bavarois', ARRAY[]::TEXT[], NULL, 230, 'G195.jpg'),
  ('G007', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], NULL, 240, 'G007.jpg'),
  ('G028', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], NULL, 250, 'G028.jpg'),
  ('G034', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], 'Modèle avec photo imprimée (+ supplément)', 260, 'G034.jpg'),
  ('G039', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], NULL, 270, 'G039.jpg'),
  ('G044', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], 'Modèle avec photo imprimée (+ supplément)', 280, 'G044.jpg'),
  ('G049', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], NULL, 290, 'G049.jpg'),
  ('G050', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], 'Pochage (supplément à confirmer)', 300, 'G050.jpg'),
  ('G051', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], NULL, 310, 'G051.jpg'),
  ('G052', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], 'Modèle avec photo imprimée (+ supplément)', 320, 'G052.jpg'),
  ('G056', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], NULL, 330, 'G056.jpg'),
  ('G057', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], 'Modèle avec photo imprimée (+ supplément)', 340, 'G057.jpg'),
  ('G066', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], NULL, 350, 'G066.jpg'),
  ('G070', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], 'Modèle avec photo imprimée (+ supplément)', 360, 'G070.jpg'),
  ('G084', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], NULL, 370, 'G084.jpg'),
  ('G085', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], NULL, 380, 'G085.jpg'),
  ('G087', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], NULL, 390, 'G087.jpg'),
  ('G091', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], NULL, 400, 'G091.jpg'),
  ('G092', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], NULL, 410, 'G092.jpg'),
  ('G093', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], 'Modèle avec photo imprimée (+ supplément)', 420, 'G093.jpg'),
  ('G109', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], 'Modèle avec photo imprimée (+ supplément)', 430, 'G109.jpg'),
  ('G125', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], NULL, 440, 'G125.jpg'),
  ('G127', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], NULL, 450, 'G127.jpg'),
  ('G133', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], NULL, 460, 'G133.jpg'),
  ('G135', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], NULL, 470, 'G135.jpg'),
  ('G152', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], 'Modèle avec photo imprimée (+ supplément)', 480, 'G152.jpg'),
  ('G174', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], NULL, 490, 'G174.jpg'),
  ('G190', 'Crème fraîche', 'gateaux-sur-commande/creme-fraiche', ARRAY[]::TEXT[], NULL, 500, 'G190.jpg'),
  ('G018', 'Entremet', 'gateaux-sur-commande/entremet', ARRAY[]::TEXT[], NULL, 510, 'G018.jpg'),
  ('G024', 'Entremet', 'gateaux-sur-commande/entremet', ARRAY[]::TEXT[], NULL, 520, 'G024.jpg'),
  ('G041', 'Entremet', 'gateaux-sur-commande/entremet', ARRAY[]::TEXT[], NULL, 530, 'G041.jpg'),
  ('G048', 'Entremet', 'gateaux-sur-commande/entremet', ARRAY[]::TEXT[], NULL, 540, 'G048.jpg'),
  ('G065', 'Entremet', 'gateaux-sur-commande/entremet', ARRAY[]::TEXT[], 'Forêt noire ronde, au prix de l’entremet', 550, 'G065.jpg'),
  ('G071', 'Entremet', 'gateaux-sur-commande/entremet', ARRAY[]::TEXT[], 'Tiramisu, au prix de l’entremet · Modèle avec photo imprimée (+ supplément)', 560, 'G071.jpg'),
  ('G072', 'Entremet', 'gateaux-sur-commande/entremet', ARRAY[]::TEXT[], 'Noisette chocolat · Déco à valider sur WhatsApp', 570, 'G072.jpg'),
  ('G075', 'Entremet', 'gateaux-sur-commande/entremet', ARRAY[]::TEXT[], 'Entremet sur deux étages', 580, 'G075.jpg'),
  ('G079', 'Entremet', 'gateaux-sur-commande/entremet', ARRAY[]::TEXT[], 'Modèle avec photo imprimée (+ supplément)', 590, 'G079.jpg'),
  ('G082', 'Entremet', 'gateaux-sur-commande/entremet', ARRAY[]::TEXT[], NULL, 600, 'G082.jpg'),
  ('G111', 'Entremet', 'gateaux-sur-commande/entremet', ARRAY[]::TEXT[], NULL, 610, 'G111.jpg'),
  ('G112', 'Entremet', 'gateaux-sur-commande/entremet', ARRAY[]::TEXT[], NULL, 620, 'G112.jpg'),
  ('G130', 'Entremet', 'gateaux-sur-commande/entremet', ARRAY[]::TEXT[], NULL, 630, 'G130.jpg'),
  ('G138', 'Entremet', 'gateaux-sur-commande/entremet', ARRAY[]::TEXT[], NULL, 640, 'G138.jpg'),
  ('G110', 'Cake nature', 'gateaux-sur-commande/cake-nature', ARRAY[]::TEXT[], 'Cake chocolat · Modèle avec photo imprimée (+ supplément)', 650, 'G110.jpg'),
  ('G142', 'Cake nature', 'gateaux-sur-commande/cake-nature', ARRAY[]::TEXT[], NULL, 660, 'G142.jpg'),
  ('G006', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 670, 'G006.jpg'),
  ('G010', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], 'Layer cake triple chocolat', 680, 'G010.jpg'),
  ('G011', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], 'Demi layer cake · Déco à valider sur WhatsApp', 690, 'G011.jpg'),
  ('G012', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 700, 'G012.jpg'),
  ('G016', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 710, 'G016.jpg'),
  ('G021', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 720, 'G021.jpg'),
  ('G023', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 730, 'G023.jpg'),
  ('G026', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 740, 'G026.jpg'),
  ('G029', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 750, 'G029.jpg'),
  ('G031', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 760, 'G031.jpg'),
  ('G037', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 770, 'G037.jpg'),
  ('G046', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 780, 'G046.jpg'),
  ('G053', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 790, 'G053.jpg'),
  ('G060', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 800, 'G060.jpg'),
  ('G080', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], 'Layer cake boîte surprise · Déco à valider sur WhatsApp', 810, 'G080.jpg'),
  ('G086', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 820, 'G086.jpg'),
  ('G090', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 830, 'G090.jpg'),
  ('G098', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 840, 'G098.jpg'),
  ('G099', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 850, 'G099.jpg'),
  ('G100', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 860, 'G100.jpg'),
  ('G105', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 870, 'G105.jpg'),
  ('G108', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 880, 'G108.jpg'),
  ('G113', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 890, 'G113.jpg'),
  ('G114', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 900, 'G114.jpg'),
  ('G116', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 910, 'G116.jpg'),
  ('G119', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 920, 'G119.jpg'),
  ('G123', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 930, 'G123.jpg'),
  ('G128', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 940, 'G128.jpg'),
  ('G140', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 950, 'G140.jpg'),
  ('G146', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 960, 'G146.jpg'),
  ('G191', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 970, 'G191.jpg'),
  ('G192', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 980, 'G192.jpg'),
  ('G199', 'Layer Cake', 'gateaux-sur-commande/layer-cake', ARRAY[]::TEXT[], NULL, 990, 'G199.jpg'),
  ('G019', 'Pâte à sucre', 'gateaux-sur-commande/layer-cake', ARRAY['gateaux-sur-commande/supplement-pate-a-sucre']::TEXT[], 'Layer cake en forme de cœur', 1000, 'G019.jpg'),
  ('G027', 'Pâte à sucre', 'gateaux-sur-commande/layer-cake', ARRAY['gateaux-sur-commande/supplement-pate-a-sucre']::TEXT[], 'Modèle avec photo imprimée (+ supplément)', 1010, 'G027.jpg'),
  ('G040', 'Pâte à sucre', 'gateaux-sur-commande/layer-cake', ARRAY['gateaux-sur-commande/supplement-pate-a-sucre']::TEXT[], NULL, 1020, 'G040.jpg'),
  ('G043', 'Pâte à sucre', 'gateaux-sur-commande/layer-cake', ARRAY['gateaux-sur-commande/supplement-pate-a-sucre']::TEXT[], NULL, 1030, 'G043.jpg'),
  ('G076', 'Pâte à sucre', 'gateaux-sur-commande/layer-cake', ARRAY['gateaux-sur-commande/supplement-pate-a-sucre']::TEXT[], NULL, 1040, 'G076.jpg'),
  ('G077', 'Pâte à sucre', 'gateaux-sur-commande/layer-cake', ARRAY['gateaux-sur-commande/supplement-pate-a-sucre']::TEXT[], NULL, 1050, 'G077.jpg'),
  ('G089', 'Pâte à sucre', 'gateaux-sur-commande/layer-cake', ARRAY['gateaux-sur-commande/supplement-pate-a-sucre']::TEXT[], NULL, 1060, 'G089.jpg'),
  ('G132', 'Pâte à sucre', 'gateaux-sur-commande/layer-cake', ARRAY['gateaux-sur-commande/supplement-pate-a-sucre']::TEXT[], NULL, 1070, 'G132.jpg'),
  ('G188', 'Pâte à sucre', 'gateaux-sur-commande/layer-cake', ARRAY['gateaux-sur-commande/supplement-pate-a-sucre']::TEXT[], NULL, 1080, 'G188.jpg'),
  ('G197', 'Pâte à sucre', 'gateaux-sur-commande/layer-cake', ARRAY['gateaux-sur-commande/supplement-pate-a-sucre']::TEXT[], NULL, 1090, 'G197.jpg'),
  ('G004', 'Number Cake', 'gateaux-sur-commande/number-cake', ARRAY[]::TEXT[], NULL, 1100, 'G004.jpg'),
  ('G035', 'Number Cake', 'gateaux-sur-commande/number-cake', ARRAY[]::TEXT[], NULL, 1110, 'G035.jpg'),
  ('G095', 'Number Cake', 'gateaux-sur-commande/number-cake', ARRAY[]::TEXT[], NULL, 1120, 'G095.jpg'),
  ('G137', 'Number Cake', 'gateaux-sur-commande/number-cake', ARRAY[]::TEXT[], NULL, 1130, 'G137.jpg'),
  ('G147', 'Number Cake', 'gateaux-sur-commande/number-cake', ARRAY[]::TEXT[], NULL, 1140, 'G147.jpg'),
  ('G148', 'Number Cake', 'gateaux-sur-commande/number-cake', ARRAY[]::TEXT[], NULL, 1150, 'G148.jpg'),
  ('G198', 'Number Cake', 'gateaux-sur-commande/number-cake', ARRAY[]::TEXT[], NULL, 1160, 'G198.jpg'),
  ('G013', 'Pièce montée 2 étages', 'gateaux-sur-commande/gateau-de-mariage', ARRAY[]::TEXT[], NULL, 1170, 'G013.jpg'),
  ('G020', 'Pièce montée 2 étages', 'gateaux-sur-commande/gateau-de-mariage', ARRAY[]::TEXT[], NULL, 1180, 'G020.jpg'),
  ('G094', 'Pièce montée 2 étages', 'gateaux-sur-commande/gateau-de-mariage', ARRAY[]::TEXT[], NULL, 1190, 'G094.jpg'),
  ('G096', 'Pièce montée 2 étages', 'gateaux-sur-commande/gateau-de-mariage', ARRAY[]::TEXT[], NULL, 1200, 'G096.jpg'),
  ('G118', 'Pièce montée 2 étages', 'gateaux-sur-commande/gateau-de-mariage', ARRAY[]::TEXT[], NULL, 1210, 'G118.jpg'),
  ('G126', 'Pièce montée 2 étages', 'gateaux-sur-commande/gateau-de-mariage', ARRAY[]::TEXT[], NULL, 1220, 'G126.jpg'),
  ('G145', 'Pièce montée 2 étages', 'gateaux-sur-commande/gateau-de-mariage', ARRAY[]::TEXT[], NULL, 1230, 'G145.jpg'),
  ('G154', 'Pièce montée 2 étages', 'gateaux-sur-commande/gateau-de-mariage', ARRAY[]::TEXT[], NULL, 1240, 'G154.jpg'),
  ('G155', 'Pièce montée 2 étages', 'gateaux-sur-commande/gateau-de-mariage', ARRAY[]::TEXT[], NULL, 1250, 'G155.jpg'),
  ('G045', 'Pièce montée 3 étages', 'gateaux-sur-commande/piece-montee', ARRAY[]::TEXT[], NULL, 1260, 'G045.jpg'),
  ('G103', 'Pièce montée 3 étages', 'gateaux-sur-commande/piece-montee', ARRAY[]::TEXT[], NULL, 1270, 'G103.jpg'),
  ('G009', 'Mini-pâtisseries', 'gateaux-sur-commande/mini-bavarois', ARRAY[]::TEXT[], NULL, 1280, 'G009.jpg'),
  ('G015', 'Mini-pâtisseries', 'gateaux-sur-commande/mini-bavarois', ARRAY[]::TEXT[], NULL, 1290, 'G015.jpg'),
  ('G083', 'Mini-pâtisseries', NULL, ARRAY[]::TEXT[], NULL, 1300, 'G083.jpg'),
  ('G101', 'Mini-pâtisseries', NULL, ARRAY[]::TEXT[], NULL, 1310, 'G101.jpg'),
  ('G115', 'Mini-pâtisseries', NULL, ARRAY[]::TEXT[], NULL, 1320, 'G115.jpg'),
  ('G139', 'Mini-pâtisseries', NULL, ARRAY[]::TEXT[], NULL, 1330, 'G139.jpg'),
  ('G144', 'Mini-pâtisseries', NULL, ARRAY[]::TEXT[], NULL, 1340, 'G144.jpg'),
  ('G047', 'Tartes', NULL, ARRAY[]::TEXT[], NULL, 1350, 'G047.jpg'),
  ('G081', 'Tartes', NULL, ARRAY[]::TEXT[], NULL, 1360, 'G081.jpg'),
  ('G104', 'Tartes', 'gateaux-et-tartes/tarte/moelleux-6p', ARRAY[]::TEXT[], 'Smarties et Maltesers (supplément à confirmer)', 1370, 'G104.jpg'),
  ('G107', 'Tartes', NULL, ARRAY[]::TEXT[], NULL, 1380, 'G107.jpg'),
  ('G003', 'Bûches', NULL, ARRAY[]::TEXT[], NULL, 1390, 'G003.jpg'),
  ('G030', 'Bûches', NULL, ARRAY[]::TEXT[], NULL, 1400, 'G030.jpg'),
  ('G055', 'Bûches', NULL, ARRAY[]::TEXT[], NULL, 1410, 'G055.jpg'),
  ('G063', 'Bûches', NULL, ARRAY[]::TEXT[], NULL, 1420, 'G063.jpg'),
  ('G078', 'Bûches', NULL, ARRAY[]::TEXT[], NULL, 1430, 'G078.jpg'),
  ('G117', 'Bûches', NULL, ARRAY[]::TEXT[], NULL, 1440, 'G117.jpg'),
  ('S002', 'Mini pizza / quiche', 'sur-commande/mini-pizza-quiche', ARRAY[]::TEXT[], NULL, 1450, 'S002.jpg'),
  ('S003', 'Mini pizza / quiche', 'sur-commande/mini-pizza-quiche', ARRAY[]::TEXT[], NULL, 1460, 'S003.jpg'),
  ('S001', 'Mini-sandwichs garnis', 'sur-commande/mini-sandwichs-garnis', ARRAY[]::TEXT[], NULL, 1470, 'S001.jpg'),
  ('S004', 'Mini-sandwichs garnis', 'sur-commande/mini-sandwichs-garnis', ARRAY[]::TEXT[], NULL, 1480, 'S004.jpg'),
  ('S005', 'Grand pain surprise', 'sur-commande/grand-pain-surprise', ARRAY[]::TEXT[], NULL, 1490, 'S005.jpg'),
  ('S006', 'Grand pain surprise', 'sur-commande/grand-pain-surprise', ARRAY[]::TEXT[], NULL, 1500, 'S006.jpg'),
  ('S007', 'Grand pain surprise', 'sur-commande/grand-pain-surprise', ARRAY[]::TEXT[], NULL, 1510, 'S007.jpg'),
  ('S008', 'Grand pain surprise', 'sur-commande/grand-pain-surprise', ARRAY[]::TEXT[], NULL, 1520, 'S008.jpg')
ON CONFLICT ("id") DO NOTHING;

-- 3. Cle etrangere ligne de commande -> photo. Garde-fou : si une ligne deja
--    enregistree cite une photo absente de la reprise, on ARRETE (aucune
--    photo inventee) ; la migration est annulee en bloc, rien n'est modifie.
DO $orphelines$
DECLARE
  liste text;
BEGIN
  SELECT string_agg(DISTINCT l."photoModele", ', ') INTO liste
    FROM "LigneCommande" l
   WHERE l."photoModele" IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "PhotoModele" p WHERE p."id" = l."photoModele");
  IF liste IS NOT NULL THEN
    RAISE EXCEPTION 'Lignes de commande citant des photos absentes de la galerie : %. Migration annulee.', liste;
  END IF;
END
$orphelines$;

-- ON DELETE RESTRICT : une photo citee par une commande ne disparait jamais.
-- ON UPDATE RESTRICT : son identifiant ne change jamais.
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_photoModele_fkey"
  FOREIGN KEY ("photoModele") REFERENCES "PhotoModele"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "LigneCommande_photoModele_idx" ON "LigneCommande"("photoModele");

-- 4. Produit rattache -> catalogue de COMMANDE (LOI 10 : jamais "Produit",
--    la liste d'inventaire). "cleCatalogue" est UNIQUE et ne change jamais ;
--    un ProduitCatalogue n'est jamais supprime (actif = false).
--    NOT VALID : sur une base neuve les migrations passent AVANT l'import du
--    catalogue ; les 152 lignes reprises ne sont alors pas verifiees a la
--    pose, mais toute photo ajoutee ou re-rattachee ensuite l'est. Si le
--    catalogue en base couvre deja toutes les cles, la contrainte est
--    validee tout de suite.
ALTER TABLE "PhotoModele" ADD CONSTRAINT "PhotoModele_produitCle_fkey"
  FOREIGN KEY ("produitCle") REFERENCES "ProduitCatalogue"("cleCatalogue")
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

DO $valider$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "PhotoModele" p
     WHERE p."produitCle" IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM "ProduitCatalogue" c WHERE c."cleCatalogue" = p."produitCle")
  ) THEN
    ALTER TABLE "PhotoModele" VALIDATE CONSTRAINT "PhotoModele_produitCle_fkey";
  ELSE
    RAISE NOTICE 'PhotoModele_produitCle_fkey laissee NOT VALID : catalogue pas encore importe (a valider apres import).';
  END IF;
END
$valider$;

-- Verification apres deploiement (attendu : 152, puis 0 partout) :
--   SELECT count(*) FROM "PhotoModele" WHERE "id" ~ '^[GS]';
--   SELECT count(*) FROM "LigneCommande" l WHERE l."photoModele" IS NOT NULL
--     AND NOT EXISTS (SELECT 1 FROM "PhotoModele" p WHERE p."id" = l."photoModele");
--   SELECT count(*) FROM "PhotoModele" p WHERE p."produitCle" IS NOT NULL
--     AND NOT EXISTS (SELECT 1 FROM "ProduitCatalogue" c WHERE c."cleCatalogue" = p."produitCle");
--   SELECT count(*) FROM "PhotoModele" p, unnest(p."supplements") s
--     WHERE NOT EXISTS (SELECT 1 FROM "ProduitCatalogue" c WHERE c."cleCatalogue" = s);
--   SELECT count(*) FROM pg_constraint
--     WHERE conname = 'PhotoModele_produitCle_fkey' AND NOT convalidated;
-- Si la derniere renvoie 1 alors que la 3e renvoie 0 (catalogue importe
-- apres la migration) :
--   ALTER TABLE "PhotoModele" VALIDATE CONSTRAINT "PhotoModele_produitCle_fkey";
--
-- Retour arriere (manuel, apres retour du code precedent, qui lit la galerie
-- dans src/catalogue/photosModeles.ts et ignore cette table) :
--   ALTER TABLE "LigneCommande" DROP CONSTRAINT "LigneCommande_photoModele_fkey";
--   DROP INDEX "LigneCommande_photoModele_idx";
--   DROP TABLE "PhotoModele";   -- emporte la sequence (OWNED BY) et le declencheur
--   DROP FUNCTION "photo_modele_controler"();
--   DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261026150000_galerie_photos_en_base';
-- Perte : les photos AJOUTEES par le gerant (identifiants 'P...') et les
-- notes / rayons modifies -> sauvegarder la table avant (COPY ... CSV).
-- Les lignes de commande gardent leur identifiant (colonne + CHECK intacts).
