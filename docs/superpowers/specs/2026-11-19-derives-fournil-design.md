# Commandes de viennoiserie → feuille du fournil (produits dérivés et plateaux)

Demande du propriétaire, 19/11/2026. Statut : **approuvée le 19/11/2026, construite** (non commitée, non déployée).

## Pourquoi

Un client commande des croissants à la pâte d'amande ou des couques au chocolat double.
Ces produits ne se sortent pas du four tels quels : ils se font à partir d'un Croissant ou
d'une Couque au chocolat. Aujourd'hui le manager doit lire les commandes et taper lui-même
le « + » sur l'écran des prévisions ; un oubli = une commande sans marchandise.

## Ce qui est décidé (paroles du propriétaire)

1. **Produits dérivés** — ils n'ont pas de ligne au fournil, ils augmentent leur base :

   | Commandé (tarif) | Base au fournil |
   |---|---|
   | Croissant à la pâte d'amande (croissant cuit, ouvert et garni après) | Croissant |
   | Couque au chocolat double (couque + couche de chocolat dessus) | Couque au chocolat |

   « Croissant au chocolat » (chocolat dedans) et « Croissant aux amandes » (cuit avec la
   pâte d'amande) sont des produits à part : ils gardent leur ligne, rien ne change.
2. **Couque au chocolat double** : à ajouter au tarif, **1,90 €**.
3. **Un plateau = 16 pièces, peu importe la sorte.** On additionne les pièces commandées
   des deux sortes. Chaque tranche de 16 = un plateau en plus. Pour le reste :
   **1 à 4 pièces → pas de plateau en plus**, on prend sur la vente normale ;
   **5 pièces ou plus → un plateau en plus**.
4. **Annulation / modification** : rare, pas de traitement spécial. Une commande annulée
   ne compte plus, c'est tout.

## Ce que je propose (mes choix, à corriger)

- **1 dérivé commandé = 1 pièce de base.**
- **Les commandes de « Croissant » et de « Pain chocolat » simples comptent aussi**, avec
  les dérivés (Pain chocolat du tarif = Couque au chocolat du fournil).
- **Journée de production = jour du retrait**, comme le bandeau des commandes aujourd'hui.
- **Le plateau ajouté part plein** : les places libres sont complétées par la sorte la
  plus commandée ce jour-là (égalité : Croissant) ; ce surplus va à la vente.
  *(Non confirmé par le propriétaire — marqué HYPOTHÈSE À VALIDER, question ajoutée à
  `docs/QUESTIONS-GERANT.md`.)*
- **Nom au tarif** : « Couque au chocolat double » (à confirmer à la lettre).
- **Le « + » tapé à la main reste**, pour une commande prise hors de l'application. La part
  calculée s'affiche à côté, en lecture seule, pour éviter de compter deux fois.
- Le seuil (4) et le lien dérivé → base sont des **données nommées à un seul endroit**.

## Ce que verront les employés

Écran des prévisions (manager), sous la ligne Croissant :

```
Croissant            [ 3 ] plateaux        1 plateau = 16 pièces
                     + 7 commandés (dont 7 Croissant à la pâte d'amande)
Couque au chocolat   [ 2 ] plateaux
                     + 2 commandés (dont 2 Couque au chocolat double)
─ Commandes : 9 pièces → 1 plateau en plus (14 croissants + 2 couques au chocolat)
```

Feuille du pâtissier :

```
Croissant            3 plateaux = 48 pièces
                     + 7 pièces commandées · dont 7 à garnir pâte d'amande
Couque au chocolat   2 plateaux = 32 pièces
                     + 2 pièces commandées · dont 2 en chocolat double
Plateau des commandes : 1 plateau en plus — 14 croissants + 2 couques au chocolat
```

Avec 3 pièces commandées seulement : « 3 pièces commandées — à prendre sur les plateaux
prévus », aucun plateau en plus.

## Façons de le construire

| Approche | Pour | Contre |
|---|---|---|
| **A. Calcul à la lecture (retenue)** : le serveur lit les commandes non annulées du jour et calcule la part commandée et les plateaux à chaque affichage | toujours à jour (commande modifiée ou annulée : rien à rattraper) ; aucune migration ; rien à synchroniser | l'historique « prévu / produit » ne contient pas cette part |
| B. Écriture dans l'inventaire à chaque commande créée, modifiée, annulée | l'historique la contient | trois chemins d'écriture à garder justes, conflits avec la saisie hors ligne du manager |
| C. Le manager continue à la main, l'application lui souffle le chiffre | très peu de code | c'est le problème d'aujourd'hui : l'oubli reste possible |

Retenue par le propriétaire (19/11/2026) : **B — la part commandée est écrite dans
l'historique** (« Prévu 48 + 16 commandés, Produit 64 »).

Pour limiter le risque de B : **un seul recalcul complet, jamais d'addition au fil de
l'eau**. Une fonction serveur `recalculerPartCommandee(journee)` relit toutes les
commandes non annulées de la journée, applique le domaine et **remplace** les valeurs
enregistrées. Elle est appelée après chaque création, modification, annulation de commande
(pour l'ancienne et la nouvelle date de retrait) et à l'ouverture des prévisions et de la
feuille du fournil (rattrapage). Rejouer deux fois donne le même résultat.

Deux colonnes nouvelles sur `Inventaire` (migration, agent `base-donnees`), en pièces :
`commandeAuto` (pièces commandées dans l'application pour cette base) et
`plateauCommandes` (pièces à sortir en plus pour ces commandes : 0 si prises sur la vente
normale). `quantitePrevue` et `quantiteCommande` (le « + » à la main) ne changent pas.
Journée passée : les valeurs ne sont plus réécrites.

## Comment (pour celui qui construit)

- **Donnée** `src/catalogue/basesFournil.ts` (modèle : `correspondancesComptoir.ts`) :
  `{ commande: <cleCatalogue>, fournil: <Produit.nom, identifiant unique de la liste d'inventaire> }`.
  Quatre entrées : Croissant, Croissant à la pâte d'amande → « Croissant » ;
  Pain chocolat, Couque au chocolat double → « Couque au chocolat ». Jamais déduit du nom
  (LOI 6, LOI 10 : les deux listes restent séparées, seule cette table les relie).
  Un contrôle (test + serveur) vérifie que chaque clé existe, à la pièce.
- **Domaine** `src/domaine/commandesFournil.ts`, fonctions pures + tests :
  - `partCommandeeParBase(lignes, table)` : ignore les commandes annulées, additionne par
    base, garde le détail par dérivé ;
  - `plateauxEnPlus(piecesParBase, contenance, tolerance)` : tranches de 16 + règle des
    4 / 5, répartition du plateau (commandes d'abord, complément par la sorte majoritaire),
    pièces « prises sur la vente normale ».
  - Constante `TOLERANCE_SANS_PLATEAU = 4` dans le domaine.
- **Serveur** : `GET /api/inventaires?date=…` renvoie `commandeAuto` et `plateauCommandes` ;
  `GET /api/inventaires/commandes?date=…` recalcule et renvoie le détail par dérivé. Une ligne de base apparaît sur la feuille du fournil même si
  le manager n'a rien tapé. L'historique des prévisions affiche « Prévu 48 + 16 commandés ».
- **Écrans** : `saisie-prevue` et `planification-demain` affichent comme ci-dessus.
  `quantitePrevue` et `quantiteCommande` en base ne changent pas de sens (LOI 2 : pièces).
- **Tarif** : nouvelle ligne Viennoiserie « Couque au chocolat double », 1,90 €, par un
  fichier de tarif daté (LOI 1 : jamais d'écrasement) ; import lancé par le propriétaire.
  **PAS FAIT** : la date d'effet d'un tarif doit être le jour de l'import, et le nom exact
  reste à confirmer. L'entrée de la table est prête, marquée `aVenir`.
- **Tests obligatoires** : dérivé qui augmente la base ; deux dérivés de bases
  différentes ; commande annulée qui ne compte plus ; plateau partagé entre sortes ;
  4 pièces → 0 plateau, 5 → 1, 20 → 1, 21 → 2 ; « Croissant aux amandes » ne compte pas.
- **Docs** : R69 complétée, nouvelle règle R72, questions ouvertes dans
  `docs/QUESTIONS-GERANT.md`.

## Hors périmètre

- « Production par défaut » par produit avec exceptions du manager (sujet voisin, plus tard).
- Autres produits en plateaux.
