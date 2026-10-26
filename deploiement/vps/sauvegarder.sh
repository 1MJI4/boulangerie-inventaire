#!/usr/bin/env bash
# deploiement/vps/sauvegarder.sh — sauvegarde quotidienne VÉRIFIÉE : base + photos modèles.
#
# Lancé chaque soir par pain-sauvegarde.timer (installé par installer.sh).
# À la main : sudo bash /opt/pain-patisserie/deploiement/vps/sauvegarder.sh
#
# Produit dans /var/backups/pain-patisserie/ (root seul, 700) :
#   base-AAAAMMJJ-HHMMSS.dump        copie de la base locale (pg_dump, format custom)
#   photos-AAAAMMJJ-HHMMSS.tar.gz    copie du dossier DOSSIER_PHOTOS_MODELES
#   DERNIERE-VERIFICATION            date + résultat de la dernière vérification
#
# Une sauvegarde n'est déclarée valide qu'après VÉRIFICATION :
#   - la copie de la base est RESTAURÉE dans une base jetable « pain_verif »,
#     puis on compare le nombre de lignes table par table avec la base réelle ;
#   - l'archive des photos est relue et doit contenir autant d'images que le dossier.
# En cas d'écart : code de sortie 1 (le service apparaît « failed » dans
# systemctl) et les fichiers du jour sont gardés pour examen.
#
# Rotation : on garde 30 jours. ATTENTION : ces copies sont sur le MÊME serveur.
# Elles protègent d'une erreur ou d'une migration ratée, pas de la perte du VPS :
# voir docs/MISE-EN-SERVICE.md (copie hors du serveur).
#
# Rien n'est jamais affiché du fichier des secrets ni des adresses de connexion.
set -euo pipefail

set -a; . /etc/pain-patisserie/env; set +a
: "${DATABASE_URL:?DATABASE_URL absent de /etc/pain-patisserie/env}"
case "$DATABASE_URL" in
  *@127.0.0.1*|*@localhost*) ;;
  *) echo "ARRÊT : DATABASE_URL ne vise pas la base locale du serveur."; exit 1 ;;
esac
PHOTOS="${DOSSIER_PHOTOS_MODELES:-/var/lib/pain-patisserie/modeles}"
PHOTOS="${PHOTOS%/}"

DEST=/var/backups/pain-patisserie
GARDER_JOURS=30
HORO="$(date +%Y%m%d-%H%M%S)"
BASE_DUMP="$DEST/base-$HORO.dump"
PHOTOS_TAR="$DEST/photos-$HORO.tar.gz"
VERIF=pain_verif
CIBLE="${DATABASE_URL%%\?*}"

install -d -m 700 -o root -g root "$DEST"
umask 077

echo "== Base : copie"
pg_dump --format=custom --file="$BASE_DUMP" "$CIBLE"

echo "== Photos modèles : copie"
if [ -d "$PHOTOS" ]; then
  tar -czf "$PHOTOS_TAR" -C "$(dirname "$PHOTOS")" "$(basename "$PHOTOS")"
else
  echo "   Dossier des photos absent : aucune archive (à vérifier si l'application en a déjà)."
  PHOTOS_TAR=""
fi

ECHEC=0

echo "== Vérification : restauration de la base dans « $VERIF » (base jetable)"
sudo -u postgres dropdb --if-exists "$VERIF"
sudo -u postgres createdb "$VERIF"
if sudo -u postgres pg_restore --no-owner --no-acl --exit-on-error --dbname="$VERIF" < "$BASE_DUMP"; then
  REQ="SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY relname"
  # Comptage exact plutôt qu'estimé : ANALYZE des deux côtés avant lecture.
  REEL="$(psql -AtF' ' "$CIBLE" -c 'ANALYZE;' -c "$REQ" | sort)"
  COPIE="$(sudo -u postgres psql -AtF' ' -d "$VERIF" -c 'ANALYZE;' -c "$REQ" | sort)"
  if [ "$REEL" = "$COPIE" ]; then
    echo "   Base : restaurée, même nombre de lignes dans toutes les tables ($(echo "$REEL" | wc -l) tables)."
  else
    echo "   ÉCART entre la base et sa copie restaurée :"
    diff <(echo "$REEL") <(echo "$COPIE") || true
    ECHEC=1
  fi
else
  echo "   ÉCHEC : la copie de la base ne se restaure pas."
  ECHEC=1
fi
sudo -u postgres dropdb --if-exists "$VERIF"

if [ -n "$PHOTOS_TAR" ]; then
  echo "== Vérification : relecture de l'archive des photos"
  DANS_DOSSIER="$(find "$PHOTOS" -maxdepth 1 -type f | wc -l)"
  if LISTE="$(tar -tzf "$PHOTOS_TAR")"; then
    DANS_ARCHIVE="$(printf '%s\n' "$LISTE" | grep -v '/$' | grep -c . || true)"
    if [ "$DANS_DOSSIER" = "$DANS_ARCHIVE" ]; then
      echo "   Photos : archive lisible, $DANS_ARCHIVE fichiers."
    else
      echo "   ÉCART : $DANS_DOSSIER fichiers dans le dossier, $DANS_ARCHIVE dans l'archive."
      ECHEC=1
    fi
  else
    echo "   ÉCHEC : l'archive des photos est illisible."
    ECHEC=1
  fi
fi

if [ "$ECHEC" -eq 0 ]; then
  echo "$(date -Is) OK base-$HORO.dump${PHOTOS_TAR:+ photos-$HORO.tar.gz}" > "$DEST/DERNIERE-VERIFICATION"
  echo "== Rotation : suppression des copies de plus de $GARDER_JOURS jours"
  find "$DEST" -maxdepth 1 -type f \( -name 'base-*.dump' -o -name 'photos-*.tar.gz' \) -mtime +"$GARDER_JOURS" -delete
  ls -lh "$DEST" | tail -n +2
  echo "Sauvegarde vérifiée."
else
  echo "$(date -Is) ÉCHEC base-$HORO.dump — voir journalctl -u pain-sauvegarde" > "$DEST/DERNIERE-VERIFICATION"
  echo "SAUVEGARDE NON VALIDE : ne pas déployer ni migrer tant que ce n'est pas résolu."
  exit 1
fi
