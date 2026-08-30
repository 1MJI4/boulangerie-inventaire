# Mise en route — base Supabase + corrections

L'ancienne base Railway n'est plus accessible : on repart d'une base Supabase
vide. Ce document couvre l'installation, puis résume ce qui a changé dans
l'application.

Projet Supabase : `rxiluauicqgbpjwuzwya`, région `eu-west-1`.

---

## 1. Renseigner le mot de passe

`.env` est déjà rempli sauf le mot de passe de la base. Remplace les deux
occurrences de `[PASSWORD]`, ou colle directement les chaînes données par le
bouton **Connect** du dashboard.

| Variable | Pooler | Port | Sert à |
|---|---|---|---|
| `DATABASE_URL` | Transaction | `6543` | L'application |
| `DIRECT_URL` | Session | `5432` | Les migrations Prisma |
| `CODE_GESTION` | — | — | Code demandé pour modifier le catalogue |

`CODE_GESTION` remplace le `5551` qui était écrit en dur dans le code source.
Change sa valeur : elle était visible par quiconque a accès au dépôt.

## 2. Créer les tables et les produits

Deux chemins équivalents. Le premier ne demande rien d'installé.

**Option A — une requête SQL.** Copie tout `setup-supabase.sql` dans
**SQL Editor → New query → Run**. Le script crée les tables, insère les
123 produits avec leur catégorie et leur poste, et enregistre les 4 migrations
dans `_prisma_migrations`. Il est rejouable sans risque.

**Option B — par Prisma**, dans un terminal Windows :

```bash
npx prisma migrate deploy
npm run db:seed
```

## 3. Régénérer le client Prisma — obligatoire

```bash
npx prisma generate
```

Le schéma a gagné des colonnes (`categorie`, `poste`, `actif`, `faitLe`) et
`quantiteRestante` est devenu nullable. Tant que cette commande n'est pas
passée, TypeScript signalera des colonnes inconnues dans `src/app/api/`.

## 4. Lancer

```bash
npm run dev
```

---

## Ce qui a changé dans l'application

### La journée de production

`src/lib/dateProduction.ts` introduit une seule notion de date métier, calculée
en heure de Bruxelles avec une bascule à 14h. Avant 14h la journée en cours est
aujourd'hui ; après, c'est celle du lendemain.

C'était le bug le plus coûteux : la feuille du fournil calculait
« aujourd'hui + 1 jour ». Ouverte à 3h du matin elle cherchait les prévisions du
surlendemain et n'affichait rien, alors que le manager les avait bien saisies.
Le manager à 18h et le pâtissier à 4h désignent désormais la même journée.

La date de travail est affichée en toutes lettres sur chaque écran, et un
sélecteur permet de revenir sur une journée passée.

### Un champ vide n'est plus un zéro

`quantiteRestante` accepte maintenant `NULL`, et seules les valeurs réellement
saisies partent en base. Auparavant, changer de page enregistrait les vingt
lignes de la page — y compris celles que personne n'avait comptées — avec la
valeur 0. Impossible ensuite de distinguer « il n'en reste plus » de
« pas encore compté ». Les deux états sont désormais distincts en base et
visuellement à l'écran.

### La saisie ne se perd plus

`src/lib/useSaisieJournee.ts` regroupe toute la logique de saisie :

- chaque frappe est écrite dans un brouillon local, restauré au rechargement ;
- l'enregistrement part tout seul 1,5 s après la dernière frappe, et non plus
  au seul changement de page ;
- un échec réseau conserve les valeurs en attente et les renvoie au retour de
  la connexion ou quand l'onglet revient au premier plan ;
- l'état d'enregistrement reste affiché en permanence, au lieu d'un message qui
  disparaissait après trois secondes — y compris en cas d'échec, qui était
  jusqu'ici totalement silencieux.

La reprise d'une saisie interrompue fonctionne aussi : la comparaison entre
identifiants de produits confrontait un nombre à une chaîne et échouait
toujours, si bien que les valeurs déjà en base ne réapparaissaient jamais.

### Chacun ne voit que sa liste

Chaque produit porte un `poste` (`patissier`, `boulanger`, `traiteur`) et une
`categorie` correspondant à une zone du magasin. Le manager remplit une
quinzaine de lignes de viennoiserie au lieu de parcourir 123 produits, et le
fournil ouvre directement sa propre feuille.

Le découpage en pages voulu par le client est conservé sur le comptage, mais il
suit les zones du magasin au lieu de tranches de vingt lignes tombant au milieu
d'une famille de produits. Un champ de recherche permet d'atteindre un produit
sans parcourir les pages.

### Aide à la décision sur les prévisions

L'écran du manager affiche, sous chaque produit, ce qui a été produit et ce qui
est resté invendu le même jour de semaine, et propose de pré-remplir les champs
vides avec la moyenne des quatre dernières semaines. Un avertissement signale
les produits habituellement fabriqués laissés sans quantité.

### Écran du fournil

Lecture seule, grands chiffres, une case à cocher par ligne pour suivre
l'avancement, et un bouton d'impression — la feuille scotchée au mur reste le
mode dégradé le plus fiable quand la tablette lâche.

### Pages supprimées

`vente`, `production` et `prevision` étaient des doublons jamais liés depuis
l'accueil, et se comportaient différemment de leurs jumelles : `vente`
enregistrait `0` sur tous les produits, `prevision` écrivait les prévisions sur
aujourd'hui au lieu de demain. Elles restaient atteignables par leur URL.

### Réseau

- La saisie des prévisions envoyait une requête par produit dans une boucle.
  Tout part maintenant en un seul appel.
- Le tableau de bord et l'historique téléchargeaient toute la base pour en
  afficher dix lignes. Les requêtes sont bornées côté serveur.
- L'API borne toute lecture non filtrée, et écrit tout un lot en une
  transaction.

---

## Points d'attention Supabase (offre gratuite)

- **Pas de pause** tant qu'il y a de l'activité : la mise en veille se déclenche
  après 7 jours sans aucune requête. Une saisie quotidienne suffit à l'éviter.
- **500 Mo de base**, très large ici.
- **Pas de sauvegarde automatique.** C'est le vrai point faible : exporte
  régulièrement, via `pg_dump "<DIRECT_URL>" -Fc -f backup.dump` ou l'export CSV
  du Table Editor.

## Ne pas utiliser la section « Supabase CLI » du dashboard

`supabase db push` installe un second système de migrations en parallèle de
Prisma. La source de vérité du schéma est `prisma/schema.prisma`.
