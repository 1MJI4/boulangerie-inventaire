#!/usr/bin/env bash
# deploiement/vps/preparer-photos-modeles.sh — dossier de DONNÉES des photos modèles.
#
# Appelé par installer.sh et deployer.sh (en root). Lancement à la main :
#   sudo bash /opt/pain-patisserie/deploiement/vps/preparer-photos-modeles.sh
#
# Pourquoi un dossier hors du code : le gérant ajoute des photos depuis la
# tablette. Un fichier ajouté à l'exécution dans public/ n'est pas servi par
# `next start` et serait écrasé au déploiement suivant. Les photos vivent donc
# dans DOSSIER_PHOTOS_MODELES (défaut /var/lib/pain-patisserie/modeles).
#
# Ce que fait ce script :
#   1. crée le dossier s'il manque (propriétaire pain:pain, droits 750) ;
#   2. UNE SEULE FOIS (reprise) : copie les images de public/modeles/ du dépôt,
#      sans jamais écraser un fichier déjà présent ;
#   3. pose un repère (.reprise-modeles-faite, à côté du dossier, pas dedans) :
#      aux déploiements suivants il ne copie plus rien. Une photo supprimée par
#      le gérant ne revient donc pas toute seule.
# Il ne supprime jamais rien.
set -euo pipefail

APP="${APP:-/opt/pain-patisserie}"
UTILISATEUR="${UTILISATEUR:-pain}"
DOSSIER="${DOSSIER_PHOTOS_MODELES:-/var/lib/pain-patisserie/modeles}"
DOSSIER="${DOSSIER%/}"
SOURCE="$APP/public/modeles"
PARENT="$(dirname "$DOSSIER")"
REPERE="$PARENT/.reprise-modeles-faite"

case "$DOSSIER" in
  /*) ;;
  *) echo "ARRÊT : DOSSIER_PHOTOS_MODELES doit être un chemin absolu."; exit 1 ;;
esac
case "$DOSSIER/" in
  "$APP"/*) echo "ARRÊT : DOSSIER_PHOTOS_MODELES est dans le code ($APP) : il serait écrasé au déploiement."; exit 1 ;;
esac

# Parent (/var/lib/pain-patisserie) et dossier : lisibles par le seul service.
# Caddy n'y accède pas : c'est l'application qui sert les images.
install -d -m 750 -o "$UTILISATEUR" -g "$UTILISATEUR" "$PARENT"
install -d -m 750 -o "$UTILISATEUR" -g "$UTILISATEUR" "$DOSSIER"

if [ -e "$REPERE" ]; then
  echo "   Photos modèles : reprise déjà faite, rien à copier ($(find "$DOSSIER" -maxdepth 1 -type f | wc -l) fichiers)."
  exit 0
fi

if [ ! -d "$SOURCE" ]; then
  echo "   Photos modèles : $SOURCE absent, aucune reprise (dossier vide prêt)."
  exit 0
fi

COPIEES=0; GARDEES=0
for f in "$SOURCE"/*; do
  [ -f "$f" ] || continue
  cible="$DOSSIER/$(basename "$f")"
  if [ -e "$cible" ]; then
    GARDEES=$((GARDEES + 1))
  else
    install -m 640 -o "$UTILISATEUR" -g "$UTILISATEUR" "$f" "$cible"
    COPIEES=$((COPIEES + 1))
  fi
done
date -Is > "$REPERE"
chown "$UTILISATEUR:$UTILISATEUR" "$REPERE"
echo "   Photos modèles : reprise faite — $COPIEES copiées, $GARDEES déjà présentes (non écrasées)."
