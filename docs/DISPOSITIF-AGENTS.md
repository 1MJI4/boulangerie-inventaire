# Pain Pâtisserie — dispositif d'agents Claude Code

## Installation

Copiez ce dossier à la racine de votre projet applicatif (ou ouvrez-le tel quel avec
`claude` pour commencer par l'audit). Vous obtenez :

```
votre-projet/
├── CLAUDE.md                        ← contexte chargé automatiquement partout
├── .claude/
│   ├── agents/                      ← les 7 sous-agents spécialisés
│   │   ├── catalogue-prix.md
│   │   ├── regles-metier.md
│   │   ├── inventaire-scan.md
│   │   ├── commandes-traiteur.md
│   │   ├── data-offline.md
│   │   ├── design-ux.md
│   │   ├── impression.md
│   │   └── qa-metier.md
│   └── commands/
│       └── audit-metier.md          ← la commande /audit-metier
├── docs/
│   ├── REGLES-METIER.md             ← référentiel R1–R33, à faire valider par le gérant
│   ├── TARIFS-SUR-COMMANDE.md       ← les deux affiches transcrites
│   ├── QUESTIONS-GERANT.md          ← 20 questions, réponses d'une phrase
│   └── AMELIORATIONS.md             ← ce qui manque et pourquoi ça coûtera cher
└── data/
    └── catalogue_prix_2026-09.csv   ← 351 produits, prix en centimes
```

**`CLAUDE.md` est le cœur du dispositif.** Claude Code le charge automatiquement dans chaque
session et chaque sous-agent : vous n'avez rien à recopier. Une règle métier se modifie là,
et nulle part ailleurs.

## Démarrer

```bash
cd votre-projet
claude
```

Puis, dans l'ordre :

```
/audit-metier
```

L'audit cartographie votre application existante, exécute les cas pièges (mardi, minimums,
prix par personne, produits au kilo), et produit `docs/AUDIT-METIER.md` avec un plan de
correction en trois vagues. **Il ne modifie rien.**

Ensuite, corrigez vague par vague :

```
Corrige la vague 1 de docs/AUDIT-METIER.md. Lance regles-metier pour les règles
mal placées et design-ux pour les trois niveaux de signalement, en parallèle.
Puis fais valider par qa-metier.
```

## Appeler un agent

Nommez-le, Claude Code s'en charge :

- « Lance **catalogue-prix** pour importer le tarif de janvier et me donner le diff »
- « Demande à **regles-metier** d'ajouter les motifs d'écart d'inventaire (R24) »
- « **inventaire-scan** : le comptage est trop lent sur les boissons, mesure et corrige »
- « **qa-metier** : vérifie que rien n'a cassé depuis le changement de tarif »

## Les règles d'or du dispositif

1. **Aucun prix en dur.** Tout vient de `data/` via l'API du catalogue.
2. **Aucune règle métier hors de `src/domaine/`.** Un `getDay() === 2` dans un composant est
   un bug, même s'il marche.
3. **Trois niveaux de signalement** : bloquant / avertissement / information. Un avertissement
   traité comme une erreur fait refuser des ventes que le gérant accepte.
4. **Jamais d'hypothèse silencieuse.** Si une règle n'est pas confirmée, elle est marquée dans
   le code, visible à l'écran, et listée dans `docs/QUESTIONS-GERANT.md`.
5. **`qa-metier` passe en dernier**, après chaque changement de prix ou de règle.

## Pré-commit recommandé

Trois vérifications mécaniques qui valent cent relectures :

```bash
# 1. aucun littéral de prix hors du module catalogue
grep -rnE '[0-9]+[.,][0-9]{2}\s*€|prix\s*[:=]\s*[0-9]' src/ --exclude-dir=catalogue

# 2. aucune logique de jour hors du domaine
grep -rnE 'getDay\(\)|mardi|tuesday' src/ --exclude-dir=domaine -i

# 3. aucun flottant sur de l'argent
grep -rnE 'parseFloat|toFixed\(2\)' src/
```

Chaque résultat non vide est un défaut à corriger ou à justifier.
