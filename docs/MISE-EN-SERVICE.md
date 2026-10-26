# Mise en service — VPS OVH

> Agent `deploiement`. Ce document est la procédure de référence. Il est
> **incomplet** : seules les parties « photos modèles », « sauvegarde » et
> « retour arrière » sont rédigées (26/10/2026). La liste de contrôle complète
> et les contacts restent à écrire.

Production : VPS OVH (Gravelines), Ubuntu 24.04. Fichiers dans `deploiement/vps/`.

| Chemin sur le serveur | Contenu | Écrasé au déploiement ? |
|---|---|---|
| `/opt/pain-patisserie` | le code (clone git, propriétaire `pain`) | **oui** (`git reset --hard`) |
| `/etc/pain-patisserie/env` | secrets + réglages (root:pain, 640) | non — jamais dans le dépôt |
| `/var/lib/pain-patisserie/modeles` | photos modèles de la galerie (pain:pain, 750) | **non** — ce sont des données |
| `/var/backups/pain-patisserie` | sauvegardes vérifiées (root, 700) | non |

## Règles (rappel)

- Jamais de déploiement sans l'accord explicite du gérant. Jamais un vendredi,
  ni la veille d'un pic. Le bon moment : **lundi matin** (mardi fermé).
- Avant toute migration : une sauvegarde **vérifiée** (voir plus bas — le
  script la restaure dans une base jetable avant de la déclarer valide).

## Photos modèles (dossier de données)

Le gérant ajoute des photos modèles depuis la tablette. Un fichier ajouté à
l'exécution dans `public/` n'est pas servi par `next start` et serait écrasé au
déploiement suivant : les photos vivent donc **hors du code**, dans le dossier
désigné par la variable `DOSSIER_PHOTOS_MODELES` (chemin absolu, pas un secret).

| Environnement | Valeur | Posée par |
|---|---|---|
| Production | `/var/lib/pain-patisserie/modeles` | `installer.sh` ou, s'il manque, `deployer.sh` (dans `/etc/pain-patisserie/env`) |
| Recette | `<projet>/donnees/modeles` (ignoré par git) | `npm run recette:base` (dans `.env.recette`) ; défaut appliqué par le lanceur si la ligne manque |
| Dev simple | à poser dans `.env.local`, voir `.env.example` | à la main |

**Reprise des 152 images du dépôt** (`public/modeles/`) : faite **une seule
fois**, sans jamais écraser un fichier présent, par
`deploiement/vps/preparer-photos-modeles.sh` (appelé par `installer.sh` et
`deployer.sh`) et, en recette, par l'étape 3/3 de `npm run recette:donnees`
(aussi rejouée sans effet au lancement de `recette:dev`/`recette:tablette`).
Un repère `.reprise-modeles-faite` est posé **à côté** du dossier (pas dedans) :
aux déploiements suivants plus rien n'est copié, une photo retirée ne revient pas.
Pour refaire une reprise volontairement : supprimer ce repère, relancer le script
(il n'écrase toujours rien).

Les fiches des photos (rayon, produit, note, masquée) sont en base (table
`PhotoModele`) ; les fichiers sont dans le dossier. **Les deux se sauvegardent
et se restaurent ensemble** (même horodatage).

Envoi d'une photo : Caddy accepte au plus **15 Mo** par requête
(`request_body max_size`), assez pour une photo de téléphone avant réduction.

## Sauvegarde automatique vérifiée

`deploiement/vps/sauvegarder.sh`, lancé chaque soir à 21h30 (heure du serveur)
par `pain-sauvegarde.timer` :

1. copie de la base locale (`pg_dump`, format custom) ;
2. archive du dossier des photos modèles ;
3. **vérification** : la copie est restaurée dans une base jetable
   `pain_verif`, le nombre de lignes est comparé table par table avec la base
   réelle ; l'archive des photos est relue et doit contenir autant de fichiers
   que le dossier ;
4. si tout concorde : `DERNIERE-VERIFICATION` = `OK`, rotation à 30 jours ;
   sinon le service passe en échec et **on ne déploie ni ne migre** tant que ce
   n'est pas résolu.

Contrôle : `sudo cat /var/backups/pain-patisserie/DERNIERE-VERIFICATION` ·
`systemctl list-timers pain-sauvegarde.timer` · `journalctl -u pain-sauvegarde -n 50`.

**Limite connue — à traiter :** ces copies sont sur le même serveur. Elles
protègent d'une erreur ou d'une migration ratée, pas de la perte du VPS. Il
manque une copie hors du serveur que le gérant peut récupérer lui-même (à
décider : téléchargement depuis l'écran de gestion, ou copie OVH Object Storage).

### Restaurer

Toujours restaurer la base **et** les photos du **même horodatage**.

```bash
sudo systemctl stop pain-patisserie
# Base (remplace le contenu) :
sudo -u postgres dropdb pain && sudo -u postgres createdb -O pain pain
sudo cat /var/backups/pain-patisserie/base-AAAAMMJJ-HHMMSS.dump | sudo -u postgres pg_restore --no-owner --role=pain --exit-on-error --dbname=pain
# Photos (le dossier actuel est mis de côté, jamais supprimé) :
sudo mv /var/lib/pain-patisserie/modeles /var/lib/pain-patisserie/modeles.avant-restauration
sudo tar -xzf /var/backups/pain-patisserie/photos-AAAAMMJJ-HHMMSS.tar.gz -C /var/lib/pain-patisserie
sudo chown -R pain:pain /var/lib/pain-patisserie/modeles
sudo systemctl start pain-patisserie
```

## Retour arrière du code

`deployer.sh` ne redémarre rien si une étape échoue : l'ancienne version
continue de tourner. Si la nouvelle version tourne mais se comporte mal :

```bash
cd /opt/pain-patisserie
sudo -u pain git log --oneline -5          # repérer le commit précédent
sudo -u pain git reset --hard <commit>
sudo -u pain npm ci --no-audit --no-fund
sudo -u pain bash -c 'set -a; . /etc/pain-patisserie/env; set +a; npm run build'
sudo systemctl restart pain-patisserie
```

(`deployer.sh` ne sait viser qu'une branche distante, pas un commit.)
Durée estimée : 3 à 6 minutes (surtout la construction). **Non encore
chronométrée sur le VPS — à tester avant la prochaine mise en ligne.**

Photos et retour arrière : le dossier des photos est hors du code, un retour
arrière n'y touche pas. Une version antérieure à la galerie en base lit encore
`public/modeles/` : elle montre les 152 photos d'origine, les photos ajoutées
restent sur le disque et réapparaissent au redéploiement. Les migrations de la
galerie sont additives (aucune colonne retirée) : pas besoin d'annuler la
migration pour revenir en arrière.

## Prochain déploiement (galerie modifiable) — ce que le propriétaire fait

À faire un lundi matin, après accord du gérant, sur le serveur :

1. Mettre en place la sauvegarde (une seule fois, le VPS étant déjà installé) :
   ```bash
   # Récupère le code sans toucher à la version en marche (pas de redémarrage ici).
   cd /opt/pain-patisserie && sudo -u pain git pull --ff-only
   sudo install -m 644 deploiement/vps/pain-sauvegarde.service deploiement/vps/pain-sauvegarde.timer /etc/systemd/system/
   sudo systemctl daemon-reload && sudo systemctl enable --now pain-sauvegarde.timer
   sudo systemctl start pain-sauvegarde    # sauvegarde vérifiée AVANT la migration
   sudo cat /var/backups/pain-patisserie/DERNIERE-VERIFICATION   # doit commencer par OK
   ```
2. Mettre à jour Caddy (limite d'envoi 15 Mo), en remplaçant le domaine :
   ```bash
   sudo sed "s/{\$DOMAINE}/vps-xxxx.vps.ovh.net/" deploiement/vps/Caddyfile | sudo tee /etc/caddy/Caddyfile.nouveau >/dev/null
   sudo caddy validate --config /etc/caddy/Caddyfile.nouveau --adapter caddyfile \
     && sudo mv /etc/caddy/Caddyfile.nouveau /etc/caddy/Caddyfile && sudo systemctl reload caddy
   ```
3. Déployer : `sudo bash /opt/pain-patisserie/deploiement/vps/deployer.sh`
   — il ajoute `DOSSIER_PHOTOS_MODELES` au fichier env s'il manque, crée
   `/var/lib/pain-patisserie/modeles`, y copie les 152 images une fois, puis
   installe (`sharp` compris), migre, construit, redémarre.
4. Vérifier en vrai : ouvrir la galerie sur la tablette, ajouter une photo prise
   au téléphone, la retrouver après `sudo systemctl restart pain-patisserie`.
