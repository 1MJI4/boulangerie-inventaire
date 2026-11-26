@AGENTS.md

# Pain Pâtisserie — contexte projet

> Ce fichier est chargé automatiquement par Claude Code dans **chaque session et chaque
> sous-agent**. C'est la source unique des règles. **Une règle se modifie ICI, jamais dans
> un composant.** Si vous voyez une règle métier dupliquée dans le code, c'est un bug.

## Le projet

Application de gestion pour la boulangerie-pâtisserie « Pain Pâtisserie » (Belgique).
Trois usages, par ordre de priorité :

1. **Inventaire** en dépôt/magasin — remplace une feuille Excel imprimée remplie à la main
2. **Prise de commande sur mesure** — traiteur salé et gâteaux
3. **Impression** — feuilles de comptage, bons de commande, étiquettes, fiches de production

Utilisateurs : employés de magasin et de dépôt, pas des informaticiens. Debout, mains
occupées, téléphone ou tablette, réseau faible. **Interface en français.**

## Sources de vérité

| Fichier | Contenu |
|---|---|
| `data/catalogue_prix_2026-09.csv` | Tarif comptoir, 351 lignes, en vigueur 09/2026 |
| `docs/TARIFS-SUR-COMMANDE.md` | Les deux affiches du gérant (traiteur salé + gâteaux) |
| `docs/REGLES-METIER.md` | Référentiel des règles, avec colonne « confirmé par le gérant » |
| `docs/QUESTIONS-GERANT.md` | Ce qui reste à trancher — ne jamais inventer une réponse |

Catégories du catalogue : Individuelle 56 · Boulangerie 49 · Favoris 49 ·
Gâteaux et tartes 47 · Viennoiserie 35 · Salés 28 · Frigo-Boisson 23 · Oriental 21 ·
Special fin d'année 13 · Frigo-S 12 · Sandwichs Froids 10 · Café 8

---

## LOI N°1 — Les prix

- **Aucun prix n'est jamais écrit en dur** dans le code, les composants, les tests ou les
  maquettes. Tout prix vient du catalogue.
- Montants stockés et calculés en **entiers (centimes)**. Jamais de flottant.
  `1,30 €` → `130`. Interdiction absolue de faire de l'arithmétique à virgule sur de l'argent.
- Les prix du CSV sont **TTC**. La ventilation TVA (6 % à emporter / 12 % sur place en
  Belgique) est **à confirmer** auprès du comptable : champ `taux_tva` par produit,
  configurable, jamais codé en dur.
- Catalogue **versionné par date d'effet** (`valide_du` / `valide_au`). Un nouveau tarif
  n'écrase jamais l'ancien. Une commande ou un inventaire passé garde le prix en vigueur
  à sa date.
- Tout écart entre un prix affiché et le catalogue est un **bug bloquant**.

## LOI N°2 — Les unités

Deux unités coexistent et ne doivent jamais être confondues :

- `piece` — quantité entière (par défaut)
- `kg` — quantité décimale, prix au kilo. **Exactement 4 produits**, catégorie Oriental :
  Corne de gazelle 28 €/kg · Halwa arbia 25 €/kg · Sellou 22 €/kg · Sablé orientaux 22 €/kg

En inventaire on saisit un **poids** (balance), pas un nombre de pièces. En vente,
`total = poids_kg × prix_kg`, arrondi half-up au centime. L'écran doit afficher « kg » et
proposer un pavé décimal, jamais un bouton « +1 ».

Un produit `kg` compté à la pièce est une erreur silencieuse — exactement ce que ce
dispositif existe pour empêcher.

**Plateaux** (décision du propriétaire, 17/11/2026, R69) : Croissant et Couque au chocolat
se **demandent au fournil en plateaux entiers** de 36 pièces (prévisions manager + feuille
pâtissier). Ce n'est **pas une troisième unité** : la base garde des **pièces**
(plateaux × contenance + part commandée), la part commandée reste en pièces, et le
**comptage des restes reste en pièces**. Contenance = donnée du produit
(`Produit.piecesParPlateau`), jamais déduite du nom. Règles : `src/domaine/plateaux.ts`.

**Produits dérivés et commandes au fournil** (décision du propriétaire, 19/11/2026, R72) :
« Croissant à la pâte d'amande » et « Couque au chocolat double » n'ont **pas de ligne au
fournil** : leurs commandes **augmentent leur base** (Croissant, Couque au chocolat), 1 pour 1,
comme les commandes de Croissant et de Pain chocolat simples. « Croissant aux amandes » et
« Croissant au chocolat » sont des **produits à part**, à ne pas confondre. Le lien
commande → fournil est une **donnée** (`src/catalogue/basesFournil.ts`), jamais déduite du
nom ; c'est la seule passerelle entre les deux listes (LOI 10). Une même ligne de commande peut
viser deux produits du fournil selon son choix (Beignet « Sucré » / « Nature »). La part des
commandes est **recalculée en entier** depuis les commandes non annulées (jamais additionnée au fil
de l'eau). **Prévisions simplifiées (propriétaire, 21/11/2026)** : pour **tous** les produits reliés
(Couque au beurre comme Croissant), les pièces commandées **préremplissent** les champs du
manager (plus de plateau complété), qui les **modifie ensuite** : 10 commandées → « + 10 », 36 → 1 plateau. **La
tolérance de 9 (25 % d’un plateau de 36) est gardée pour Croissant et Couque au chocolat (plateaux)** : jusqu'à 9 pièces rien n'est rempli (prises sur la vente normale), mais
l'écran dit « 9 en commande » et propose de les ajouter d'un geste (45 → 1 plateau, « 9 en
commande »). Rien n'est plus ajouté tout seul en base
(`commandeAuto` / `plateauCommandes` à 0), sinon la part compterait deux fois ; l'écran du pâtissier signale
« N commandés pas encore dans la prévision » tant que le manager n'a pas ouvert les prévisions. Règles :
`src/domaine/commandesFournil.ts` (`preremplirCommandes`).

## LOI N°3 — Le jour de fermeture

```
JOURS_FERMETURE = ["mardi"]   // configurable, jamais en dur dans un composant
```

Toute date tombant un jour de fermeture est **rejetée immédiatement à la saisie**, pas à
la validation finale.

- Code : `ERR_JOUR_FERME`
- Message : « Fermé le mardi — choisissez un autre jour de retrait. »

Validation obligatoire aux **trois niveaux**, les trois :

1. **UI** — le mardi est désactivé dans le sélecteur de date
2. **Domaine** — `validerDateRetrait(date)` rejette
3. **Persistance** — contrainte en base / refus serveur

Une protection seulement côté interface ne compte pas : l'app est offline-first, les
données arrivent aussi par la synchronisation.

**Cascade à ne pas oublier :** la production se fait souvent la veille. Une commande à
retirer le mercredi matin impliquerait une production le mardi (fermé). Les délais se
comptent donc en **jours ouvrés**, jamais en heures calendaires.

Fermetures exceptionnelles : même mécanisme. La liste des jours fermés est une **donnée**,
pas une constante. Décision du propriétaire (18/10/2026) : **seul le mardi est fermé** — les
jours fériés sont ouverts, pas de congés. La liste reste disponible (vide) pour une
fermeture exceptionnelle décidée par le gérant.

## LOI N°4 — « Favoris » n'est pas une catégorie

Les 49 lignes marquées `Favoris` sont des **doublons** de produits déjà présents dans
Boulangerie, Sandwichs Froids, Individuelle, Oriental, Viennoiserie, Salés, Frigo-Boisson.
C'est une liste d'accès rapide, pas un rayon.

→ Un produit a **un** identifiant unique et un booléen `est_favori`.
→ Un favori ne doit jamais être compté deux fois dans un inventaire ni dans un total.
   Cas de test obligatoire.

## LOI N°5 — Les libellés

Les libellés affichés sont ceux du catalogue, **à la lettre**, y compris les variantes
orthographiques du gérant. Les employés reconnaissent les produits à leur nom habituel.
Les incohérences se **signalent** dans un rapport, elles ne se corrigent pas unilatéralement.
(Connu : « Bastella » dans l'Excel / « Bestella » sur l'affiche.)

## LOI N°6 — Trois régimes de prix coexistent

C'est le piège principal de ce métier : un même nom de produit peut avoir trois prix
construits différemment.

| Régime | Contexte | Construction du prix |
|---|---|---|
| **A** | Comptoir / vitrine | Prix fixe à la pièce ou au kilo (catalogue CSV) |
| **B** | Traiteur salé sur commande | Prix fixe à la pièce + minimum **bloquant** |
| **C** | Gâteaux sur commande | Prix **par personne**, « à partir de » = **plancher** |

« Les gâteaux du comptoir restent au prix connu » (affiche du gérant) : un Bavarois 6P en
vitrine = 31,00 €. Le même commandé en régime C = 4,50 €/pers minimum, prix modifiable
**vers le haut** par le pâtissier.

→ `total = nb_parts × prix_par_personne`, le prix/personne pré-rempli au plancher.
→ Un prix/personne saisi **sous** le plancher est refusé (`ERR_SOUS_PLANCHER`), sauf
  déverrouillage explicite par le gérant, tracé avec son identité.
→ Exception (décision du propriétaire, 18/10/2026, R60) : un gâteau simple commandé dans une
  taille qui existe au comptoir, **jusqu'à 8 parts** (Bavarois et ses goûts du comptoir —
  Fraisier, Matadi chocolat, Forêt noire… — 4/6/8, Crème fraîche 6/8), devient le gâteau du
  comptoir, au prix exact du tarif, **non modifiable**. **Au-dessus de 8 parts : prix par
  personne** (décision du propriétaire, 19/11/2026 — le Bavarois 10P ne remplace plus un
  gâteau commandé). Correspondance = donnée explicite
  (`src/catalogue/correspondancesComptoir.ts`), jamais déduite du nom.
→ Accès direct (R71, propriétaire 19/11/2026) : les gâteaux du comptoir ont leur **tuile** en
  tête de la famille « Gâteau » (Fraisier, Matadi chocolat, Mousse chocolat, Forêt noire,
  Bavarois framboise / fruits de la passion / mangue, croûtes). Ce sont des **raccourcis**
  (`src/catalogue/raccourcisGateaux.ts`), pas des produits : même prix, mêmes règles.
→ Chaque produit porte un `regime_prix` explicite. **Le régime ne se déduit jamais du nom.**
→ Goût obligatoire (R62, propriétaire 22/10/2026) : tout gâteau sur commande porte **un goût**
  (Entremet : **une recette**, Saint-Michel, Javanais… ; pièce montée : **un goût par étage**),
  sinon `ERR_GOUT_MANQUANT` avec la sortie « Au choix du pâtissier ». Qui demande quoi = donnée
  (`src/catalogue/goutsSurCommande.ts`). Oreo, Speculoos, Kinder, Raffaello, Ferrero, Nutella
  sont des **décorations** (facultatives), pas des goûts.
→ Crème fraîche (R70, propriétaire 17/11/2026) : goût **Vanille** pré-rempli ; tout autre goût
  est refusé (`ERR_GOUT_RESERVE`) sauf **code du manager**, tracé sur la ligne (nom + heure).

## LOI N°7 — Tous les minimums sont BLOQUANTS

**Décision du gérant (15/10/2026) : un minimum non atteint n'est jamais autorisé.**
Pas de supplément, pas de dérogation, pas de calcul de majoration. On oblige à atteindre
le minimum.

En dessous du minimum → **refus** de la ligne, code `ERR_QUANTITE_MIN`, avec une
**proposition corrective en un geste** :

> « Minimum 20 parts pour un Layer Cake. **Passer à 20 parts** » (bouton).

Le refus se déclenche **à la saisie de la ligne**, jamais à la validation du panier.
Une règle qui bloque doit toujours proposer la sortie : refuser sans proposer, c'est perdre
la vente ; refuser en proposant, c'est la sauver en un clic.

Les seuils restent distincts selon le produit — **ne pas les unifier « pour simplifier »** :

| Minimum | Produits |
|---|---|
| 10 pièces | mini pizza/quiche · mini wrap · mini burger · mini batbout · mini-sandwichs |
| 15 pièces | mini tartelette · mini bavarois · mini éclair/mille-feuille |
| 15 parts **par symbole** | Number Cake (« 25 » = 2 symboles = 30 parts) |
| 20 parts | Layer Cake |
| 40 parts | Pièce montée 2 étages (ex-« Gâteau de mariage », renommée le 22/10/2026) |
| 60 parts | Pièce montée 3 étages |
| max 20 sandwichs | Grand pain surprise → au-delà, **proposer un 2e pain** |

Viande des burgers (R73, décision du propriétaire 19/11/2026) : Burger, Mini-Burger et mini
burger sur commande portent **une viande** (Poulet tenders · Kefta · Viande hachée de poulet),
sinon `ERR_VIANDE_MANQUANTE` avec les viandes en boutons — pas de sortie « au choix ». **Une
viande par ligne** : 15 kefta et 15 tenders font deux lignes, jamais signalées comme doublon.
Le minimum de 10 se compte alors sur le **total des lignes** du même burger (15 + 5 = accepté).
Liste et produits = donnée (`src/catalogue/goutsSurCommande.ts`).

« Autre demande » : 8 quoi ? (propriétaire, 26/11/2026) : une ligne libre qui n'est pas un gâteau
porte **l'unité choisie par le vendeur** — Pièces · Personnes · « Autre… » (un mot à écrire) — jamais
présélectionnée, sinon `ERR_CHAMP_OBLIGATOIRE`. Un gâteau libre reste en **parts**. Le bon écrit
« Plateau fruits — 8 personnes » au lieu d'un « 8 × » muet. Règle : `validerUniteLibre`
(`src/domaine/commande.ts`) ; colonne `LigneCommande.uniteLibre` (anciennes lignes : NULL, « N × »).

Postes de production (R74, décision du propriétaire 19/11/2026) : en plus des bons CLIENT
et MAGASIN (**plus de bon BUREAU**), il sort **un papier par poste concerné** — PÂTISSIER, ATELIER, BOULANGER —
avec ses seules lignes, **sans prix**. Pain des burgers et du batbout farci, pâte du msemen et
du meloui (cuits), batbout : boulanger ; crêpes farcies : boulanger prévenu **au-delà de 5 sur
la commande** ; viennoiseries et minis sucrés : pâtissier. Le papier du boulanger porte son
échéance, **2 heures avant le retrait** (réglage `AVANCE_POSTE_MINUTES`). Chaque papier se
réimprime seul, en 1 ou 2 exemplaires. Qui fait quoi = donnée
(`src/catalogue/postesProduction.ts`), jamais déduite du nom ; règle : `src/domaine/postes.ts`.

Saisie (R61, décision du propriétaire 22/10/2026) : un gâteau par personne à minimum
(Layer Cake, Number Cake, pièces montées) se choisit aux **boutons de taille**, comme le
Bavarois, en partant de **son minimum, de 5 en 5** (Layer 20, 25, 30…). Raccourcis, pas une
limite : « Autre » au pavé reste libre au-dessus du minimum. Partout, un nombre déjà affiché
dans un pavé est **remplacé** par le premier chiffre tapé (jamais « 1 » + « 12 » = 112).

> 📌 À signaler au gérant : l'affiche « Gâteaux SIMPLES » annonce encore « Supplément pour
> les gâteaux dont le minimum n'est pas respecté ». L'application, elle, refuse. L'affiche
> gagnerait à être corrigée pour ne pas promettre au client une possibilité qui n'existe plus.

## LOI N°8 — Trois niveaux de signalement

Une application qui ne sait que bloquer fait perdre des ventes ; une qui ne sait rien dire
fait perdre de l'argent. Trois niveaux, visuellement distincts, définis une fois :

| Niveau | Code | Comportement | Exemple |
|---|---|---|---|
| **Bloquant** | `ERR_*` | La saisie est refusée | Retrait un mardi · 9 mini-burgers · 12 parts de Layer Cake · prix sous plancher |
| **Avertissement** | `AVERT_*` | Accepté, signalé, tracé | Produit scanné deux fois · date limite de consommation proche · 21 sandwichs sur un pain surprise |
| **Information** | `INFO_*` | Affiché sans friction | Produit saisonnier bientôt indisponible · tarif en vigueur affiché |

**Tout refus doit proposer la sortie.** Un blocage sans proposition corrective fait perdre la
vente ; avec un bouton « passer à 20 parts » ou « ajouter un 2e pain », elle est sauvée en un
geste. C'est la différence entre une application qu'on utilise et une qu'on contourne.

## LOI N°9 — Messages destinés à des humains

Aucun message technique visible par un employé : pas de « validation failed », pas de code
HTTP, pas de trace. Tout message est en français, dit **quoi faire** et pas seulement ce qui
ne va pas, et porte un code d'erreur typé côté code.

Format de retour de toute validation :

```js
{ ok: false, niveau: "bloquant", code: "ERR_JOUR_FERME",
  message: "Fermé le mardi — choisissez un autre jour de retrait.",
  champ: "dateRetrait", valeurProposee: "2026-10-21" }
```

## LOI N°10 — L'inventaire a ses propres produits

**Décision du propriétaire (15/10/2026).** Les produits d'inventaire (dépôt/magasin, liste
propre au comptage) et les produits du catalogue de commande (CSV comptoir + affiches sur
commande) sont **deux listes séparées**.

→ Un produit du catalogue de commande n'apparaît **jamais** dans un écran d'inventaire, et
  un produit d'inventaire n'apparaît jamais dans une commande.
→ Les deux listes vivent dans des tables distinctes ; aucun import du catalogue n'écrit dans
  la liste d'inventaire. Ne pas les « rapprocher » ni les fusionner pour simplifier.
→ Une saisie d'inventaire sur un identifiant inconnu de la liste d'inventaire est refusée.
  Cas de test obligatoire.
→ La LOI 4 (favoris) concerne le catalogue de commande. En inventaire, la règle équivalente
  est : un même produit d'inventaire n'est jamais compté deux fois.

## LOI N°11 — Règlement intérieur : règles de commande et d'inventaire

Source : `docs/REGLEMENT-INTERIEUR.md` (règlement de la direction, transmis le 15/10/2026).
Ces points ont un effet direct sur l'application :

| Point du règlement | Règle appliquée |
|---|---|
| Acompte de **minimum 50 %** pour valider toute commande | **Un acompte est obligatoire** (décision du propriétaire, 19/11/2026) : sans aucun acompte, la commande est refusée (`ERR_ACOMPTE_OBLIGATOIRE`), sortie « Mettre l'acompte à X € » ; **n'importe quel montant suffit**. Sans acompte : seulement avec le **code du gérant**, tracé sur la commande (nom + heure), vérifié au serveur. Sous 50 % du total : simple **avertissement** (`AVERT_ACOMPTE_INSUFFISANT`, décision du 18/10/2026). Acompte supérieur au total : bloquant |
| Commande pour **le jour même** ou **le lendemain** | **Acceptée** (décisions du propriétaire, 15/10 et 18/10/2026) — simple information « prévenez l'atelier », sans blocage ni code. Aucun délai minimum par défaut, y compris gâteau de mariage / pièce montée ; le délai des gâteaux à étages est un **réglage** du gérant (défaut 0 jour) |
| Retrait pendant les **heures d'ouverture du magasin** (remplace la règle « pâtisserie 9h / 12h », décision du 18/10/2026) | Pour **tous** les produits : heure de retrait hors ouverture refusée (`ERR_HEURE_HORS_OUVERTURE`), sortie vers l'heure d'ouverture ou de fermeture la plus proche. Défaut **6h00 – 20h00**, horaires = **donnée**, réglables par le gérant **jour par jour** et **par date exceptionnelle**. Heure de retrait **obligatoire** (`ERR_CHAMP_OBLIGATOIRE`, décision du propriétaire 22/10/2026) |
| Tailles de gâteau « bizarres » (Bavarois 3P, 7P…) : généralement pas possibles | Nombre de parts d'un gâteau simple sur commande limité aux **tailles standard** (liste = donnée réglable, par défaut 4, 6, 8, 10, 15, 20, 25, 30 — confirmé par le propriétaire). Une autre taille est **refusée** avec la sortie en un geste vers la taille standard la plus proche en dessous et au-dessus (« Passer à 6 » / « Passer à 8 ») ; exception possible par le code gérant, tracée (décision du 15/10/2026) |
| Commande inhabituelle (ingrédients, moules spéciaux…) : demander d'abord au responsable | Avertissement avec sortie « Appeler le responsable / passer par WhatsApp » |
| Toujours indiquer nom, numéro, date et heure de prise de commande | Nom et téléphone obligatoires ; date/heure de prise enregistrées automatiquement. **Commande WhatsApp** (décision du propriétaire, 19/11/2026) : le nom se met d'office à « WhatsApp » (modifiable) et le **numéro n'est pas exigé** — il est déjà dans WhatsApp |
| Inventaire à **20h00, jamais avant** | Avertissement si un inventaire est commencé avant l'heure de fermeture du jour (heures d'ouverture, donnée) |
| Vérifier devant le client que tous les produits sont remis | Liste à cocher au moment de la remise de la commande |
| Qui prend la commande (décision du propriétaire, 14/11/2026) | Le prénom du vendeur se **choisit ou s'écrit à chaque commande**, juste au-dessus de « Valider » (création et modification). **Jamais présélectionné, jamais retenu** d'une commande à l'autre : la tablette est partagée. Sans prénom, la validation est refusée (`ERR_CHAMP_OBLIGATOIRE`, « Touchez votre prénom… »). Les prénoms de ceux qui ont pris une commande **le jour même** restent proposés toute la journée (un toucher), puis la liste repart vide le lendemain |
| Commande reçue par WhatsApp à payer d'avance (propriétaire, 21/11/2026, R75) | **Brouillon** sur l'écran Manager : mêmes contrôles qu'une commande, total calculé par le serveur, message FR/EN avec le total à virer. Délai de paiement **5 min** (retrait le jour même) ou **1 h** ; passé le délai il reste dans « Expirés » (jamais effacé) et le manager est prévenu 5 min après. Un brouillon ne compte pour rien (fournil, prévisions, bon). « Paiement reçu » → vraie commande, acompte = total, revérification du total (refus s'il a changé). Compte : `PAIEMENT_BENEFICIAIRE` / `PAIEMENT_IBAN` dans l'environnement du serveur, jamais dans le dépôt. Code : `src/domaine/brouillons.ts` |
| Annuler une commande (décision du propriétaire, 11/11/2026) | Réservé au **gérant** : code gérant **ressaisi à chaque annulation** (un accès gérant déjà ouvert sur la tablette ne suffit pas), vérifié à l'écran **et** au serveur (`ERR_DROIT_INSUFFISANT` sans code, `ERR_CODE_INCORRECT` si faux), **motif obligatoire**. Rien n'est effacé : la commande passe au statut « annulée », tracée dans l'historique avec le nom du gérant. Acompte déjà reçu et bon déjà imprimé : simples avertissements (sort de l'acompte **à trancher**, voir `docs/QUESTIONS-GERANT.md`) |

Les autres points (tenue, hygiène, pauses, respect…) ne sont pas des règles de saisie : ils
sont **rappelés aux vendeurs** de façon légère (voir « Rappels équipe »), jamais en bloquant.

**Rappels équipe.** Pendant un chargement qui existe déjà, après une commande validée ou un
inventaire terminé, l'application peut afficher un rappel court et sympathique tiré du
règlement. Contraintes : **aucun temps d'attente ajouté** (pas de chargement créé pour
afficher un rappel, textes embarqués dans l'app, fermeture d'un geste), ton bienveillant,
jamais de reproche ni d'allusion à des manquements, jamais visible du client.

## Architecture imposée

- Toutes les règles vivent dans `src/domaine/` : **fonctions pures**, zéro dépendance UI,
  zéro accès base. Une règle = une fonction nommée + un test qui la prouve.
- Les prix se lisent **uniquement** via l'API du module catalogue :
  `getPrix(produitId, date)` · `getProduit(produitId)` · `listerParCategorie(date)`
- Offline-first : écriture locale d'abord, synchronisation ensuite. Les validations du
  domaine sont **rejouées côté serveur** à la synchro.

Trois invariants vérifiables mécaniquement (à mettre en pré-commit) :

1. Aucun littéral de prix hors du module catalogue
2. Aucun `mardi`, `getDay()`, `day === 2` hors de `src/domaine/`
3. Aucune arithmétique sur un montant en dehors des helpers « centimes »

## Règle d'ergonomie — toute réponse à un geste apparaît là où l'on regarde

Un toucher qui ne produit rien **de visible** est un bug bloquant : l'employé, debout et pressé,
le répète, s'énerve, ou contourne l'application. Fenêtre de code gérant, refus, confirmation,
avertissement : s'affichent **par-dessus la page, au premier plan** (ou à côté du bouton touché),
jamais dans un bloc posé en haut de page alors que le bouton est en bas. À vérifier sur écran
étroit (téléphone) **et** large (tablette) pour tout nouveau message ou fenêtre.

## Règle de doute

Si une règle est ambiguë, incomplète ou contradictoire : **ne pas deviner**. Implémenter le
comportement le plus sûr (celui qui refuse plutôt que celui qui accepte à tort), le marquer
`// HYPOTHÈSE À VALIDER : …` et l'ajouter à `docs/QUESTIONS-GERANT.md`.

Une mauvaise quantité en inventaire ou un mauvais prix sur une commande coûte de l'argent
réel au commerce. Dans le doute : bloquer et demander.

## Périmètres — qui a le droit d'écrire quoi

**Métier**

| Domaine | Agent propriétaire | Les autres |
|---|---|---|
| Catalogue, prix, versions de tarif | `catalogue-prix` | lecture via API |
| Règles, validations, calculs, seuils | `regles-metier` | appel de fonctions |
| Écrans de comptage | `inventaire-scan` | — |
| Écrans de commande | `commandes-traiteur` | — |

**Transverse**

| Domaine | Agent propriétaire | Les autres |
|---|---|---|
| Contrat d'erreur, messages, journalisation | `gestion-erreurs` | utilisent le type `Resultat` |
| Authentification, rôles, routes protégées, RGPD | `securite` | — |
| Jetons de design, composants, états visuels | `design-ux` | consommation |
| Gabarits imprimés | `impression` | — |

**Technique**

| Domaine | Agent propriétaire | Les autres |
|---|---|---|
| Schéma Prisma, migrations, contraintes, index | `base-donnees` | — |
| Stockage local, file de synchronisation | `data-offline` | — |
| Vitesse perçue, requêtes, poids | `performance` | — |
| Structure du code, invariants, duplication | `architecture` | — |
| Mise en service, sauvegardes, retour arrière | `deploiement` | — |

**Contrôle** — lecture seule, ne corrigent rien

| Domaine | Agent propriétaire |
|---|---|
| Vérification métier à la main | `qa-metier` |
| Suite de tests, non-régression | `tests` |
| Documents pour le gérant et les employés | `documentation-gerant` |

Deux frontières à ne jamais franchir, parce qu'elles produisent toujours des conflits :
`base-donnees` tient le **serveur**, `data-offline` tient le **navigateur** ·
`regles-metier` décide **quand** ça échoue, `gestion-erreurs` décide **comment**.

Si votre tâche vous amène à modifier quelque chose appartenant à un autre agent :
**ne le faites pas**. Signalez-le en fin de rapport, section « Dépendances », en nommant
l'agent concerné et le besoin précis.
