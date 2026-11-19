# Refonte de la prise de commande — détail à valider

Date : 19/11/2026 · Source : essai en magasin par le propriétaire le 19/11/2026.
Statut : **en attente de validation du propriétaire**. Rien n'est codé.

## Pourquoi

En conditions réelles, quatre gênes sont apparues :

1. Les gâteaux les plus vendus (Matadi, Fraisier, croûtes…) sont cachés derrière
   « Bavarois » puis le goût. Trop de touchers, et le libellé perd le nom du gâteau.
2. Deux gâteaux identiques obligent à refaire deux fois tout le chemin.
3. L'écran unique est trop chargé ; l'acompte, placé au milieu, est oublié.
4. Sur une grosse commande, le récapitulatif ne se relit pas d'un coup d'œil comme le carnet.

S'y ajoute une demande : ne plus imprimer le bon ATELIER pour la pâtisserie.

## Ce qui ne change pas

- Aucun prix en dur, tout vient du catalogue (LOI 1). Régime explicite par produit (LOI 6).
- Une ligne = un gâteau, chacun avec ses propres caractéristiques (décision du 28/10/2026).
- Acompte sous 50 % : avertissement, jamais un blocage (décision du 18/10/2026).
- Le récapitulatif à droite reste présent pendant le choix des produits.
- Tout ce qui est contrôlé à l'écran est rejoué au serveur.

## Lot 1 — Bon ATELIER sans la pâtisserie

Aujourd'hui : quatre bons par commande (CLIENT, BUREAU, MAGASIN, ATELIER).

- Commande de pâtisserie seule : trois bons, pas de bon ATELIER.
- Commande sans pâtisserie : quatre bons, inchangé.
- Commande mixte : le bon ATELIER sort avec **uniquement les lignes hors pâtisserie**
  (*choix de Claude, à confirmer*).
- « Pâtisserie » = les familles de gâteaux déjà définies (`FAMILLES_GATEAU`) et leurs
  suppléments (écriture, photo). Donnée existante, jamais déduite du nom.
- La règle vit dans `src/domaine/` ; les trois rendus (imprimante Star, ticket navigateur,
  A6) l'appliquent de la même façon.

## Lot 2 — Gâteaux du comptoir en accès direct

Une tuile par gâteau, en tête du rayon gâteaux, avant Layer Cake, Number Cake et pièces
montées. Un toucher, puis les boutons de taille.

| Tuile | Jusqu'à 8P | Au-dessus de 8P |
|---|---|---|
| Bavarois framboise / fruits de la passion / mangue, Fraisier, Matadi chocolat, Mousse chocolat, Bavarois (autre goût) | prix du comptoir, fixe | prix par personne du Bavarois (plancher, modifiable vers le haut) |
| Forêt noire | prix du comptoir, fixe | prix par personne du Bavarois (décision du 19/11/2026) |
| Crème fraîche | prix du comptoir (6P, 8P) | prix par personne déjà en place, goût Vanille (R70) |
| Croûte fruits / fraises / framboises | prix du comptoir (6P, 8P) | **non proposé** tant que le prix n'est pas donné |
| Tartes | prix du comptoir (6P) | pas d'autre taille |

Changement de règle (R60) : **le prix du comptoir s'arrête à 8P**. Le Bavarois 10P n'est
plus vendu au prix fixe sur commande ; il passe au prix par personne.

Le libellé garde le nom du gâteau à toutes les tailles (« Fraisier 10 parts », pas
« Bavarois 10 parts »), à l'écran comme sur les bons.

### Approches envisagées

- **A — Les tuiles sont des raccourcis (retenue).** La tuile « Fraisier » ouvre le Bavarois
  sur commande avec le goût déjà choisi ; le prix suit la table de correspondance existante,
  dont on retire l'entrée 10P et où l'on ajoute la Forêt noire. Croûtes et tartes : la tuile
  regroupe simplement les tailles du comptoir. Peu de nouveau code, les contrôles serveur
  existants continuent de servir, aucun nouveau tarif à importer.
- **B — Un nouveau produit sur commande par gâteau.** Plus propre sur le papier, mais
  demande une nouvelle version du tarif et duplique le prix par personne sur chaque produit.
- **C — Tuiles branchées directement sur les produits du comptoir**, avec bascule vers le
  Bavarois au-dessus de 8P. Deux chemins de prix pour un même gâteau : source d'écarts.

La liste des tuiles est une donnée explicite (clé du gâteau, goût, tailles), contrôlée par
un test sur le vrai catalogue.

## Lot 3 — Plusieurs gâteaux identiques en un geste

Après la taille, un choix « Combien ? » : **1 · 2 · 3 · Autre**. Il crée autant de lignes
identiques (même gâteau, taille, goût, forme).

Puis l'écriture, une seule question pour le lot :
« La même sur les N » · « Une différente par gâteau » · « Sans écriture ».
Un supplément Écriture par gâteau qui en porte une, comme aujourd'hui.

Dans le récapitulatif, des gâteaux strictement identiques s'affichent regroupés
(« 2 × Croûte framboises 6P ») ; un toucher les déplie pour en modifier un seul.
En base et sur les bons, ils restent des lignes séparées.

## Lot 4 — Trois étapes et un récapitulatif façon carnet

| Étape | Contenu |
|---|---|
| 1. Client | Nom, téléphone, origine, date et heure de retrait |
| 2. Produits | Grille des produits + récapitulatif à droite |
| 3. Paiement | Bon relu en pleine largeur, remarques de la commande, total, acompte, mode de paiement, prénom du vendeur, Valider |

Remarques et acompte sur le même écran (demande du propriétaire, 19/11/2026) : dans
l'ordre de lecture, le bon, puis les remarques, puis l'argent. Les précisions propres à
un gâteau (goût, écriture, forme) restent sur sa ligne, à l'étape 2.

- Chaque refus s'affiche à son étape, à la saisie (LOI 3, LOI 7). On peut revenir en arrière
  sans rien perdre.
- **Téléphone** : reste obligatoire, avec une coche « joignable sur WhatsApp »
  (*choix de Claude, à confirmer* — sans numéro recopié, le bon ne permet plus de rappeler
  le client ; le rendre facultatif changerait la LOI 11).
- **Acompte** : à l'étape 3, « Valider » reste inactif tant qu'on n'a pas saisi un montant
  ou touché « Pas d'acompte ». Ensuite, règle du 18/10 inchangée.
- **Récapitulatif** : une ligne par produit (quantité, nom, prix), précisions en petit
  dessous, regroupement par famille (salé, gâteaux, reste), total fixé en bas, liste qui
  défile seule, dernière ligne ajoutée surlignée un instant.
- Téléphone étroit : mêmes trois étapes, le récapitulatif s'ouvre par un bandeau en bas.

## Ordre proposé

Lot 1 (petit, indépendant) → Lot 2 → Lot 3 → Lot 4 (le plus gros, uniquement de l'écran).
Chaque lot est livrable et testable seul.

## Points ouverts

1. ~~Fraisier 10P~~ — **résolu le 19/11/2026** : l'écran affichait 39 € (Bavarois 10P du
   tarif de septembre) au lieu de 45 €. Le tarif de novembre (45 €) est en service depuis
   le 19/11 et le propriétaire a contrôlé 45 € sur la tablette. Le Lot 2 donnera le même
   montant par le prix par personne (10 parts au plancher du Bavarois).
2. **Croûte 10P** : prix à donner par le propriétaire (absent des tarifs 09 et 11/2026).
3. Bon ATELIER d'une commande mixte : lignes hors pâtisserie seulement, ou bon complet ?
4. Téléphone facultatif pour une commande WhatsApp, ou obligatoire avec coche ?

## Hors périmètre

Inventaire, prévisions, caisse, tarifs eux-mêmes, affiches.

## Laissé à la réalisation

Noms des fichiers et des fonctions, détail visuel (géré par `design-ux`), répartition entre
agents propriétaires (`regles-metier`, `catalogue-prix`, `commandes-traiteur`, `impression`,
`tests`), mise à jour de `CLAUDE.md`, `docs/REGLES-METIER.md` et `docs/QUESTIONS-GERANT.md`.
