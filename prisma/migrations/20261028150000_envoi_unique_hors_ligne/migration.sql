-- =====================================================================
-- File hors ligne de la tablette : une commande (ou une modification)
-- envoyee deux fois n'est enregistree qu'UNE fois (decision du
-- proprietaire, 28/10/2026 : « panne reseau en pleine commande :
-- enregistrer sur la tablette puis envoyer automatiquement »).
--
-- La tablette pose un identifiant UUID a la premiere tentative et le garde
-- pour tous les renvois (corps `idClient` + en-tete `Idempotency-Key`).
--   - "Commande"."idClient"          : creation (POST)
--   - "EvenementCommande"."idClient" : modification (PATCH) — chaque PATCH
--     cree exactement un evenement, l'unicite y rend le rejeu sans effet.
-- L'index UNIQUE tranche la course entre deux envois simultanes : la
-- seconde transaction echoue (P2002) et la route renvoie la commande deja
-- enregistree (src/lib/serveur/envoiUnique.ts).
--
-- AJOUT SIMPLE, NON DESTRUCTIF : deux colonnes nullables SANS valeur par
-- defaut (aucune reecriture de table), deux index uniques (NULL multiples
-- admis par PostgreSQL), deux CHECK de format. Les lignes existantes valent
-- NULL et passent les CHECK. Aucune colonne retiree ni renommee.
-- Declencheurs existants sur "Commande" / "EvenementCommande" : aucun ne
-- lit ces colonnes.
--
-- Migration NOUVELLE : les precedentes ne sont JAMAIS modifiees.
--
-- Retour arriere (a la main, sur une copie d'abord) :
--   ALTER TABLE "EvenementCommande" DROP CONSTRAINT "EvenementCommande_idClient_format";
--   DROP INDEX "EvenementCommande_idClient_key";
--   ALTER TABLE "EvenementCommande" DROP COLUMN "idClient";
--   ALTER TABLE "Commande" DROP CONSTRAINT "Commande_idClient_format";
--   DROP INDEX "Commande_idClient_key";
--   ALTER TABLE "Commande" DROP COLUMN "idClient";
-- (les colonnes ne portent qu'un identifiant technique de transport : les
-- perdre ne perd aucune donnee metier, seulement la protection anti-doublon)
-- =====================================================================

-- 1. Creation (POST)
ALTER TABLE "Commande" ADD COLUMN "idClient" TEXT;
CREATE UNIQUE INDEX "Commande_idClient_key" ON "Commande"("idClient");
-- UUID en minuscules (la route normalise avant d'ecrire).
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_idClient_format"
  CHECK ("idClient" IS NULL OR "idClient" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- 2. Modification (PATCH)
ALTER TABLE "EvenementCommande" ADD COLUMN "idClient" TEXT;
CREATE UNIQUE INDEX "EvenementCommande_idClient_key" ON "EvenementCommande"("idClient");
ALTER TABLE "EvenementCommande" ADD CONSTRAINT "EvenementCommande_idClient_format"
  CHECK ("idClient" IS NULL OR "idClient" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
