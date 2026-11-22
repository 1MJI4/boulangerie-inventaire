-- =====================================================================
-- Photos de reference des articles du stock (proprietaire, 22/11/2026) :
-- le manager photographie chaque article sous plusieurs angles ; au moment
-- du comptage, un toucher sur la vignette affiche la photo (reconnaitre
-- l'article), et la collection servira plus tard a entrainer une IA.
-- Les images sont sur le disque (DOSSIER_PHOTOS_MODELES/stock/<id>.jpg) ;
-- la base ne garde que le lien. AJOUT SIMPLE, NON DESTRUCTIF.
-- Retour arriere : DROP TABLE "PhotoArticleStock";
-- =====================================================================

CREATE TABLE "PhotoArticleStock" (
  "id"        SERIAL PRIMARY KEY,
  "articleId" INTEGER NOT NULL,
  "ajouteLe"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhotoArticleStock_articleId_fkey" FOREIGN KEY ("articleId")
    REFERENCES "ArticleStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PhotoArticleStock_articleId_idx" ON "PhotoArticleStock"("articleId");
