-- =====================================================================
-- Lot 1 — Audit securite H5 : fermer l'acces direct a la base.
--
-- L'application n'accede a la base QUE par Prisma, cote serveur, avec le
-- role proprietaire des tables. Les roles publics de Supabase (`anon`,
-- `authenticated`, utilises par l'API REST/GraphQL auto-generee) n'ont
-- aucune raison de lire ou d'ecrire quoi que ce soit dans `public`.
--
--  1. RLS ACTIVEE sur toutes les tables de `public`, SANS AUCUNE POLITIQUE :
--     tout role soumis a la RLS ne voit et n'ecrit rien.
--     Pas de FORCE : le proprietaire des tables (role de migration/Prisma)
--     n'est pas soumis a la RLS et l'application continue de fonctionner.
--  2. REVOKE de tous les droits de `anon` et `authenticated` sur les tables,
--     sequences et fonctions existantes, et sur celles creees a l'avenir
--     par le role qui execute les migrations.
--
-- NON DESTRUCTIF : aucune donnee modifiee. Retour arriere possible par
-- ALTER TABLE ... DISABLE ROW LEVEL SECURITY / GRANT.
-- Hors Supabase (base locale sans roles anon/authenticated), la partie 2
-- est sautee sans erreur.
--
-- A VERIFIER AVANT DEPLOIEMENT (non verifiable depuis le depot) : le role
-- de DATABASE_URL est bien proprietaire des tables, ou possede BYPASSRLS :
--   SELECT tableowner FROM pg_tables WHERE schemaname = 'public';
--   SELECT current_user, rolbypassrls FROM pg_roles WHERE rolname = current_user;
-- Sinon l'application verrait des tables vides.
-- =====================================================================

-- 1. RLS sur chaque table de `public` (y compris _prisma_migrations et les
--    tables du lot 1 : ProduitCatalogue, PrixProduit, JourFerme).
DO $rls$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END
$rls$;

-- 2. Aucun droit pour les roles publics de Supabase.
DO $revoke$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      -- Objets crees plus tard par le role courant (celui des migrations).
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END
$revoke$;

-- Note : les fonctions du lot 1 sont SECURITY INVOKER. Appelees par `anon`
-- (droit EXECUTE herite de PUBLIC), elles ne peuvent rien lire : les tables
-- leur sont fermees ci-dessus. Le droit de PUBLIC n'est pas retire, pour ne
-- pas casser un role applicatif non proprietaire.

-- RAPPEL pour toute migration future : une table creee apres celle-ci doit
-- recevoir son propre « ALTER TABLE ... ENABLE ROW LEVEL SECURITY ».
