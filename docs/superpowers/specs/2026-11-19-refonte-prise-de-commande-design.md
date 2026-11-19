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

---

# Complément du 19/11/2026 — viande des burgers et un papier par poste

Demande du propriétaire, avec ses réponses du même jour. Statut : **à valider**. Rien n'est codé.
Ce complément **remplace le Lot 1** (bon atelier sans la pâtisserie), qu'il englobe.

## Lot 5 — Viande obligatoire sur les burgers

- Un burger porte **une viande** : Poulet tenders · Kefta · Viande hachée de poulet.
  Sans viande, la ligne est **refusée à la saisie**, avec les trois viandes en boutons.
  Pas de sortie « au choix » : un burger sans viande ne se vend pas.
- Produits concernés (*proposition de Claude, à confirmer*) : Burger, Mini-Burger (comptoir),
  Mini burger (sur commande). La liste est une donnée, jamais déduite du nom.
- **Une viande par ligne** (décision du propriétaire) : 15 kefta et 15 tenders font **deux
  lignes**. Un bouton « ＋ Autre viande » sur la ligne en crée une seconde ; deux lignes du même
  burger à des viandes différentes ne sont pas signalées comme doublon.
- Le minimum de 10 mini burgers se compte **sur le total des lignes** du même produit, pas par
  viande (*proposition de Claude, à confirmer* : sinon 15 + 5 serait refusé).
- Sur les bons : « VIANDE : KEFTA » sous la ligne.
- Réalisation : même mécanisme que le goût à liste fermée des bûches (R67), avec son propre
  vocabulaire et sans « Au choix du pâtissier ».

## Lot 6 — Un papier par poste de production

**Trois postes** : pâtissier, atelier (salé), boulanger. Une commande peut en concerner un,
deux ou trois ; il sort **un papier par poste concerné**, et seulement ceux-là.

Qui fait quoi (réponses du propriétaire, 19/11/2026) :

| Produit | Pâtissier | Atelier | Boulanger |
|---|---|---|---|
| Gâteaux, entremets, pièces montées, individuelles | tout | | |
| **Minis sucrés** (tartelette, bavarois, éclair / mille-feuille) | tout | | |
| **Viennoiserie** | tout | | |
| Traiteur salé, sandwichs, salés du comptoir | | tout | |
| **Burger, mini burger** | | montage | **le pain**, 1 par pièce |
| **Msemen, Meloui** | | | la pâte, **cuits** |
| **Batbout** (petit, farci, healthy, mini) | | la farce s'il y en a | **le pain** |
| **Crêpe farcie** | | tout | **prévenu au-delà de 5**, sur le **total de la commande** |
| Pains (rayon Boulangerie) | | | tout (*proposition de Claude, à confirmer*) |

Ce tableau est une **donnée** par produit (`src/catalogue/postesProduction.ts`), contrôlée par un
test sur le vrai catalogue : chaque produit vendable a au moins un poste, sinon le test échoue —
plus aucun produit ne peut « n'être à personne », comme les minis sucrés aujourd'hui.

**Échéance du boulanger** : **2 heures avant l'heure de retrait**, pour tout ce qui le concerne
(retrait 10h00 → prêt à 8h00). La durée est un réglage, pas un chiffre en dur. Le boulanger
travaille la nuit : une échéance à 4h ou 5h est normale et n'est pas signalée.

**Les papiers**

- CLIENT, BUREAU, MAGASIN : complets, comme aujourd'hui.
- PÂTISSIER, ATELIER, BOULANGER : **bons de production** — seulement les lignes du poste, **sans
  prix**, avec en tête la date et l'heure, les allergies et les remarques.
- BOULANGER : « **PRÊT POUR 8h00** » en gros, puis « retrait 10h00 ».
- ATELIER : sous un burger, « Pain : boulanger, prêt à 8h00 », pour que personne n'attende l'autre.
- Chaque bon de production cite les autres postes concernés (« + pâtissier : 1 gâteau »).
- **Réimpression** (demande du propriétaire) : sur la page d'impression, un bouton par papier,
  en **1 ou 2 exemplaires**.
- Commande modifiée : seuls les postes dont les lignes ont changé sont réimprimés.

**Ce que ce lot règle en passant** (constats de la simulation) : le bon atelier inutile pour la
pâtisserie seule, le prix qui encombre les bons de production, les minis sucrés sans poste.

## Approches envisagées (Lot 6)

- **A — Postes par produit, en donnée, plusieurs postes possibles (retenue).** Un burger
  concerne deux postes avec un rôle chacun. Demande un tableau à tenir, vérifié par un test.
- **B — Garder le champ « poste » unique existant** sur chaque produit. Plus simple, mais un
  burger ne peut pas dire « atelier **et** boulanger » : c'est exactement le cas demandé.
- **C — Déduire le poste du rayon** (Salés → atelier…). Aucun tableau, mais faux pour le
  burger, le batbout, le msemen (rayon Oriental) et les minis sucrés, et interdit par la LOI 6.

## Hors de ce complément

Une liste « à préparer aujourd'hui » par poste, réimprimée chaque matin (proposée par Claude,
pas demandée) ; les allergies comme champ à part (constat de la simulation, à traiter seul).

## Ordre

Lot 5 (petit, indépendant) puis Lot 6.
