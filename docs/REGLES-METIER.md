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
| R28 | Qui peut modifier un tarif : gérant uniquement (code gérant, voir R35) | 🔴 | `ERR_DROIT_INSUFFISANT` | **oui — 15/10/2026** |
| R29 | Qui peut descendre sous un plancher de prix : gérant, avec traçabilité nominative | 🔴 | `ERR_DROIT_INSUFFISANT` | **non** |
| R30 | Qui peut clore un inventaire : responsable de dépôt | 🔴 | `ERR_DROIT_INSUFFISANT` | **non** |
| R31 | Toute commande modifiée conserve ses versions antérieures (litige client) | 🔴 | — | oui |

## G. Conformité

| # | Règle | Niveau | Code | Confirmé |
|---|---|---|---|---|
| R32 | Allergènes (règlement UE 1169/2011) : les 14 allergènes déclarables par produit, affichés à la commande et imprimés sur le bon | 🔵 puis obligatoire | `INFO_ALLERGENES` | **non — à cadrer** |
| R33 | Mentions légales sur le bon de commande : raison sociale, TVA, acompte, conditions d'annulation | — | — | **non** |

## H. Accès et saisie — décisions du propriétaire du 15/10/2026

| # | Règle | Niveau | Code | Confirmé |
|---|---|---|---|---|
| R34 | Chaque tablette reçoit un code **une seule fois**, à l'installation, et reste connectée plusieurs mois. L'employé choisit son nom dans une liste, sans code personnel | — | — | **oui — 15/10/2026** |
| R35 | Le code gérant est demandé **uniquement** pour changer un prix ou un produit | 🔴 | `ERR_DROIT_INSUFFISANT` | **oui — 15/10/2026** |
| R36 | L'inventaire a **ses propres produits**. Le catalogue de commande n'apparaît jamais dans l'inventaire, et l'inverse. Un produit inconnu de la liste d'inventaire est refusé au comptage | 🔴 | `ERR_PRODUIT_INCONNU` | **oui — 15/10/2026** |
| R37 | Tous les chiffres de la prise de commande (quantité, parts, poids, prix par personne, acompte) se tapent sur le **pavé de l'application**, comme pour l'inventaire | — | — | **oui — 15/10/2026** |
| R38 | Tous les minimums (R10 à R13) sont **bloquants**, vérifiés dès la saisie de la ligne, jamais à la fin. Chaque refus propose la sortie en un geste (« Passer à 20 parts », « Ajouter un 2e pain ») | 🔴 | `ERR_QUANTITE_MIN` | **oui — 15/10/2026** |

## I. Contrôles de cohérence de la commande

| # | Règle | Niveau | Code | Confirmé |
|---|---|---|---|---|
| R39 | Un acompte plus élevé que le total est refusé | 🔴 | `ERR_ACOMPTE_SUPERIEUR_TOTAL` | **oui — 15/10/2026** |
| R40 | Une ligne sans produit choisi est refusée | 🔴 | `ERR_LIGNE_SANS_PRODUIT` | **oui — 15/10/2026** |
| R41 | Une commande sans aucune ligne est refusée | 🔴 | `ERR_COMMANDE_VIDE` | **principe oui (15/10/2026), niveau à confirmer** |
| R42 | Un chiffre impossible (négatif, illisible) est refusé, avec la valeur à corriger proposée | 🔴 | `ERR_SAISIE_INVALIDE` | **principe oui (15/10/2026), niveau à confirmer** |
| R43 | Un champ obligatoire laissé vide est refusé | 🔴 | `ERR_CHAMP_OBLIGATOIRE` | **principe oui (15/10/2026), niveau à confirmer** |
| R44 | Un total qui ne correspond pas à la somme des lignes est refusé | 🔴 | `ERR_TOTAL_INCOHERENT` | **principe oui (15/10/2026), niveau à confirmer** |
| R45 | Un prix de ligne différent du tarif en vigueur est refusé (LOI N°1) | 🔴 | `ERR_TARIF_INCOHERENT` | oui (LOI N°1) |
| R46 | Le même produit ajouté deux fois dans une commande : accepté, signalé | 🟠 | `AVERT_PRODUIT_EN_DOUBLE` | **principe oui (15/10/2026), niveau à confirmer** |
| R47 | Une ligne ou une commande à 0 € est refusée | 🔴 | `ERR_MONTANT_NUL` | **non** — question 13 |
| R48 | Une date de retrait déjà passée est refusée | 🔴 | — | **non** — question 41 |
| R49 | Une commande « à imprimer » ne passe pas directement à « remise » | 🔴 | `ERR_STATUT_INCOHERENT` | **non** — question 45 |
| R50 | Téléphone ni belge ni international : accepté, signalé | 🟠 | `AVERT_TELEPHONE_IMPROBABLE` | **non** — question 47 |
| R51 | Ligne libre (« autre demande ») : prix fixé avec l'accord du gérant | 🔴 | `ERR_DROIT_INSUFFISANT` | **non** — question 42 |

## J. Règlement intérieur — commandes et inventaire

Ces règles viennent du règlement de la direction. Elles ne sont **pas encore toutes en place**
dans l'application : la colonne « Code » reste vide tant que le message n'existe pas.

| # | Règle | Niveau | Code | Confirmé |
|---|---|---|---|---|
| R52 | Acompte d'**au moins 50 %** du total pour valider une commande. Sous 50 % : refusé, avec le bouton « Mettre l'acompte à X € ». Exemple : commande de 90 € → acompte minimum 45 € | 🔴 | à créer | **oui — règlement intérieur 15/10/2026** |
| R53 | Commande à retirer **le lendemain** : refusée sauf accord du responsable, donné avec le code gérant et enregistré | 🔴 | à créer | **oui — règlement intérieur 15/10/2026** |
| R54 | Commande en pâtisserie : retrait possible **à partir de 9h en semaine, 12h le week-end**. Une heure plus tôt est refusée, avec la première heure possible proposée. Ces heures sont réglables, pas figées | 🔴 | à créer | **oui — règlement intérieur 15/10/2026** |
| R55 | Commande inhabituelle (ingrédient particulier, moule spécial…) : acceptée mais signalée, avec la sortie « Appeler le responsable » ou « Passer par WhatsApp » | 🟠 | à créer | **oui — règlement intérieur 15/10/2026** |
| R56 | Nom et téléphone du client **obligatoires**. La date et l'heure de prise de commande s'enregistrent toutes seules | 🔴 | `ERR_CHAMP_OBLIGATOIRE` | **oui — règlement intérieur 15/10/2026** |
| R57 | Inventaire commencé **avant 20h00** (heure de fermeture, réglable) : accepté mais signalé | 🟠 | à créer | **oui — règlement intérieur 15/10/2026** |
| R58 | À la remise de la commande : liste des articles à cocher **devant le client**, pour que rien ne soit oublié | — | — | **oui — règlement intérieur 15/10/2026** |

Les autres points du règlement (tenue, hygiène, pauses, respect, avantages du personnel) ne
bloquent jamais une saisie. Ils apparaissent sous forme de **petits rappels sympathiques**,
pendant un chargement, après une commande validée ou après un inventaire terminé. Jamais
visibles du client.

---

## Décisions du gérant — 15/10/2026

- **Minimum de parts non atteint → refus.** Pas de supplément, pas de dérogation.
  L'application oblige à atteindre le minimum, en proposant la correction en un geste.
- **Capacité de production journalière** : hors périmètre pour l'instant.
- **Heure limite de commande dans la journée** : hors périmètre pour l'instant.
- **Arrondi espèces** : reporté, probablement inutile (l'application n'encaisse pas).
- **Prix de revient / valorisation du stock** : hors périmètre. Le tarif est dans
  l'application pour **fiabiliser la prise de commande**, pas pour valoriser le stock.
- **Accès** : un code par tablette, le nom choisi dans la liste, le code gérant pour les
  prix et les produits (R34, R35).
- **Inventaire et catalogue de commande séparés** (R36).
- **Pavé de l'application** pour tous les chiffres de la commande (R37).
- **Contrôles de cohérence** de la commande (R39 à R46).
- **Règlement intérieur** : acompte d'au moins 50 %, lendemain avec accord du responsable,
  horaires de retrait pâtisserie, commande inhabituelle, nom et téléphone, inventaire à 20h00,
  décompte à la remise (R52 à R58).

## Comportements par défaut appliqués en l'absence de réponse

Chacun est marqué `// HYPOTHÈSE À VALIDER` dans le code et visible à l'écran :

1. **Délais** → mariage 5 j ouvrés · gâteau simple 48 h ouvrées · salé 24 h ouvrées
2. **Minimum 10/15 pièces** → par ligne de produit, pas par panier
3. ~~**Acompte** → aucun acompte exigé automatiquement~~ → **tranché** : au moins 50 % (R52)
