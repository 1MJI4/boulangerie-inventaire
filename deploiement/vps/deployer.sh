#!/usr/bin/env bash
# deploiement/vps/deployer.sh — met en ligne la dernière version de « main ».
#
# Sur le serveur : sudo bash /opt/pain-patisserie/deploiement/vps/deployer.sh
# Étapes : récupérer le code, installer les dépendances, appliquer les
# migrations, construire, redémarrer. Si une étape échoue, rien n'est
# redémarré : l'ancienne version continue de tourner.
set -euo pipefail

APP=/opt/pain-patisserie
BRANCHE="${BRANCHE:-main}"
cd "$APP"

lancer() { sudo -u pain --preserve-env=DATABASE_URL,DIRECT_URL bash -c "$1"; }

set -a; . /etc/pain-patisserie/env; set +a

echo "== Code ($BRANCHE)"
lancer "git fetch --quiet origin && git checkout --quiet $BRANCHE && git reset --quiet --hard origin/$BRANCHE"
git log --oneline -1

echo "== Dépendances"
lancer "npm ci --no-audit --no-fund"

echo "== Migrations de la base"
lancer "npx prisma migrate deploy"

echo "== Construction (invariants, Prisma, Next)"
lancer "npm run build"

echo "== Redémarrage"
systemctl restart pain-patisserie
sleep 3
systemctl is-active --quiet pain-patisserie && echo "En ligne." || { journalctl -u pain-patisserie -n 40 --no-pager; exit 1; }
