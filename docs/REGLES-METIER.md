# Référentiel des règles métier

> Document à faire relire **au gérant**. La colonne « Confirmé » est votre liste de questions :
> toute ligne à « non » est une hypothèse que l'application applique en attendant sa réponse.
> Une règle se modifie ici et dans `CLAUDE.md`, jamais dans un composant.

Niveaux : 🔴 **bloquant** (refus) · 🟠 **avertissement** (accepté, signalé) · 🔵 **information**

---

## A. Calendrier et délais

| # | Règle | Niveau | Code | Confirmé |
|---|---|---|---|---|
| R1 | Fermé le mardi — toute date de retrait un mardi est refusée à la saisie, aux 3 niveaux (UI, domaine, serveur) | 🔴 | `ERR_JOUR_FERME` | **non** |
| R1b | Jours fériés et fermetures exceptionnelles : même traitement, liste en base | 🔴 | `ERR_JOUR_FERME` | **non** |
| R1c | Congés annuels : période bloquée, annoncée à l'écran 3 semaines avant | 🔴 | `ERR_PERIODE_CONGES` | **non** |
| R2 | Délai minimum de commande, en **jours ouvrés** (fermetures exclues) | 🔴 | `ERR_DELAI_TROP_COURT` | **non** |
| R2b | Délai « tendu mais acceptable » → avertissement, pas refus : l'employé appelle le labo | 🟠 | `AVERT_DELAI_COURT` | **non** |
| ~~R2c~~ | ~~Heure limite de commande dans la journée (cut-off)~~ | — | — | **écarté par le gérant — 15/10/2026** |
| R2d | Production la veille : si la veille est un jour fermé, le délai s'allonge automatiquement | 🔴 | `ERR_PRODUCTION_IMPOSSIBLE` | **non** |

**Hypothèses appliquées en attendant** : gâteau de mariage / pièce montée 5 jours ouvrés ·
gâteau simple 48 h ouvrées · plateau salé 24 h ouvrées.

## B. Prix

| # | Règle | Niveau | Code | Confirmé |
|---|---|---|---|---|
| R3 | Montants en centimes entiers, jamais de flottant | 🔴 | — | oui (technique) |
| R4 | Prix figé à la date de prise de commande : une hausse ultérieure ne change pas ce que paie le client | 🔴 | — | **non** |
| R5 | Régime C — `total = nb_parts × prix_par_personne`, pré-rempli au plancher, modifiable vers le haut | — | — | oui (affiche) |
| R5b | Prix/personne saisi **sous** le plancher → refus, sauf déverrouillage gérant tracé | 🔴 | `ERR_SOUS_PLANCHER` | **non** |
| R6 | Produits au kilo : `total = poids × prix_kg`, arrondi half-up au centime | 🔴 | — | oui (catalogue) |
| R7 | Suppléments photo 15 € / écriture 2 € : **une fois par gâteau**, jamais par personne | 🔴 | — | oui (affiche) |
| R8 | Arrondi espèces belge à 5 centimes sur le **total payé en liquide** uniquement, jamais sur les prix unitaires — *optionnel, activable plus tard, utile seulement si l'application encaisse* | — | — | **reporté — 15/10/2026** |
| R9 | TVA 6 % emporter / 12 % sur place — champ par produit, configurable | — | — | **non** |

## C. Quantités

| # | Règle | Niveau | Code | Confirmé |
|---|---|---|---|---|
| R10 | Minimum 10 pièces (régime B) : mini pizza/quiche, mini wrap, mini burger, mini batbout, mini-sandwichs | 🔴 | `ERR_QUANTITE_MIN` | oui (affiche) |
| R11 | Minimum 15 pièces (mini-pâtisseries) : mini tartelette, mini bavarois, mini éclair/mille-feuille | 🔴 | `ERR_QUANTITE_MIN` | oui (affiche) |
| R12 | Minimum de **parts** non atteint (Layer 20, Number 15/symbole, Mariage 40, Pièce montée 60) → **refus**, avec bouton « passer à N parts ». Pas de supplément, pas de dérogation | 🔴 | `ERR_QUANTITE_MIN` | **oui — 15/10/2026** |
| R13 | Number Cake : minimum × nombre de symboles (« 25 » = 2 symboles = 30 parts) | 🔴 | `ERR_QUANTITE_MIN` | **oui** |
| R13b | Tout refus de quantité propose la correction en un geste (passer au minimum, ajouter un 2e pain) | 🔴 | — | oui |
| R14 | Pain surprise : max 20 sandwichs — au-delà, **proposer un 2e pain** plutôt que refuser | 🟠 | `AVERT_PAIN_SUPPLEMENTAIRE` | oui (affiche) |
| R15 | Garnitures mini-sandwichs : la somme par garniture doit égaler le total de la ligne | 🔴 | `ERR_REPARTITION` | oui |

## D. Saisonnalité

| # | Règle | Niveau | Code | Confirmé |
|---|---|---|---|---|
| ~~R16~~ | ~~Quota journalier par famille de production~~ | — | — | **écarté par le gérant — 15/10/2026** |
| ~~R17~~ | ~~Jauge de charge du jour à la prise de commande~~ | — | — | **écarté — 15/10/2026** |
| R18 | Périodes de pointe (fin d'année, Ramadan/Aïd, communions, fête des mères) : délais allongés | 🟠 | `AVERT_PERIODE_POINTE` | **non** |
| R19 | Produits « Special fin d'année » : fenêtre de disponibilité par date, invisibles hors fenêtre | 🔴 | `ERR_HORS_SAISON` | **non** |

## E. Inventaire

| # | Règle | Niveau | Code | Confirmé |
|---|---|---|---|---|
| R20 | Comptage **à l'aveugle** : le stock théorique n'est jamais affiché pendant le comptage | 🔴 | — | oui (méthode) |
| R21 | Un produit scanné deux fois dans la même zone : **addition** + signalement, jamais écrasement | 🟠 | `AVERT_DOUBLE_SCAN` | oui |
| R22 | Deux comptages de la même zone par deux personnes → arbitrage explicite, jamais « le dernier gagne » | 🔴 | `ERR_CONFLIT_COMPTAGE` | oui |
| R23 | Un favori n'est compté qu'une fois (LOI N°4) | 🔴 | — | oui |
| R24 | Écart d'inventaire **catégorisé** : vendu / casse / invendu jeté / offert / consommation personnel / erreur de saisie | 🔴 | `ERR_MOTIF_ECART_MANQUANT` | **non** |
| R25 | Produits frais (Frigo-S) : saisie de la date limite de consommation la plus courte du lot, alerte 2 jours avant | 🟠 | `AVERT_DLC_PROCHE` | **non — à expliquer au gérant** |
| R26 | Inventaire validé = **immuable**. Correction par écriture corrective tracée, jamais par modification | 🔴 | `ERR_INVENTAIRE_CLOS` | **non** |
| R27 | Valorisation du stock au prix de revient — **hors périmètre** : le tarif sert à la prise de commande (éviter les erreurs de prix), pas à la comptabilité | — | — | **écarté — 15/10/2026** |

## F. Droits et traçabilité

| # | Règle | Niveau | Code | Confirmé |
|---|---|---|---|---|
| R28 | Qui peut modifier un tarif : gérant uniquement | 🔴 | `ERR_DROIT_INSUFFISANT` | **non** |
| R29 | Qui peut descendre sous un plancher de prix : gérant, avec traçabilité nominative | 🔴 | `ERR_DROIT_INSUFFISANT` | **non** |
| R30 | Qui peut clore un inventaire : responsable de dépôt | 🔴 | `ERR_DROIT_INSUFFISANT` | **non** |
| R31 | Toute commande modifiée conserve ses versions antérieures (litige client) | 🔴 | — | oui |

## G. Conformité

| # | Règle | Niveau | Code | Confirmé |
|---|---|---|---|---|
| R32 | Allergènes (règlement UE 1169/2011) : les 14 allergènes déclarables par produit, affichés à la commande et imprimés sur le bon | 🔵 puis obligatoire | `INFO_ALLERGENES` | **non — à cadrer** |
| R33 | Mentions légales sur le bon de commande : raison sociale, TVA, acompte, conditions d'annulation | — | — | **non** |

---

## Décisions du gérant — 15/10/2026

- **Minimum de parts non atteint → refus.** Pas de supplément, pas de dérogation.
  L'application oblige à atteindre le minimum, en proposant la correction en un geste.
- **Capacité de production journalière** : hors périmètre pour l'instant.
- **Heure limite de commande dans la journée** : hors périmètre pour l'instant.
- **Arrondi espèces** : reporté, probablement inutile (l'application n'encaisse pas).
- **Prix de revient / valorisation du stock** : hors périmètre. Le tarif est dans
  l'application pour **fiabiliser la prise de commande**, pas pour valoriser le stock.

## Comportements par défaut appliqués en l'absence de réponse

Chacun est marqué `// HYPOTHÈSE À VALIDER` dans le code et visible à l'écran :

1. **Délais** → mariage 5 j ouvrés · gâteau simple 48 h ouvrées · salé 24 h ouvrées
2. **Minimum 10/15 pièces** → par ligne de produit, pas par panier
3. **Acompte** → aucun acompte exigé automatiquement, champ libre disponible
