#!/usr/bin/env bash
# deploiement/vps/installer.sh — installation initiale du VPS (Ubuntu 24.04).
#
# À lancer UNE fois, en root (sudo), sur un serveur neuf :
#   sudo DOMAINE=vps-xxxx.vps.ovh.net bash installer.sh
#
# Installe : Node.js 24 LTS, PostgreSQL 17, Caddy (HTTPS automatique), pare-feu.
# Crée : l'utilisateur système « pain », la base « pain » et son rôle, le
# dossier /opt/pain-patisserie (code), /etc/pain-patisserie (secrets),
# /var/lib/pain-patisserie/modeles (photos modèles, données) et la sauvegarde
# quotidienne vérifiée (/var/backups/pain-patisserie, pain-sauvegarde.timer).
#
# Pourquoi un certificat RSA : l'imprimante Star TSP100IV (firmware 3.5) refuse
# les chaînes ECDSA P-384 (testé avec Cloudflare le 21/10/2026) et accepte les
# chaînes RSA. Caddy émet de l'ECDSA par défaut : on force RSA 2048.
set -euo pipefail

: "${DOMAINE:?Indiquer DOMAINE=nom.du.serveur (ex. vps-xxxx.vps.ovh.net)}"
DEPOT="${DEPOT:-https://github.com/1MJI4/boulangerie-inventaire.git}"
BRANCHE="${BRANCHE:-main}"

echo "== Mises à jour du système"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
apt-get install -yq curl ca-certificates gnupg git ufw unattended-upgrades debian-keyring debian-archive-keyring apt-transport-https

echo "== Mises à jour de sécurité automatiques"
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "== Pare-feu : SSH, HTTP, HTTPS uniquement"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "== Connexion SSH par clé uniquement (seulement si une clé est en place)"
UTIL="${SUDO_USER:-ubuntu}"
if [ -s "/home/${UTIL}/.ssh/authorized_keys" ]; then
  sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
  rm -f /etc/ssh/sshd_config.d/50-cloud-init.conf
  # Ubuntu 24.04 : ssh est activé par socket, « reload » peut échouer ; un
  # échec ici ne doit pas interrompre l'installation (la session en cours reste ouverte).
  systemctl reload ssh 2>/dev/null || systemctl restart ssh 2>/dev/null || true
else
  echo "   Aucune clé pour ${UTIL} : connexion par mot de passe laissée active (sinon blocage)."
fi

echo "== Node.js 24 LTS"
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -yq nodejs

echo "== PostgreSQL 17 (dépôt officiel PGDG)"
install -d /usr/share/postgresql-common/pgdg
curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo "$VERSION_CODENAME")-pgdg main" > /etc/apt/sources.list.d/pgdg.list
apt-get update -q
apt-get install -yq postgresql-17

echo "== Base « pain » et son rôle (mot de passe aléatoire, jamais affiché)"
install -d -m 750 /etc/pain-patisserie
if [ ! -f /etc/pain-patisserie/db-motdepasse ]; then
  head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32 > /etc/pain-patisserie/db-motdepasse
  chmod 600 /etc/pain-patisserie/db-motdepasse
fi
MDP="$(cat /etc/pain-patisserie/db-motdepasse)"
sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pain') THEN
    CREATE ROLE pain LOGIN PASSWORD '${MDP}';
  ELSE
    ALTER ROLE pain PASSWORD '${MDP}';
  END IF;
  -- Rôles propres à Supabase, cités par la migration RLS : présents mais
  -- sans connexion possible, pour que la copie de la base se restaure telle quelle.
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END \$\$;
SQL
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='pain'" | grep -q 1 || sudo -u postgres createdb -O pain pain

# Fichier des secrets : l'adresse de la base locale est écrite ici ; les autres
# secrets (SESSION_SECRET, CODE_TABLETTE, CODE_GESTION, CLOUDPRNT_CLE,
# SOURCE_DATABASE_URL) sont ajoutés depuis le PC, jamais par le dépôt.
touch /etc/pain-patisserie/env
chmod 640 /etc/pain-patisserie/env
sed -i '/^DATABASE_URL=/d; /^DIRECT_URL=/d' /etc/pain-patisserie/env
{
  echo "DATABASE_URL=postgresql://pain:${MDP}@127.0.0.1:5432/pain"
  echo "DIRECT_URL=postgresql://pain:${MDP}@127.0.0.1:5432/pain"
} >> /etc/pain-patisserie/env

echo "== Utilisateur système et dossiers"
id pain >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/pain --shell /usr/sbin/nologin pain
install -d -o pain -g pain /opt/pain-patisserie
chown root:pain /etc/pain-patisserie /etc/pain-patisserie/env
if [ ! -d /opt/pain-patisserie/.git ]; then
  sudo -u pain git clone --branch "$BRANCHE" "$DEPOT" /opt/pain-patisserie
fi

echo "== Photos modèles : dossier de données hors du code"
# Pas un secret : écrit ici comme DATABASE_URL, seulement s'il manque.
if ! grep -q '^DOSSIER_PHOTOS_MODELES=' /etc/pain-patisserie/env; then
  echo "DOSSIER_PHOTOS_MODELES=/var/lib/pain-patisserie/modeles" >> /etc/pain-patisserie/env
fi
set -a; . /etc/pain-patisserie/env; set +a
bash /opt/pain-patisserie/deploiement/vps/preparer-photos-modeles.sh

echo "== Caddy (HTTPS automatique, certificat RSA)"
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt-get update -q
apt-get install -yq caddy
sed "s/{\$DOMAINE}/${DOMAINE}/" /opt/pain-patisserie/deploiement/vps/Caddyfile > /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

echo "== Service de l'application"
install -m 644 /opt/pain-patisserie/deploiement/vps/pain-patisserie.service /etc/systemd/system/pain-patisserie.service
install -m 644 /opt/pain-patisserie/deploiement/vps/pain-sauvegarde.service /etc/systemd/system/pain-sauvegarde.service
install -m 644 /opt/pain-patisserie/deploiement/vps/pain-sauvegarde.timer /etc/systemd/system/pain-sauvegarde.timer
systemctl daemon-reload
systemctl enable pain-patisserie

echo "== Sauvegarde vérifiée chaque soir (base + photos modèles)"
systemctl enable --now pain-sauvegarde.timer

echo
echo "Installation terminée."
echo "Reste à faire : déposer /etc/pain-patisserie/env (secrets), copier la base, puis lancer deployer.sh."
