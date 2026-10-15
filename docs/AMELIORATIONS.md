# Ce qui manque — règles métier à ajouter, par ordre de valeur

*Mis à jour le 15/10/2026 après arbitrage du gérant.*

## Écarté ou reporté — ne pas développer

| Proposition | Décision |
|---|---|
| Capacité de production journalière (quotas par jour) | **écarté** — pas d'intérêt pour l'instant |
| Heure limite de commande dans la journée (cut-off) | **écarté** — pas d'intérêt pour l'instant |
| Arrondi espèces à 5 centimes | **reporté** — l'application n'encaisse pas, donc inutile aujourd'hui. À activer si une caisse est ajoutée un jour ; la règle tient en une fonction |
| Prix de revient et valorisation du stock | **hors périmètre** — le tarif est dans l'application pour **fiabiliser la prise de commande** et éviter les erreurs de prix, pas pour faire de la comptabilité |
| Supplément quand le minimum de parts n'est pas atteint | **supprimé** — le minimum est désormais obligatoire (LOI N°7) |

---

## Vague 1 — à faire en premier

### 1. Motifs d'écart à l'inventaire

**Le problème.** Un écart sans motif n'est qu'un chiffre. Vous savez qu'il manque
14 croissants, vous ne savez pas pourquoi — donc vous ne pouvez rien corriger.

**La règle.** Avant de clôturer un inventaire, chaque écart reçoit un motif obligatoire :
vendu · casse · invendu jeté · offert / geste commercial · consommation personnel · erreur de
saisie.

**Ce que ça change.** On passe de « on perd 200 € par mois, mystère » à « on jette 60 € de
viennoiserie le lundi, donc on produit moins le dimanche soir ». La production s'ajuste à
partir de ces chiffres.

**Pourquoi en premier.** Le bénéfice est cumulatif : chaque mois sans motifs est un mois de
données perdues. C'est aussi ce qui rend possible, plus tard, tout suivi de tendance.
Effort : faible. C'est le meilleur rapport valeur/effort de la liste.

---

### 2. Proposition corrective sur chaque blocage

**Le problème.** Maintenant que tous les minimums sont bloquants, le risque se déplace : une
application qui refuse sans proposer de solution fait perdre la vente. Au téléphone, avec un
client qui attend, l'employé rouvre le carnet papier.

**La règle.** Tout refus porte sa sortie, en un bouton :
« Minimum 20 parts — **Passer à 20 parts** » · « Minimum 10 pièces — **Passer à 10** » ·
« 21 sandwichs — **Ajouter un 2e pain surprise** ».

**Ce que ça change.** Le blocage cesse d'être un mur et devient un garde-fou. C'est la
différence entre une application qu'on utilise et une qu'on contourne.
Effort : très faible, à faire **en même temps** que les règles de minimum.

---

### 3. Corriger l'affiche « Gâteaux SIMPLES »

Pas du développement, mais ça coûte zéro et évite un conflit quotidien : votre affiche promet
encore « Supplément pour les gâteaux dont le minimum n'est pas respecté », alors que
l'application refusera. Un employé pris entre une affiche et un écran qui se contredisent
finit toujours par contourner l'écran.

Remplacer par : « Minimum de parts à respecter — nous consulter pour toute demande
particulière ».

---

## Vague 2 — quand la base tourne

### 4. Dates limites de consommation sur le rayon frais

**Ce que c'est.** « DLC » = la date au-delà de laquelle un produit frais ne se vend plus.
Vos salades (thon mayo, poulet curry, américain préparé, crevettes à l'ail, surimi) en
portent une, à 3,30–4,50 € pièce.

**Le problème.** Aujourd'hui, personne ne sait combien de barquettes arrivent à échéance cette
semaine. On s'en aperçoit le jour où il faut les jeter.

**La règle.** Au comptage, l'employé saisit en plus la **date la plus courte visible sur
l'étagère** (un seul champ, une seule fois par référence). Deux jours avant, l'application
prévient : « 8 salades crevettes à écouler avant jeudi ».

**Ce que ça change.** Vous avez encore le temps de les mettre en avant, de les intégrer à un
plateau ou de les proposer au personnel — au lieu de les perdre entièrement. Quelques unités
sauvées par semaine suffisent à rentabiliser l'effort.

**La question à trancher** : est-ce que ça vaut le geste supplémentaire au comptage ?
Proposition : uniquement sur le rayon Frigo-S, jamais sur le pain ni la viennoiserie.

---

### 5. Périodes de pointe

Votre catalogue porte déjà une catégorie « Special fin d'année » (bûches, galettes, cœurs) et
une gamme orientale importante. Vos pics ne sont pas que Noël : Ramadan et Aïd, communions,
fête des mères.

**La règle.** Des périodes déclarées à l'avance où les délais de commande s'allongent
automatiquement et où certains produits deviennent disponibles ou indisponibles. Déclaré une
fois dans l'année, appliqué tout seul.

**Ce que ça change.** Plus besoin de surveiller manuellement chaque commande en décembre,
au moment précis où personne n'a le temps de surveiller quoi que ce soit.

---

### 6. Droits et traçabilité

Trois rôles : employé (compte, saisit des commandes) · responsable (clôture un inventaire) ·
gérant (modifie un tarif, déverrouille un prix sous le plancher). Chaque action sensible
tracée nominativement.

**Ce que ça évite.** Qu'un prix soit modifié sans qu'on sache par qui, et qu'un inventaire
soit « corrigé » après coup pour faire disparaître un écart.

---

### 7. Inventaire immuable après clôture

Un inventaire validé ne se modifie plus. Une correction crée une **écriture corrective**
datée et signée, qui laisse voir l'original. Effort faible, et ça rend les chiffres
opposables.

---

## Vague 3 — structurant

### 8. Allergènes

Le règlement européen 1169/2011 impose de pouvoir communiquer les 14 allergènes majeurs sur
les denrées non préemballées — vos sandwichs, gâteaux et plateaux sont concernés. Un champ par
produit, affiché à la prise de commande, imprimé sur le bon traiteur.

**Ce que ça apporte.** La conformité, et la tranquillité le jour où un client pose la question
pour un mariage de 120 personnes.

---

### 9. Seuils de réapprovisionnement

Pour les produits non fabriqués sur place (boissons, emballages), un stock minimum qui
déclenche une alerte à la clôture d'inventaire : « 4 références sous le seuil ».

---

### 10. Historique et tendance

Une fois trois mois d'inventaires accumulés : évolution des écarts par famille, produits qui
partent systématiquement en casse, jours où la production dépasse la vente.

C'est le bénéfice différé de tout le reste — **mais il n'existe que si les motifs d'écart
(règle n°1) ont été saisis depuis le début.**

---

## Ordre conseillé

| Ordre | Règle | Effort | Gain |
|---|---|---|---|
| 1 | Motifs d'écart | faible | très élevé, cumulatif |
| 2 | Proposition corrective sur les blocages | très faible | élevé |
| 3 | Corriger l'affiche | nul | évite un conflit quotidien |
| 4 | Dates limites rayon frais | moyen | élevé |
| 5 | Périodes de pointe | moyen | élevé en saison |
| 6 | Droits et traçabilité | moyen | élevé |
| 7 | Inventaire immuable | faible | moyen |
| 8 | Allergènes | moyen | conformité |
| 9 | Seuils de réappro | faible | moyen |
| 10 | Historique | faible si 1 est fait | élevé, différé |

Les trois premières se font en une journée à elles toutes. Commencez par là.
