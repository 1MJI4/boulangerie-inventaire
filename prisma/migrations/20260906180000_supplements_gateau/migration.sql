-- Deux faits distincts qu'un seul booleen ne pouvait pas porter :
--   photoWhatsapp : le client a envoye une photo modele (aucun supplement) ;
--   photoImprimee : la photo doit etre imprimee sur le gateau (+ 15 EUR).
-- Et le choix explicite « pas d'ecriture », pour qu'on ne puisse pas
-- simplement oublier de poser la question.

ALTER TABLE "Commande" ADD COLUMN "sansEcriture" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Commande" ADD COLUMN "photoImprimee" BOOLEAN NOT NULL DEFAULT false;
