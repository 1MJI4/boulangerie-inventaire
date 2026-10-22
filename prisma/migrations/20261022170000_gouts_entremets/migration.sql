-- R62 (propriétaire, 22/10/2026) : goût obligatoire d'un gâteau sur commande.

-- Goûts (un par étage) et décorations facultatives, par ligne de commande.
ALTER TABLE "LigneCommande" ADD COLUMN "gouts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "LigneCommande" ADD COLUMN "decorations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Recettes d'entremet : celles de la catégorie Individuelle qui se font en
-- grand (pas Paris-brest, Merveilleux, Tiramisu). Libellés du tarif, à la
-- lettre (LOI 5). Liste réglable ensuite par le gérant.
INSERT INTO "OptionGateau" ("genre", "nom", "ordre", "modifieLe") VALUES
  ('entremet', 'Saint-Michel (noix – amandes)', 10, now()),
  ('entremet', 'Fleur caramel chocolat', 20, now()),
  ('entremet', 'Forêt noire', 30, now()),
  ('entremet', 'Bavarois fruits de la passion', 40, now()),
  ('entremet', 'Bavarois framboise', 50, now()),
  ('entremet', 'Mousse chocolat', 60, now()),
  ('entremet', 'Javanais', 70, now()),
  ('entremet', 'Morceau praline', 80, now()),
  ('entremet', 'Crème au beurre moka', 90, now())
ON CONFLICT ("genre", "nom") DO NOTHING;

-- Oreo, Speculoos, Kinder, Raffaello, Ferrero, Nutella sont des DÉCORATIONS,
-- pas des goûts : retirés des goûts (désactivés, l'historique reste) et
-- présents dans les décorations.
UPDATE "OptionGateau" SET "actif" = false, "modifieLe" = now()
  WHERE "genre" = 'parfum' AND "nom" IN ('Oreo', 'Speculoos', 'Kinder', 'Kinder Bueno', 'Raffaello', 'Ferrero Rocher', 'Nutella');
INSERT INTO "OptionGateau" ("genre", "nom", "ordre", "modifieLe") VALUES
  ('decoration', 'Speculoos', 900, now()),
  ('decoration', 'Raffaello', 900, now()),
  ('decoration', 'Nutella', 900, now())
ON CONFLICT ("genre", "nom") DO UPDATE SET "actif" = true;
