#!/usr/bin/env bash
# deploiement/vps/copier-base.sh — copie la base Supabase vers la base locale du VPS.
#
# Sur le serveur : sudo bash /opt/pain-patisserie/deploiement/vps/copier-base.sh
# Lit dans /etc/pain-patisserie/env :
#   SOURCE_DATABASE_URL  connexion Supabase (session, port 5432) — lecture seule ici
#   DATABASE_URL         base locale du VPS (cible)
# La source n'est JAMAIS modifiée. La cible est remplacée entièrement : à ne
# lancer qu'avant la mise en service, ou pendant une coupure prévue.
set -euo pipefail

set -a; . /etc/pain-patisserie/env; set +a
: "${SOURCE_DATABASE_URL:?SOURCE_DATABASE_URL absent de /etc/pain-patisserie/env}"
: "${DATABASE_URL:?DATABASE_URL absent de /etc/pain-patisserie/env}"
case "$DATABASE_URL" in
  *@127.0.0.1*|*@localhost*) ;;
  *) echo "ARRÊT : DATABASE_URL ne vise pas la base locale du serveur."; exit 1 ;;
esac

SAUVEGARDE="/var/backups/pain-supabase-$(date +%Y%m%d-%H%M%S).dump"
SOURCE="${SOURCE_DATABASE_URL%%\?*}"
CIBLE="${DATABASE_URL%%\?*}"

echo "== Copie de Supabase (schéma public, données comprises)"
PGSSLMODE=require pg_dump --format=custom --no-owner --no-acl --schema=public --file="$SAUVEGARDE" "$SOURCE"
chmod 600 "$SAUVEGARDE"
ls -lh "$SAUVEGARDE"

echo "== Restauration dans la base locale (remplace son contenu)"
psql -q "$CIBLE" -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
pg_restore --no-owner --no-acl --exit-on-error --dbname="$CIBLE" "$SAUVEGARDE"

echo "== Contrôle : nombre de lignes par table, source et cible"
REQ="SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY relname"
psql -q "$CIBLE" -c 'ANALYZE;'
diff <(PGSSLMODE=require psql -AtF' ' "$SOURCE" -c "ANALYZE;" -c "$REQ" | sort) <(psql -AtF' ' "$CIBLE" -c "$REQ" | sort) \
  && echo "Identique : toutes les tables ont le même nombre de lignes." \
  || echo "ÉCART ci-dessus : vérifier avant la mise en service."
echo "Copie gardée dans $SAUVEGARDE"
