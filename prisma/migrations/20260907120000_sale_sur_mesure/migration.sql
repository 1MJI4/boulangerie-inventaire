-- Le sale se commande exactement comme le gateau : on compose. Meme table,
-- deux genres — et une unite, parce qu'une bestella se compte en personnes
-- la ou un mini briwate se compte en pieces.
ALTER TABLE "FamilleGateau" ADD COLUMN "genre" TEXT NOT NULL DEFAULT 'gateau';
ALTER TABLE "FamilleGateau" ADD COLUMN "unite" TEXT NOT NULL DEFAULT 'personne';
