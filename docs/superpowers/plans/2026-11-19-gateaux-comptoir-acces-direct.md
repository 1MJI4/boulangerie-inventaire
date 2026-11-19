# Gâteaux du comptoir en accès direct (Lot 2) — plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une tuile par gâteau du comptoir (Fraisier, Matadi chocolat, croûtes…) en tête de la famille « Gâteau », avec le prix du magasin jusqu'à 8P et le prix par personne au-dessus.

**Architecture:** Les tuiles sont des **raccourcis** (donnée explicite) vers ce qui existe déjà : le Bavarois sur commande avec son goût pré-rempli, dont le prix suit la table `CORRESPONDANCES_COMPTOIR`. On retire de cette table l'entrée 10 parts et on y ajoute la Forêt noire. Les croûtes, qui n'ont pas de prix par personne, sont une tuile qui regroupe leurs deux produits du comptoir (6P, 8P). Aucun nouveau produit, aucun tarif à importer, aucune migration.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, tests `node --test` (Node 24, fichiers `.ts` lus nativement). Lire `node_modules/next/dist/docs/` avant de toucher à un composant (AGENTS.md).

**Spec:** `docs/superpowers/specs/2026-11-19-refonte-prise-de-commande-design.md` (section « Lot 2 »).

## Global Constraints

- LOI 1 : aucun prix en dur, y compris dans les tests — tout prix se lit au catalogue chargé par `chargerCatalogueDepuisDossier()` + `creerApiCatalogue`. Montants en centimes entiers.
- LOI 5 : libellés des tuiles = libellés du catalogue à la lettre (« Bavarois fruits de la passion », « Croûte », « framboises »).
- LOI 6 : régime et correspondances = données explicites, jamais déduits du nom.
- LOI 9 : tout texte visible est en français et dit quoi faire.
- Une ligne = un gâteau (décision du 28/10/2026) : une tuile ne produit jamais une ligne « 2 × ».
- Périmètres (CLAUDE.md) : `src/catalogue/` → agent `catalogue-prix` ; `src/domaine/` → `regles-metier` ; écran de commande → `commandes-traiteur` ; tests → `tests`.
- Invariants : `npm run invariants` doit rester « OK ». Suite complète : `npm test`.
- Ne pas toucher aux fichiers déjà modifiés et non enregistrés sans rapport (`src/domaine/caisse*.ts`, `src/app/glory/`, `src/lib/vendeurs.ts`, `src/lib/profils.ts`) ; `git add` fichier par fichier.
- Rien n'est poussé ni déployé par ce plan.

## Review Focus

1. **Commande ancienne contenant un « Bavarois 10P » issu d'un Bavarois sur commande** (enregistrée avant le changement) : elle se rouvre en modification sans erreur et garde son prix. → test Task 1.
2. **Deux tuiles du même gâteau sur commande à la suite** (Matadi puis Fraisier, sans avoir choisi la taille du premier) : la seconde crée son propre gâteau, elle ne rouvre pas le Matadi. → test Task 2.
3. **Matadi chocolat en 4P** : la tuile ne contourne pas R65 — `ERR_TAILLE_INTERDITE` avec ses deux sorties. → test Task 2.
4. **Changer le goût d'un gâteau venu d'une tuile** (Fraisier 6P → goût Mangue) : la ligne suit le goût (« Bavarois mangue 6P »), comme aujourd'hui. → test Task 2.
5. **Une croûte dont le produit n'a pas de prix à la date** (tarif futur qui la retire) : la taille n'est pas proposée, la tuile disparaît si aucune taille ne reste ; jamais de bouton sans prix. → test Task 2.

---

### Task 1 : prix du comptoir jusqu'à 8P, Forêt noire (agent `catalogue-prix`, tests avec `tests`)

**Files:**
- Modify: `src/catalogue/correspondancesComptoir.ts`
- Modify: `src/catalogue/goutsSurCommande.ts` (entrée `gateaux-sur-commande/bavarois`)
- Modify: `src/catalogue/libellesSelonGout.ts`
- Modify (tests existants à ajuster) : `src/domaine/prixComptoir.test.ts`, `src/components/commande/prixComptoir.test.ts`, `src/components/commande/bavaroisGout.test.ts`, et tout test qui cite `gateaux-et-tartes/bavarois/10p` comme correspondance (`grep -rn "bavarois/10p" src`)
- Test: `src/catalogue/comptoirJusqua8.test.ts` (nouveau)

**Interfaces:**
- Produces: `CORRESPONDANCES_COMPTOIR` sans aucune entrée `parts: 10` ; trois entrées `gout: "Forêt noire"` ; `goutsEnTete` du Bavarois terminé par `'Forêt noire'` ; `LIBELLES_SELON_GOUT` = Bavarois sur commande aux goûts `Fraisier`, `Matadi chocolat`, `Mousse chocolat`, `Forêt noire` → libellé identique au goût.

- [ ] **Step 1 : écrire le test qui échoue** — `src/catalogue/comptoirJusqua8.test.ts`, vrai catalogue, date `'2026-11-20'` :

```ts
const BAV = 'gateaux-sur-commande/bavarois';
test('R60 : au-dessus de 8 parts, plus de prix du comptoir', () => {
  for (const g of [null, 'Fraisier', 'Matadi chocolat', 'Forêt noire'])
    assert.equal(produitComptoirPourTaille(BAV, 10, CORRESPONDANCES_COMPTOIR, g), null);
  assert.ok(CORRESPONDANCES_COMPTOIR.every((c) => c.parts <= 8));
});
test('Forêt noire : 4, 6, 8 parts = le gâteau du comptoir', () => {
  for (const n of [4, 6, 8])
    assert.equal(produitComptoirPourTaille(BAV, n, CORRESPONDANCES_COMPTOIR, 'Forêt noire'), `gateaux-et-tartes/foret-noire/${n}p`);
});
test('la table reste valide sur le vrai catalogue', () => {
  // controlerCorrespondancesComptoir(table, lire, REGLEMENT_COMMANDE.taillesStandard) → []
});
test('10 parts au goût Fraisier : prix par personne du Bavarois, libellé « Fraisier »', () => {
  // controlerLigne sur { produitId: BAV, quantite: 10, gouts: ['Fraisier'] } → ok ;
  // total === 10 * getPrix(BAV, DATE).prixCentimes ; libelleSelonGout(...) === 'Fraisier'
});
test('commande ancienne : « Bavarois 10P » avec origineSurCommande reste acceptée à son prix', () => {
  // validerComptoirSelonGout('gateaux-et-tartes/bavarois/10p', BAV, ['Fraisier'], table, 'Bavarois').ok === true
});
```

Reprendre le montage (`ctx`, `saisie`, `ficheCatalogue`) de `src/components/commande/unGateauParLigne.test.ts`. Le nom exact de la liste des tailles standard se lit dans `src/domaine/constantes.ts`.

- [ ] **Step 2 : vérifier l'échec** — `node --no-warnings --test src/catalogue/comptoirJusqua8.test.ts` → FAIL (10 parts renvoie encore `gateaux-et-tartes/bavarois/10p`).

- [ ] **Step 3 : modifier les trois tables**
  - `correspondancesComptoir.ts` : supprimer la ligne `parts: 10` ; ajouter Forêt noire 4/6/8 → `gateaux-et-tartes/foret-noire/{4p,6p,8p}` ; mettre à jour le commentaire d'en-tête (« jusqu'à 8P, décision du propriétaire du 19/11/2026 »).
  - `goutsSurCommande.ts` : `goutsEnTete: ['Mangue', 'Fruits de la passion', 'Framboise', 'Fraisier', 'Matadi chocolat', 'Mousse chocolat', 'Forêt noire']`.
  - `libellesSelonGout.ts` : retirer l'entrée `gateaux-et-tartes/bavarois/10p` et son hypothèse ; ajouter `Matadi chocolat`, `Mousse chocolat`, `Forêt noire` sur `gateaux-sur-commande/bavarois`.

- [ ] **Step 4 : ajuster les tests existants** qui attendaient le Bavarois 10P du comptoir : ils doivent désormais attendre le prix par personne (10 × prix du catalogue). Ne supprimer aucun cas, le réécrire.

- [ ] **Step 5 : tout passe** — `npm test` puis `npm run invariants` → 0 échec, « Invariants : OK ».

- [ ] **Step 6 : enregistrer** — `git add` des fichiers ci-dessus ; `git commit -m "feat(catalogue): prix du comptoir jusqu'à 8P, Forêt noire au prix du Bavarois (R60)"`.

---

### Task 2 : raccourcis de gâteaux — donnée et modèle d'écran (agents `catalogue-prix` pour la donnée, `commandes-traiteur` pour le modèle)

**Files:**
- Create: `src/catalogue/raccourcisGateaux.ts`
- Modify: `src/components/commande/modele.ts` (nouvelle section « Raccourcis de gâteaux », après la section R60)
- Test: `src/components/commande/raccourcisGateaux.test.ts`

**Interfaces:**
- Consumes (Task 1) : `CORRESPONDANCES_COMPTOIR`, `produitComptoirPourTaille`, `goutDeLaLigne`, et de `modele.ts` : `ligneVide`, `gateauSansTaille`, `gateauDeLaLigne`, `toucherProduit`, `choisirTaille`, `suivreGout`.
- Produces :

```ts
// src/catalogue/raccourcisGateaux.ts
export type RaccourciGateau =
  | { cle: string; libelle: string; type: 'surCommande'; surCommande: string; gout: string }
  | { cle: string; libelle: string; type: 'comptoir'; tailles: readonly { parts: number; comptoir: string }[] };
export const RACCOURCIS_GATEAUX: readonly RaccourciGateau[];

// src/components/commande/modele.ts
export type TuileRaccourci = {
  raccourci: RaccourciGateau;
  /** type 'surCommande' : fiche du gâteau sur commande ; type 'comptoir' : null. */
  fiche: FicheCatalogue | null;
  /** type 'comptoir' : une entrée par taille qui a un prix à la date ; sinon []. */
  tailles: { parts: number; fiche: FicheCatalogue }[];
  /** Nombre de gâteaux de cette tuile déjà au bon. */
  auBon: number;
};
export function tuilesRaccourcis(catalogue: CatalogueCommande, lignes: readonly LigneEcran[], recherche: string, rayon: string | null): TuileRaccourci[];
export function toucherRaccourci(lignes: readonly LigneEcran[], tuile: TuileRaccourci): { lignes: LigneEcran[]; cle: string; champ: ChampTouche } | null;
```

Contenu de `RACCOURCIS_GATEAUX`, dans cet ordre (`surCommande` = `gateaux-sur-commande/bavarois` pour les sept premiers ; `cle` = libellé en minuscules-tirets) :

| libelle | type | goût / tailles |
|---|---|---|
| Fraisier | surCommande | `Fraisier` |
| Matadi chocolat | surCommande | `Matadi chocolat` |
| Mousse chocolat | surCommande | `Mousse chocolat` |
| Forêt noire | surCommande | `Forêt noire` |
| Bavarois framboise | surCommande | `Framboise` |
| Bavarois fruits de la passion | surCommande | `Fruits de la passion` |
| Bavarois mangue | surCommande | `Mangue` |
| Croûte Fraises | comptoir | 6 → `gateaux-et-tartes/croute/fraises-6p`, 8 → `…/fraises-8p` |
| Croûte framboises | comptoir | 6 → `…/framboises-6p`, 8 → `…/framboises-8p` |
| Croûte Fruits | comptoir | 6 → `…/fruits-6p`, 8 → `…/fruits-8p` |

Règles de `tuilesRaccourcis` : renvoie `[]` sauf si `rayon` est la catégorie du gâteau sur commande des raccourcis (lue sur la fiche, jamais écrite en dur) **ou** si la recherche n'est pas vide et que tous ses mots (via `normaliserRecherche`) sont dans le libellé de la tuile. Une tuile `surCommande` dont la fiche est absente du catalogue reçu est omise ; une tuile `comptoir` ne garde que les tailles dont la fiche existe, et est omise s'il n'en reste aucune. `auBon` : lignes dont `gateauDeLaLigne(l) === surCommande` et dont le goût unique vaut `gout` (comparaison sans casse) ; pour `comptoir`, lignes dont `produitId` est l'une des tailles.

Règles de `toucherRaccourci` : type `comptoir` → `null` (la taille se touche sur la tuile, voir Task 3). Type `surCommande` → si la **dernière** ligne de ce gâteau avec **ce goût** est sans taille (`gateauSansTaille`), la rouvrir (`champ: 'taille'`) ; sinon ajouter `{ ...ligneVide(surCommande), gouts: [gout] }` et renvoyer `champ: 'taille'`.

- [ ] **Step 1 : écrire les tests qui échouent** (`raccourcisGateaux.test.ts`, vrai catalogue) :

```ts
test('donnée : chaque raccourci pointe vers des produits du catalogue, libellés à la lettre', …);
// surCommande existe et est régime C / personne ; chaque `comptoir` existe, régime A, famille gateau ;
// le goût de chaque raccourci surCommande figure dans goutsEnTete du Bavarois.
test('tuilesRaccourcis : visibles dans la famille Gâteau, absentes ailleurs et sans filtre', …);
test('tuilesRaccourcis : la recherche « frais » montre Fraisier et Croûte Fraises', …);
test('toucher « Fraisier » : un Bavarois sur commande, goût Fraisier, boutons de taille ouverts', …);
// lignes.length === 1 ; gouts deepEqual ['Fraisier'] ; champ === 'taille' ; quantite === null
test('Fraisier puis taille 6 : la ligne devient « Fraisier 6P » du comptoir, quantité 1', …);
// choisirTaille(...).produitId === 'gateaux-et-tartes/fraisier/6p'
test('Fraisier puis taille 10 : reste au prix par personne, 10 parts', …);
test('Matadi sans taille puis Fraisier : DEUX gâteaux (Review Focus 2)', …);
test('Fraisier deux fois sans taille : un seul gâteau, rouvert', …);
test('Matadi chocolat 4 parts : ERR_TAILLE_INTERDITE et ses deux sorties (Review Focus 3)', …);
test('Fraisier 6P puis goût Mangue : « Bavarois mangue 6P » (Review Focus 4)', …); // suivreGout
test('croûte sans prix à la date : taille non proposée ; aucune taille → tuile absente (Review Focus 5)', …);
// catalogue de test = vrai catalogue privé de la fiche croute/fraises-8p, puis des deux
test('auBon : compte les gâteaux de la tuile, pas ceux d’un autre goût', …);
```

- [ ] **Step 2 : vérifier l'échec** — `node --no-warnings --test src/components/commande/raccourcisGateaux.test.ts` → FAIL (module introuvable).
- [ ] **Step 3 : créer `raccourcisGateaux.ts`** avec la table ci-dessus et un en-tête dans le style des autres fichiers de `src/catalogue/` (décision du propriétaire du 19/11/2026, donnée explicite, aucun prix).
- [ ] **Step 4 : écrire `tuilesRaccourcis` et `toucherRaccourci`** dans `modele.ts`.
- [ ] **Step 5 : tout passe** — `npm test` et `npm run invariants`.
- [ ] **Step 6 : enregistrer** — `git commit -m "feat(commande): raccourcis des gâteaux du comptoir (donnée + modèle)"`.

---

### Task 3 : les tuiles à l'écran (agent `commandes-traiteur`, apparence avec `design-ux`)

**Files:**
- Modify: `src/components/FormulaireCommande.tsx` — composant `GrilleProduits` (vers la ligne 3139) et la fonction `toucher` (vers la ligne 666)

**Interfaces:**
- Consumes (Task 2) : `tuilesRaccourcis`, `toucherRaccourci`, `TuileRaccourci`.
- Produces : nouvelle prop de `GrilleProduits` : `onRaccourci: (t: TuileRaccourci) => void`.

- [ ] **Step 1 : brancher le toucher.** Dans `SaisieCommande`, `toucherTuile(t)` : appelle `toucherRaccourci(lignes, t)` ; si non nul → `setLignes`, `setActif(\`${cle}.taille\`)`, éclair et annonce comme `toucher` (texte : « Fraisier : choisissez la taille »). Une photo en attente (`photoEnAttente`) est posée sur la ligne créée, comme pour un produit.
- [ ] **Step 2 : afficher.** Dans `GrilleProduits`, les tuiles de `tuilesRaccourcis(catalogue, lignes, recherche, rayon)` sont rendues **avant** les fiches, dans la même grille et avec les mêmes classes de carte :
  - type `surCommande` : libellé, puis en petit le prix par personne de la fiche (« dès … /pers. » si `prixEstPlancher`) ; pastille = `auBon` si > 0 ; toucher → `onRaccourci`.
  - type `comptoir` : libellé, puis un bouton par taille « 6P · prix » lu sur la fiche (`formaterEuros`), hauteur tactile ≥ 44 px ; toucher une taille → `onToucher(fiche)` (chemin existant du gâteau du comptoir).
  - Les fiches que les tuiles remplacent restent dans la grille (rien n'est masqué) : le Bavarois sur commande sert toujours pour un autre goût.
- [ ] **Step 3 : vérifier dans le navigateur** (`preview_start`, page `/commandes/nouvelle`, largeur tablette puis téléphone) : famille « Gâteau » → les dix tuiles en tête ; Fraisier → 6 → ligne « Fraisier 6P » au prix du tarif ; Fraisier → 10 → 10 parts au prix par personne ; Croûte Fraises → 8P → ligne « Croûte Fraises 8P » ; Matadi → 4 → refus avec ses deux boutons. Aucune erreur dans la console. Capture d'écran pour le propriétaire.
- [ ] **Step 4 : `npm test`, `npm run invariants`, `npm run lint`** → tout passe.
- [ ] **Step 5 : enregistrer** — `git commit -m "feat(commande): tuiles des gâteaux du comptoir en tête de la famille Gâteau"`.

---

### Task 4 : règles écrites et contrôle (agents `documentation-gerant`, puis `qa-metier` en lecture seule)

**Files:**
- Modify: `CLAUDE.md` (LOI 6, exception R60 : « Bavarois 4/6/8, Crème fraîche 6/8 », Forêt noire, décision du 19/11/2026 ; ne pas toucher à la ligne « Qui prend la commande » déjà modifiée et non enregistrée — `git add -p`)
- Modify: `docs/REGLES-METIER.md` (R60 ; nouvelle règle « tuiles des gâteaux du comptoir »)
- Modify: `docs/QUESTIONS-GERANT.md` (ajouter : prix de la Croûte en 10P ; clore l'hypothèse « Fraisier en 10 parts »)

- [ ] **Step 1 :** mettre à jour les trois documents, en français non technique.
- [ ] **Step 2 :** contrôle `qa-metier` : pour chaque tuile et chaque taille 4/6/8/10/15, le prix affiché = le prix du catalogue (comptoir jusqu'à 8P, 4/6/8 seulement là où le produit existe ; parts × prix par personne au-dessus). Tout écart est bloquant (LOI 1).
- [ ] **Step 3 :** `git commit -m "docs: R60 jusqu'à 8P, tuiles des gâteaux du comptoir"`.

## Hors de ce plan

Quantité « Combien ? » (Lot 3), trois étapes et récapitulatif (Lot 4), bon atelier (Lot 1), tuiles pour les tartes (une seule taille, déjà dans le rayon), Crème fraîche (déjà une tuile sur commande), prix de la Croûte en 10P (en attente du propriétaire), mise en service.
