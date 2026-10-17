# La recette : essayer l'application sans risque

La **recette**, c'est une copie de l'application qui tourne sur le PC, avec sa
propre base de données de test (dans Docker). On peut tout essayer : prendre des
commandes, compter, se tromper. **Rien de ce qu'on y fait ne touche le vrai
magasin.**

> ⚠️ **Ne jamais pointer la recette vers la production.**
> Le fichier `.env.recette` doit toujours désigner la base Docker du PC
> (`localhost`, base `pain_recette`). N'y collez jamais une adresse Supabase.
> Le lanceur refuse de démarrer sinon, et affiche la base utilisée à chaque
> lancement :
> `[recette] DATABASE_URL → base « pain_recette » sur localhost:55432 … OK`
> Le fichier `.env` (sans « .recette ») est celui de la **production** :
> on n'y touche pas.

## Avant de commencer

- **Docker Desktop** doit être lancé (icône de la baleine).
- Les commandes se tapent dans un terminal, dans le dossier du projet.

## Première fois (5 minutes)

```
npm run recette:base       démarre la base de test (et crée .env.recette)
npm run recette:migrer     prépare les tables
npm run recette:donnees    charge la liste d'inventaire et le catalogue (328 produits)
```

Puis, pour avoir quelques commandes d'exemple : lancer l'application (ci-dessous),
et dans un **deuxième** terminal :

```
npm run recette:demo       crée 5 commandes de test sur différents jours
```

## Tous les jours

| Je veux… | Je tape |
|---|---|
| Voir l'application **sur le PC** | `npm run recette:base` puis `npm run recette:dev` → ouvrir http://localhost:3000 |
| Voir l'application **sur le PC et la tablette** | `npm run recette:base` puis `npm run recette:tablette` → ouvrir l'adresse affichée (ex. `http://192.168.1.140:3000`) **sur les deux** |
| Arrêter l'application | `Ctrl + C` dans le terminal |
| Arrêter la base (les données restent) | `npm run recette:arreter` |
| Après une **mise à jour** de l'application | `npm run recette:migrer` **puis** `npm run recette:donnees` (relancer l'import du catalogue : une nouvelle colonne peut avoir besoin d'être remplie) |
| **Tout remettre à zéro** | `npm run recette:effacer` (demande de taper EFFACER), puis refaire « Première fois » |

**Tablette** : elle doit être sur le **même wifi** que le PC. Au premier
lancement, Windows peut demander d'autoriser « Node.js » sur le réseau : c'est
au propriétaire du PC d'accepter (réseau **privé** seulement). Si l'adresse du
PC change (autre wifi, redémarrage de la box), `recette:tablette` affiche la
nouvelle.

Pourquoi deux commandes : avec `recette:dev`, la tablette peut afficher les
pages mais **ne peut rien enregistrer** (l'application refuse ses envois par
sécurité). Avec `recette:tablette`, le PC et la tablette enregistrent tous les
deux, à condition d'utiliser l'adresse affichée (pas « localhost »).

## Les codes de test

Ils sont dans le fichier **`.env.recette`**, à la racine du projet (à ouvrir
avec le Bloc-notes) :

- `CODE_TABLETTE` : à taper une fois sur l'écran « Connexion » de chaque appareil ;
- `CODE_GESTION` : le code gérant (changer les prix, les produits, les gâteaux).

Ce sont des codes **de test**, différents de ceux du magasin. Ce fichier ne part
jamais sur GitHub. S'il est effacé, `npm run recette:base` en recrée un avec de
nouveaux codes.

## Si ça ne marche pas

| Message | Que faire |
|---|---|
| « la base de recette ne répond pas » | Lancer Docker Desktop, puis `npm run recette:base` |
| « le fichier .env.recette manque » | `npm run recette:base` |
| « … n'est pas cette machine » / « ne contient pas recette » | `.env.recette` a été modifié : le supprimer, puis `npm run recette:base` |
| La tablette n'affiche rien | Même wifi ? Pare-feu Windows accepté ? Bonne adresse (celle affichée par `recette:tablette`) ? |
| « Cette demande ne vient pas de l'application » | Lancer `recette:tablette` (et non `recette:dev`) et ouvrir l'adresse affichée |

## Pour l'équipe technique

- `docker-compose.recette.yml` : PostgreSQL 15 (comme Supabase), port 55432
  ouvert seulement sur 127.0.0.1, volume `pain_recette_donnees`. Les rôles
  `anon` et `authenticated` de Supabase y sont créés pour que la migration
  `rls_et_revoke` s'y applique comme en production.
- `scripts/recette.mjs` : charge `.env.recette` dans l'environnement du processus
  **avant** Next.js et Prisma (qui ne remplacent jamais une variable déjà posée,
  donc `.env` ne peut pas l'emporter), puis applique le garde-fou (hôte local +
  « recette » dans le nom de base, pour `DATABASE_URL` et `DIRECT_URL`).
- `scripts/recette-demo.mjs` : les commandes de démonstration passent par la
  vraie route `POST /api/commandes` (règles rejouées côté serveur).
