# Audit architecture — 15/10/2026

> Agent `architecture`, lecture seule. Prix de `src/lib/tarifs.mjs` comparés par script au CSV
> et à `docs/TARIFS-SUR-COMMANDE.md`. Contenu réel des tables `FamilleGateau` et `Tarif` non
> vérifié (pas d'accès base). Points clés revérifiés par le coordinateur.

**Synthèse.** 4 copies des prix en dur. LOI 3 (mardi) implémentée nulle part. Les minimums ne
bloquent jamais et leurs seuils divergent de CLAUDE.md. Le régime de prix est déduit du libellé.
Les quantités en kg sont impossibles à saisir. ~15 copies du formatage d'un montant.

## 1. Invariant 1 — prix littéraux hors catalogue

| Fichier:ligne | Constat |
|---|---|
| `src/lib/tarifs.mjs:30-347` | Copie du CSV en dur (300 lignes). Prix identiques, mais catégories renommées (Individuelle→« Morceaux et unités » :165, Oriental→« Spécialité orientale » :237, Frigo-S→« Frigo salé » :302, Frigo-Boisson + Café→« Boisson » :316, « Fin d'année » :222). Unité kg codée dans le libellé (« Corne de gazelle (au kg) » :245-248, contraire à la LOI 5). 2 suppléments du CSV absents. |
| `src/lib/tarifs.mjs:18` | Commentaire « photo (15 €) et écriture (2 €) » : règle dupliquée. |
| `src/lib/gateauxParDefaut.mjs:17-47` | Tarifs régimes B et C en dur, **tous inférieurs à l'affiche** (voir §4). |
| `src/lib/gateauxParDefaut.mjs:17-19, 23` | `formatsFixes` recopie les prix comptoir (3e copie). |
| `src/lib/gateauxParDefaut.mjs:40-41` | Notes 65 € / 85 € ; l'affiche dit 75 € / 90 €. |
| `src/lib/gateauxParDefaut.mjs:72-76` | Suppléments décoration à 500, source inconnue. |
| `scripts/maj-formats-gateaux.mjs:22-27` | 4e copie des prix comptoir gâteaux. |
| `src/lib/commandes.ts:147-148` | `SUPPLEMENT_PHOTO_CENTIMES = 1500`, `SUPPLEMENT_ECRITURE_CENTIMES = 200` en dur. |
| `src/app/commandes/reglages/page.tsx:191` | `minimumParts: 10` en dur dans un composant. |

Nombres anodins (pas des défauts) : `FormulaireCommande.tsx:1111`, `commandes.ts:250`,
`reglages/page.tsx:258`, commentaires `gateaux.ts:125`, `FormulaireCommande.tsx:730`.
Commentaire **faux** : `commandes.ts:131` (« bavarois 8P à 31 € » ; 31 € est le 6P).

**Données** : `Tarif` (`schema.prisma:77-92`) sans `valide_du`/`valide_au`, `unite`,
`regime_prix`, `est_favori`, `taux_tva`. Prix écrasés sur place par `seed-tarifs.mjs
--forcer-les-prix`, `api/tarifs/route.ts:123-124` (PATCH), `maj-formats-gateaux.mjs:60-63`.
`api/tarifs/route.ts:71-103` (POST) : un vendeur crée un tarif à prix libre, sans code.

## 2. Invariant 2 — jour de fermeture

- Aucun `getDay`/`mardi`/`day === 2` : **la LOI 3 est absente aux trois niveaux**.
  UI `FormulaireCommande.tsx:262` (`<input type="date">` libre) ; aucun `validerDateRetrait` ;
  serveur `api/commandes/route.ts:124`, `:273-278` ne vérifie que le format.
- `dateProduction.ts:323-326` : `journeeProduction` peut renvoyer un mardi ; `decalerJours` (:308) en jours calendaires.
- `commandes.ts:256` : délai gâteau en jours calendaires ; `:238` (date passée) n'est qu'un avertissement.
- `api/commandes/route.ts:409` duplique `JOURS_AVANT_ARCHIVAGE` (`commandes.ts:84`).
- Anodins : « mardi » en commentaires `dateProduction.ts:90-91, 103, 112` ; `weekday:` de
  formatage dans `ticketCanvas.ts:421`, `TicketCommande.tsx:175`, `imprimer/page.tsx:423` (formateur copié 3 fois).

## 3. Invariant 3 — flottants sur montants

- Saisie : `commandes.ts:106` `Math.round(Number(nettoye) * 100)` → à remplacer par un parseur entier.
- `/100` + `toFixed(2)` dupliqué ~15 fois : `commandes.ts:98`, `gateaux.ts:228-230`,
  `FormulaireCommande.tsx:92, 148, 455, 598, 803`, `TicketCommande.tsx:85`, `ticketCanvas.ts:304`,
  `imprimer/page.tsx:339`, `reglages/page.tsx:454, 618`, `api/commandes/route.ts:338, 347`,
  `maj-formats-gateaux.mjs:29`.
- Division avec perte : `gateaux.ts:167` `Math.round(fixe / parts)` (3100/6 → 517 ; ×6 = 3102).
- Reste dû calculé 5 fois de façon incohérente : `ticketCanvas.ts:185`, `FormulaireCommande.tsx:531`
  (`max(0)`), `TicketCommande.tsx:36`, `imprimer/page.tsx:280` (max à l'affichage), `commandes.ts:363`
  (sans max → montant négatif possible dans le message WhatsApp).
- **Le serveur fait confiance au client** : `api/commandes/route.ts:102, 148, 330-331` ;
  « total convenu » libre `FormulaireCommande.tsx:440-480`, prix de ligne libre `:600-605`.
- Prisma : aucun `Float`/`Decimal` (conforme). Le CSV a `prix_ttc_eur` décimal : importer `prix_cents` uniquement.
- Faux positifs : pourcentages `dashboard/page.tsx:102, 405`, `historique-previsions/page.tsx:96, 282`, `ui.tsx:163` ; `seed-tarifs.mjs:82`.

## 4. Règles dupliquées ou divergentes

### Minimums (LOI 7) — 3 sources, aucune ne bloque

| Produit | CLAUDE.md / affiche | `gateauxParDefaut.mjs` | `commandes.ts` |
|---|---|---|---|
| Layer cake | 20 | 20 (:26) | 20 (:140) |
| Number cake | 15 **par symbole** | **10** (:25) | 15 fixe (:139) |
| Mariage | 40 | **aucun** (:27) | absent |
| Pièce montée | 60 | **40** (:28) | **40** (:141) |
| Mini-pâtisseries | 15 | **10** (:32-34) | 10, toutes minis confondues (`/^mini\b/` :145, :279) |
| Minis salés | 10 | 10 (:42-47) | 10 |
| Pain surprise max 20 | avertissement | absent | absent |

Valeurs cachées : `FormulaireCommande.tsx:792` (6 parts / 10 pièces), `reglages/page.tsx:191` (10).
Tout est avertissement par conception (`commandes.ts:10`, `gateaux.ts:148-150`,
`FormulaireCommande.tsx:539`) : l'inverse de la LOI 7. Aucune proposition corrective.

Code mort depuis le 15/10 : supplément « moins de 6 personnes » (`gateaux.ts:114-115, 157-158`,
`commandes.ts:196-197, 297-303`) ; `PARTS_MINIMUM = 4` (`gateaux.ts:118`, dupliqué
`commandes.ts:289`) ; `FORMATS_TARIFES` (`commandes.ts:135`) inutilisé.

### Planchers et régimes (LOI 6)

Aucun `ERR_SOUS_PLANCHER`. Planchers de `gateauxParDefaut.mjs` vs affiche (centimes) :

| Produit | Code | Affiche |
|---|---|---|
| Bavarois | 400 | 450 |
| Crème fraîche | 350 | 420 |
| Cake | 250 | 290 |
| Layer | 450 | 500 |
| Number | 450 | 500 |
| Mariage | 450 | 560 |
| Pièce montée | 450 | 560 |
| Mini tartelette | 150 | 190 |
| Mini éclair / mille-feuille | 80 | 150 |
| Mini pizza / quiche | 150 | 280 |
| Mini bestella | 200 | 290 |
| Mini briwate / cigare | 150 | 210 |
| Bestella 10P | 6500 / 8500 | 7500 / 9000 |

Absents du code : Entremet, mini bavarois, mini wrap, mini burger, mini batbout, pain surprise,
mini-sandwichs. Présents sans source : massepain, ferrero, crème au beurre, tarte, mini-pâtisserie.

- **Régime déduit du nom** : `commandes.ts:201-206`, `:209-212`, `:138-142`, `:279`.
- **Régimes A et C mélangés** : `gateaux.ts:163-173` applique le prix comptoir à un gâteau sur commande.
- Paliers dégressifs (`gateaux.ts:47-52`) et coupes (`gateaux.ts:66-104`) : règles non documentées.

### Unité kg (LOI 2)

`LigneCommande.quantite Int` (`schema.prisma:147`), `Inventaire.quantiteRestante Int` (:36).
`FormulaireCommande.tsx:613, 1044, 1091, 1110` (`Math.max(1, …)`), `api/commandes/route.ts:101`
(`Math.round`), `api/inventaires/route.ts:45` (`Math.trunc`) : 0,5 kg devient 1 kg.
Les 4 produits kg absents de `src/lib/catalogue.mjs`.

### Favoris (LOI 4)

Aucune notion de favori. `tarifs.mjs` a écarté les 49 doublons à la main (tous ont un jumeau
exact). Pas de double comptage aujourd'hui, mais aucune garantie au prochain import.

### Trois référentiels produits sans lien

`catalogue.mjs` (inventaire), `tarifs.mjs` (commandes), `gateauxParDefaut.mjs` (sur mesure) —
`schema.prisma:73-76` : « aucun rapprochement ». Libellé déjà divergent : « Bestella » dans
`catalogue.mjs:81, 83` / « Bastella » dans `tarifs.mjs:267-268`.

## 5. Découpage cible de `src/domaine/`

| Fichier | Fonctions | Loi | Propriétaire |
|---|---|---|---|
| `resultat.ts` | type `Resultat`, `bloquant` / `avertir` / `informer` | 8, 9 | `gestion-erreurs` |
| `argent.ts` | `lireMontant`, `formaterEuros`, `multiplier`, `prixAuPoids` (half-up), `somme`, `resteDu` | 1, 2 | `regles-metier` |
| `calendrier.ts` | `estJourFerme`, `validerDateRetrait`, `ajouterJoursOuvres`, `veilleOuvree`, `validerDelai` | 3 | `regles-metier` |
| `unites.ts` | `validerQuantite`, `totalLigne` | 2 | `regles-metier` |
| `minimums.ts` | `validerQuantiteMin` (+ `valeurProposee`), `validerPainSurprise` | 7 | `regles-metier` |
| `regimes.ts` | `prixLigne` A/B/C, `validerPrixParPersonne`, `supplementsGateau` | 6 | `regles-metier` |
| `inventaire.ts` | `dedoublonnerFavoris`, `totalInventaire`, `verifierComptage` | 4, 2 | `regles-metier` |
| `commande.ts` | `controlerCommande` orchestrateur, rejoué côté serveur | 3, 6, 7, 8 | `regles-metier` |
| `src/catalogue/` | `getPrix`, `getProduit`, `listerParCategorie`, import CSV versionné | 1, 4, 5, 6 | `catalogue-prix` |

Ordre de migration : 1. `argent.ts` · 2. `calendrier.ts` + branchement 3 niveaux ·
3. `minimums.ts` bloquants · 4. `src/catalogue/` + `regimes.ts` (schéma requis) ·
5. `unites.ts` (kg) · 6. `inventaire.ts` + rapprochement de `catalogue.mjs`.

## 6. Pré-commit (décrit)

Script Node sans dépendance `scripts/verifier-invariants.mjs`, via `core.hooksPath .githooks`,
relancé dans `scripts/build.js`. Fichiers indexés de `src/`, `scripts/`, `prisma/*.mjs` ;
exclut `data/`, `docs/`, `node_modules`. Échappatoire : `// invariant-ok: <raison>`.

- **Inv. 1** (hors `src/catalogue/**`) : `\d+[.,]\d{2}\s*€`, `\b\d+\s*€`,
  `(prix|Centimes|centimes|montant|supplement|tarif)\w*\s*[:=]\s*[1-9]\d*`, `formatsFixes\s*:\s*\{`.
- **Inv. 2** (hors `src/domaine/**`) : `getDay\(`, `getUTCDay\(`, `\bmardi\b` hors commentaire,
  `tuesday`, `day\s*===?\s*[0-6]`, `JOURS_FERMETURE` ; `weekday:` autorisé.
- **Inv. 3** (hors `src/domaine/argent.ts`) : `parseFloat`, `toFixed\(`, `[/*]\s*100\b` sur une
  ligne nommant un montant ; `Float|Decimal` sur un prix dans `schema.prisma`.
- Bonus : interdire `react`/`next`/`@prisma` dans `src/domaine/**`, et tout nouveau `.mjs` dans `src/lib`.

Environ 25 corrections initiales attendues ; démarrer en mode « rapport ».

## 7. Dépendances

- **`regles-metier`** : seuils corrigés et bloquants ; `ERR_JOUR_FERME`, `ERR_SOUS_PLANCHER`,
  `ERR_QUANTITE_MIN` + valeur proposée ; supplément « moins de 6 », paliers, coupes ; délai calendaire `commandes.ts:256`.
- **`catalogue-prix`** : catalogue unique versionné depuis le CSV ; tarifs B/C alignés sur l'affiche ;
  libellés et catégories à la lettre ; suppléments depuis le CSV ; encadrer POST `/api/tarifs`.
- **`base-donnees`** : `regime_prix`, `unite`, `valide_du`/`valide_au`, `est_favori`, `taux_tva` ;
  quantité kg (proposition : grammes en `Int`) ; table des jours fermés ; refus serveur du mardi ; fin de l'écrasement des prix.
- **`gestion-erreurs`** : type `Resultat`, messages uniformisés (aujourd'hui `{ error: string }`, codes `minimum_layer_cake`).
- **`commandes-traiteur`** : date sans mardi, pavé décimal kg, bouton « Passer à N parts », verrou sous plancher.
- **`impression`** : consommer `formaterEuros` et `resteDu` du domaine.
- **`data-offline`** : rejouer les validations à la synchronisation.
- **`securite`** : création de tarif au comptoir sans code (`api/tarifs/route.ts:71`).

## Questions pour le gérant

1. Les tarifs « à partir de » de l'affiche remplacent-ils ceux de l'application (plus bas) ?
2. Un Bavarois 6 parts **sur commande** : prix comptoir (31 €) ou régime C (6 × 4,50 = 27 €) ?
3. Massepain (6 € puis 5 € dès 20 parts), Ferrero (5,50), Crème au beurre (4,50), décorations +5 € : toujours valables ?
4. Le supplément « moins de 6 personnes » existe-t-il encore ? Si oui, combien ?
5. Un gâteau de 13 parts : refuser, prévenir ou laisser passer ?
6. Bastella ou Bestella ? (déjà posée)
7. Qui peut corriger un prix ; un vendeur peut-il créer un produit avec son prix au comptoir ?
8. « Mini morceau pâtisserie » : quel produit de l'affiche, et minimum 10 ou 15 ?
