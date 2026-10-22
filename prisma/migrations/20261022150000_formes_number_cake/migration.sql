-- Number Cake : formes a realiser (« 25 », « AM », « coeur + 1 »), decision du
-- proprietaire du 22/10/2026. Texte libre, NULL hors Number Cake.
ALTER TABLE "LigneCommande" ADD COLUMN "formes" TEXT;
