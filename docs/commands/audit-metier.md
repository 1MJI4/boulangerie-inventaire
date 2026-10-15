---
description: Audit complet de la logique métier de l'application existante - détecte les règles manquantes, mal placées ou mal graduées, et produit un plan de correction priorisé.
---

# Audit de la logique métier — application Pain Pâtisserie

Tu audites une application d'inventaire et de commande **déjà existante**, décrite par son
auteur comme « pas intuitive ». Ton rôle n'est pas de la réécrire : c'est de trouver, prouver
et hiérarchiser **ce qui lui manque pour être fiable en magasin**.

Les règles de référence sont dans `CLAUDE.md`, `docs/REGLES-METIER.md` et
`docs/TARIFS-SUR-COMMANDE.md`. Tu les connais ; le code, non. Cherche les écarts.

$ARGUMENTS

## Phase 1 — Cartographie (ne corrige rien encore)

Avant toute analyse, établis où vit réellement la logique métier aujourd'hui :

1. Liste chaque endroit du code où une **décision métier** est prise : une date est validée,
   une quantité est comparée à un seuil, un prix est calculé, un total est additionné, un
   message d'erreur est produit.
2. Pour chacun, note : fichier, ligne, et s'il s'agit d'un composant d'interface, d'un
   service, d'une requête base ou d'un module de domaine.
3. **Conclusion attendue** : un tableau « règle → nombre d'endroits où elle est implémentée ».
   Toute règle implémentée à plus d'un endroit est une bombe à retardement : le jour où le
   gérant change le jour de fermeture, un des deux endroits sera oublié.

## Phase 2 — Les trois questions qui comptent

Pour **chaque** règle métier trouvée, réponds aux trois :

**(a) Est-elle au bon endroit ?**
Toute règle doit vivre dans `src/domaine/`, en fonction pure. Un `if (date.getDay() === 2)`
dans un composant React, une contrainte métier écrite uniquement en SQL, un seuil codé dans
un `onChange` : ce sont des défauts, même si le comportement visible est correct aujourd'hui.

**(b) Est-elle appliquée aux trois niveaux ?**
UI (empêche la saisie) · domaine (rejette) · persistance/serveur (refuse à la synchro).
L'application étant offline-first, une protection côté interface seule ne protège rien :
une donnée saisie hors ligne peut arriver par un autre chemin. Vérifie-le réellement, en
simulant une écriture directe.

**(c) Est-elle au bon niveau de signalement ?**
C'est le point le plus souvent raté. Trois niveaux (LOI N°8) :

| Niveau | Comportement | Exemples attendus |
|---|---|---|
| 🔴 bloquant | saisie refusée, **avec proposition corrective** | retrait un mardi · 9 mini-burgers · 12 parts de Layer Cake · prix sous le plancher |
| 🟠 avertissement | accepté, signalé, tracé | double scan · date limite de consommation proche · 21 sandwichs sur un pain surprise |
| 🔵 information | affiché sans friction | produit bientôt hors saison · tarif en vigueur |

**Tous les minimums sont bloquants** (décision du gérant, 15/10/2026) : pas de supplément,
pas de dérogation. Si tu trouves un calcul de supplément pour minimum non atteint dans le
code, c'est du code mort à supprimer.

**Mais vérifie l'autre moitié de la règle** : chaque blocage propose-t-il la sortie en un
geste (« passer à 20 parts », « ajouter un 2e pain ») ? Un refus sans issue est un défaut
majeur — au téléphone avec un client qui attend, il fait rouvrir le carnet papier.

## Phase 3 — Les pièges à chercher explicitement

Ne te contente pas de lire : **exécute** chaque cas et note le comportement réel.

**Calendrier**
- retrait un mardi → refusé à la saisie, pas à la validation finale ?
- mardi férié · 29 février · changement d'heure · saisie offline un mardi synchronisée le
  mercredi → rejetée à l'arrivée ?
- commande pour mercredi matin dont la production tombe le mardi → le délai raisonne-t-il en
  **jours ouvrés** ou bêtement en heures ?
- que se passe-t-il à minuit, en fin de mois, en changement d'année ?

**Prix et régimes**
- un prix est-il écrit en dur quelque part ? (recherche exhaustive des littéraux numériques)
- le régime de prix est-il déduit du **nom** du produit quelque part ? (défaut grave)
- un Bavarois comptoir 8P reste-t-il à 36,00 € même si un Bavarois régime C existe à
  4,50 €/pers ?
- un prix/personne saisi sous le plancher est-il refusé ?
- une commande prise avant une hausse de tarif conserve-t-elle son prix ?
- montants en centimes entiers partout, ou des flottants traînent-ils ?
- arrondi espèces à 5 centimes : appliqué au total en liquide uniquement, jamais aux prix
  unitaires ?

**Quantités**
- 9 mini-burgers · 14 mini-éclairs · 12 parts de Layer Cake · 30 parts de gâteau de mariage
  → tous refusés ? Les seuils sont-ils bien distincts (10 / 15 / 20 / 40 / 60), ou le code
  partage-t-il une seule constante « minimum » ?
- chaque refus propose-t-il la correction en un geste, ou laisse-t-il l'employé bloqué ?
- Number Cake « 25 » → 30 parts minimum, pas 15 ?
- 21 sandwichs sur un pain surprise → proposition d'un 2e pain, ou erreur sèche ?
- suppléments photo/écriture : une fois par gâteau, ou multipliés par le nombre de parts ?

**Données**
- un produit favori peut-il être compté deux fois dans un inventaire ?
- les 4 produits au kilo acceptent-ils une saisie décimale, et refusent-ils le bouton « +1 » ?
- 0,750 kg × 25 €/kg donne-t-il exactement 18,75 € ?
- un inventaire validé est-il modifiable après coup ?

**Messages**
- reste-t-il un message technique visible par un employé ?
- chaque message dit-il **quoi faire**, ou seulement ce qui ne va pas ?

## Phase 4 — Les règles absentes

Liste ce qui **manque** et qui fera mal en exploitation, même si le gérant ne l'a pas demandé.
Pour chacune : la règle en une phrase, son niveau, ce qu'elle évite concrètement, et son coût
d'implémentation estimé. Pistes à examiner systématiquement :

- **motifs d'écart d'inventaire** (casse / invendu jeté / offert / personnel) — sans eux, un
  écart n'est qu'un chiffre inutile. Priorité n°1.
- **proposition corrective sur chaque blocage** (« passer à 20 parts », « ajouter un 2e pain »)
- dates limites de consommation sur le rayon Frigo-S
- périodes de pointe (fin d'année, Ramadan/Aïd, communions, fête des mères) : délais allongés
- droits : qui change un prix, qui déverrouille un plancher, qui clôt un inventaire
- inventaire immuable après clôture (correction par écriture corrective)
- allergènes (règlement UE 1169/2011)

**Hors périmètre, ne pas proposer** : capacité de production journalière · heure limite de
commande · arrondi espèces · valorisation du stock au prix de revient. Écartés par le gérant
le 15/10/2026 (cf. `docs/AMELIORATIONS.md`).

## Phase 5 — Livrables

**1. `docs/AUDIT-METIER.md`** — le rapport. Pour chaque défaut :

```
[BLOQUANT|MAJEUR|MINEUR] Titre court
Où          : fichier:ligne
Constat     : ce que fait le code aujourd'hui
Attendu     : la règle de référence, avec son numéro (R12, LOI N°7…)
Reproduction: 3 étapes maximum
Coût réel   : ce que ça coûte au commerce, en euros ou en ventes perdues
Correction  : en une phrase, et quel agent doit la faire
```

Trié par gravité, puis par coût réel. Pas de félicitations, pas de résumé de ce qui marche.

**2. `docs/REGLES-METIER.md` mis à jour** — ajoute les règles découvertes dans le code mais
absentes du référentiel, et marque celles qui sont au mauvais niveau.

**3. `docs/QUESTIONS-GERANT.md` mis à jour** — toute règle que le code applique sans qu'elle
soit confirmée est une question. Formule-la en français simple, sans jargon : le gérant doit
pouvoir y répondre en une phrase, par message.

**4. Un plan de correction en trois vagues** :
- vague 1 — ce qui fait perdre de l'argent ou refuser des ventes aujourd'hui
- vague 2 — ce qui fera mal au premier coup de feu (fin d'année, grosse commande)
- vague 3 — le reste

Chaque élément nommé avec l'agent qui doit le traiter : `catalogue-prix`, `regles-metier`,
`inventaire-scan`, `commandes-traiteur`, `data-offline`, `design-ux`, `impression`.

## Méthode de travail

Lance en parallèle `regles-metier` (phases 1–2, où vivent les règles et à quel niveau) et
`qa-metier` (phase 3, exécution des cas de test). Puis consolide toi-même les phases 4–5.
Ne corrige rien pendant l'audit : un auditeur qui répare en route ne sait plus ce qu'il a vu.

**Règle absolue** : tu ne déduis jamais une règle métier du code existant. Si le code fait
quelque chose qui n'est ni dans `CLAUDE.md` ni dans `docs/REGLES-METIER.md`, ce n'est pas une
règle — c'est soit un bug, soit une règle non documentée à faire confirmer par le gérant.
Dans les deux cas, elle va dans le rapport, pas dans le référentiel.
