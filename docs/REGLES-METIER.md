# Référentiel des règles métier

> Document à faire relire **au gérant**. La colonne « Confirmé » est votre liste de questions :
> toute ligne à « non » est une hypothèse que l'application applique en attendant sa réponse.
> Une règle se modifie ici et dans `CLAUDE.md`, jamais dans un composant.

Niveaux : 🔴 **bloquant** (refus) · 🟠 **avertissement** (accepté, signalé) · 🔵 **information**

---

## A. Calendrier et délais

| # | Règle | Niveau | Code | Confirmé |
|---|---|---|---|---|
| R1 | Fermé le mardi — toute date de retrait un mardi est refusée à la saisie, aux 3 niveaux (UI, domaine, serveur), avec le mercredi proposé. **Seul le mardi est fermé** | 🔴 | `ERR_JOUR_FERME` | **oui — propriétaire 18/10/2026** |
| R1b | Les **jours fériés sont ouverts**. Une fermeture exceptionnelle reste possible (liste réglable en base, même refus que le mardi), mais **aucune n'est prévue** : rien n'est ajouté automatiquement (pas de calendrier des fériés) | 🔴 si une fermeture est saisie | `ERR_JOUR_FERME` | **oui — propriétaire 18/10/2026** |
| R1c | **Pas de congés annuels.** Le mécanisme existe (période fermée en base) mais aucune période n'est enregistrée | 🔴 si une période est saisie | `ERR_PERIODE_CONGES` | **oui — propriétaire 18/10/2026** |
| R2 | Délai minimum de commande, en **jours ouvrés** (fermetures exclues) : **aucun** (0) — le retrait **le jour même** est autorisé. Seul un gâteau à étages (mariage, pièce montée) peut avoir un délai, **réglé par le gérant** (0 par défaut) ; en dessous, refus avec la première date possible proposée | 🔴 (gâteau à étages, si un délai est réglé) | `ERR_DELAI_TROP_COURT` | **oui — propriétaire 18/10/2026** |
| R2b | Délai court (jour même, lendemain) : **accepté**, simple message pour prévenir l'atelier (voir R53 et R53b) | 🔵 | `INFO_COMMANDE_JOUR_MEME` · `INFO_COMMANDE_LENDEMAIN` | **oui — propriétaire 15/10 et 18/10/2026** |
| ~~R2c~~ | ~~Heure limite de commande dans la journée (cut-off)~~ | — | — | **écarté par le gérant — 15/10/2026** |
| R2d | Production la veille ouverte du retrait (retrait mercredi → production lundi, mardi fermé), **jamais avant le jour de la prise** : une commande pour le jour même se produit le jour même | — | — | **non** |

**Délais appliqués** (décision du propriétaire, 18/10/2026) : comptoir commandé, plateau salé,
gâteau simple → **aucun délai** (le jour même passe) · gâteau de mariage / pièce montée →
**réglage du gérant**, 0 jour par défaut (écran des réglages).

## B. Prix

| # | Règle | Niveau | Code | Confirmé |
|---|---|---|---|---|
| R3 | Montants en centimes entiers, jamais de flottant | 🔴 | — | oui (technique) |
| R4 | Prix figé à la date de prise de commande : une hausse ultérieure ne change pas ce que paie le client | 🔴 | — | **non** |
| R5 | Régime C — `total = nb_parts × prix_par_personne`, pré-rempli au plancher, modifiable vers le haut | — | — | oui (affiche) |
| R5b | Prix/personne saisi **sous** le plancher → refus, sauf déverrouillage gérant tracé | 🔴 | `ERR_SOUS_PLANCHER` | **non** |
| R6 | Produits au kilo : `total = poids × prix_kg`, arrondi half-up au centime | 🔴 | — | oui (catalogue) |
| R7 | Suppléments photo 15 € / écriture 2 € : **une fois par gâteau**, jamais par personne. Exception : la **Pâte à sucre** se compte par personne (R64) | 🔴 | — | oui (affiche) |
| R8 | Arrondi espèces belge à 5 centimes sur le **total payé en liquide** uniquement, jamais sur les prix unitaires — *optionnel, activable plus tard, utile seulement si l'application encaisse* | — | — | **reporté — 15/10/2026** |
| R9 | TVA 6 % emporter / 12 % sur place — champ par produit, configurable | — | — | **non** |
| R60 | Gâteau simple commandé dans une taille qui **existe au comptoir** : il se vend **au prix du comptoir**. La ligne devient le gâteau du comptoir (1 pièce, prix exact du tarif en vigueur, **jamais modifiable, même par le gérant**). Correspondances : Bavarois sur commande (toutes variantes) 4 / 6 / 8 / 10 parts → Bavarois 4P / 6P / 8P / 10P du comptoir · Crème fraîche 6 / 8 parts → Crème fraîche 6P / 8P. Autres tailles (Crème fraîche 4 parts, Bavarois 15 parts…) : prix par personne (R5). Sur l'écran, le bouton de taille affiche le prix du comptoir (« 6 · 31,00 € ») et le toucher remplace la ligne ; une ligne au prix par personne dans une de ces tailles est refusée avec le bouton « Prendre le gâteau du comptoir ». Le gâteau du comptoir compte comme un gâteau (photo, écriture) | 🔴 | `ERR_PRIX_COMPTOIR` · `ERR_TARIF_INCOHERENT` | **oui — propriétaire 18/10/2026** |
| R61 | Gâteau par personne **à minimum** (Layer Cake, Number Cake, Pièce montée 2 étages, Pièce montée 3 étages) : choisi aux **boutons de taille** à partir de son minimum, **de 5 en 5** (9 tailles + « Autre » au pavé). Raccourcis, pas une limite ; sous le minimum, R12 refuse. Number Cake : sans pavé au toucher, « Combien de formes ? » (boutons 1–4, « Autre » au pavé), puis « Quelles formes ? » (chiffres/lettres : le nombre suit le texte ; « Autre forme » en texte libre fait imprimer la zone de dessin), puis la taille ; le prix n'apparaît qu'ensuite. Formes imprimées en gras, espacées (« 2  5 »). « Gâteau de mariage » renommé **Pièce montée 2 étages** (40 parts), « Pièce montée » → **Pièce montée 3 étages** (60 parts). Dans tous les pavés chiffrés, le nombre affiché est **remplacé** par le premier chiffre tapé | — (aide à la saisie) | — | **oui — propriétaire 22/10/2026** |
| R62 | **Goût obligatoire** d'un gâteau sur commande (Cake nature, Crème fraîche, Bavarois, Layer Cake, Number Cake, pièces montées) : un goût, choisi en gros boutons sous la taille (8 premiers visibles, liste du gérant). **Bavarois** : d'abord les goûts que le magasin fait déjà au comptoir — Mangue, Fruits de la passion, Framboise, Fraisier, Matadi chocolat, Mousse chocolat — puis la liste du manager (propriétaire, 28/10/2026). **Entremet** : une **recette** (Saint-Michel (noix – amandes), Fleur caramel chocolat, Forêt noire, Bavarois fruits de la passion, Bavarois framboise, Mousse chocolat, Javanais, Morceau praline, Crème au beurre moka). **Pièce montée** : un goût **par étage**. Sortie « Au choix du pâtissier ». Décorations (Oreo, Speculoos, Kinder, Raffaello, Ferrero, Nutella…) facultatives, à part. Gâteaux du comptoir et minis non concernés. Imprimé en gras (« GOÛT : FRAMBOISE ») | 🔴 | `ERR_GOUT_MANQUANT` | **oui — propriétaire 22/10/2026** |

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

Ces règles viennent du règlement de la direction et des décisions du propriétaire du
15/10/2026 et du 18/10/2026.

| # | Règle | Niveau | Code | Confirmé |
|---|---|---|---|---|
| R52 | On essaie d'obtenir un acompte d'**au moins 50 %** du total (pourcentage réglable). Sous 50 % (même 0 €) : la commande est **acceptée**, avec un message « Essayez d'obtenir au moins 50 % d'acompte (45,00 €) » et le bouton « Mettre l'acompte à 45,00 € » ; le message est enregistré avec la commande. Exemple : commande de 90 € → 45 € conseillés. Un acompte **plus élevé que le total** reste refusé (R39) | 🟠 | `AVERT_ACOMPTE_INSUFFISANT` | **oui — propriétaire 18/10/2026** |
| R53 | Commande à retirer **le lendemain** (premier jour ouvert suivant : prise un lundi → mercredi) : **acceptée**, sans code gérant. Simple message « prévenez l'atelier » | 🔵 | `INFO_COMMANDE_LENDEMAIN` | **oui — propriétaire 15/10/2026** |
| R53b | Commande à retirer **le jour même** : **acceptée**, sans code gérant. Message « Commande pour aujourd'hui : prévenez l'atelier tout de suite. » Une date passée reste refusée, le mardi aussi | 🔵 | `INFO_COMMANDE_JOUR_MEME` | **oui — propriétaire 18/10/2026** |
| R54 | Heure de retrait **obligatoire** (propriétaire, 22/10/2026 ; `ERR_CHAMP_OBLIGATOIRE`). **Heures d'ouverture du magasin**, pour **tous** les produits : une heure de retrait doit tomber entre l'ouverture et la fermeture du jour (incluses). Défaut : **6h00 → 20h00 tous les jours**, réglable par le gérant **jour par jour** et **pour une date précise** (ex. 24 décembre : 6h00 → 16h00). Hors horaires : refus, « Le magasin est ouvert de 6h00 à 20h00 le samedi — choisissez une heure dans ces horaires », bouton vers l'heure la plus proche (« Passer à 6h00 » si trop tôt, « Passer à 20h00 » si trop tard). L'heure de retrait est **obligatoire** depuis le 22/10/2026 (facultative du 18 au 22/10). L'ancienne règle « pâtisserie à partir de 9h en semaine, 12h le week-end » est **supprimée** | 🔴 | `ERR_HEURE_HORS_OUVERTURE` | **oui — propriétaire 18/10/2026** · retrait possible pile à l'heure de fermeture : **non** (q. 64) · une même date exceptionnelle ne se règle qu'une fois : **oui** (q. 63, 18/10/2026) |
| R55 | Commande inhabituelle (ingrédient particulier, moule spécial…) : acceptée mais signalée, avec la sortie « Appeler le responsable » ou « Passer par WhatsApp » | 🟠 | `AVERT_COMMANDE_INHABITUELLE` | **oui — règlement intérieur 15/10/2026** |
| R56 | Nom et téléphone du client **obligatoires**. La date et l'heure de prise de commande s'enregistrent toutes seules | 🔴 | `ERR_CHAMP_OBLIGATOIRE` | **oui — règlement intérieur 15/10/2026** |
| R57 | Inventaire commencé **avant l'heure de fermeture du jour** (20h00 par défaut, celle des heures d'ouverture R54, donc 16h00 un 24 décembre réglé ainsi) : accepté mais signalé | 🟠 | `AVERT_INVENTAIRE_AVANT_FERMETURE` | **oui — règlement intérieur 15/10/2026** · fermeture du jour plutôt que 20h00 fixe : **non** (q. 51) |
| R58 | À la remise de la commande : liste des articles à cocher **devant le client**. Tant qu'un article n'est pas coché, la remise est refusée | 🔴 | `ERR_DECOMPTE_INCOMPLET` | **oui — règlement intérieur 15/10/2026** |
| R59 | Gâteau simple sur commande : **tailles standard uniquement** — 4, 6, 8, 10, 15, 20, 25, 30 parts (liste réglable). Autre taille refusée à la saisie, avec deux boutons vers les tailles voisines : 13 parts → « Passer à 10 » / « Passer à 15 » ; 1 part → « Passer à 4 » ; 35 parts → « Passer à 30 ». Exception possible par code gérant, nom enregistré | 🔴 (🟠 si gérant) | `ERR_TAILLE_NON_STANDARD` · `AVERT_TAILLE_NON_STANDARD_AUTORISEE` | **oui — propriétaire 15/10/2026** · définition du « gâteau simple » : **non** (q. 61) · liste vide = aucune taille imposée : **non** (q. 62) |

## K. Gâteaux sur commande — décisions du propriétaire du 26/10/2026

| # | Règle | Niveau | Code | Confirmé |
|---|---|---|---|---|
| R63 | **Forme du gâteau** (Bavarois — tous ses goûts : forêt noire, framboise, mangue, passion… —, Crème fraîche, Entremet, Cake nature ; liste réglable). **De 4 à 8 parts : carré ou rond**, la forme est **obligatoire** (bouton « Choisir carré ou rond »). **Au-dessus de 8 parts : carré d'office**, rien à demander (le chiffre 8 est réglable). Un client qui veut un **rond au-dessus de 8 parts** : refus, avec deux boutons « **Passer en carré** » et « **Passer en Layer Cake** » — le Layer Cake garde le nombre de parts, relevé à son minimum : un Bavarois rond de 10 parts devient un Layer Cake de **20 parts** (minimum du Layer Cake), un rond de 25 parts un Layer Cake de 25 parts. Un gâteau sur commande devenu gâteau du comptoir (R60, ex. Bavarois 6 parts → Bavarois 6P) garde sa forme (le Bavarois 10P est carré d'office). Layer Cake, Number Cake, pièces montées, minis et gâteaux de vitrine : pas de forme demandée | 🔴 | `ERR_FORME_MANQUANTE` · `ERR_FORME_ROND_IMPOSSIBLE` | **oui — propriétaire 26/10/2026** · libellé « Carré » pour carré **et** rectangle : **non** (q. 65) · Bavarois 10P carré : **non** (q. 66) |
| R64 | **Pâte à sucre = un supplément, pas un gâteau.** Prix **par personne** (lu au tarif : 6,00 €/pers ; gâteau de 20 parts → +120,00 €), contrairement à la photo et à l'écriture (une fois par gâteau, R7). Se met sur un **Layer Cake** ou un **gâteau carré/rectangle** (Bavarois, Crème fraîche, Entremet, Cake nature). La ligne « Pâte à sucre » porte **autant de parts que le gâteau**. Le gâteau doit faire **au moins 20 parts** (minimum bloquant, réglable) : sinon refus « Minimum 20 parts pour « Entremet » (avec « Pâte à sucre ») » et le bouton « **Passer à 20 parts** » sur le gâteau. Parts différentes de celles du gâteau : bouton « Passer à N parts ». Pâte à sucre sans gâteau, ou sur un gâteau qui ne la reçoit pas (Number Cake, pièce montée) : bouton « Supprimer la ligne ». Deux Pâte à sucre pour un seul gâteau : refus. Elle n'ouvre jamais droit à une photo ou une écriture de plus. **Rond au-dessus de 8 parts → Layer Cake, même en pâte à sucre** : les gâteaux ronds bas en pâte à sucre sont des Layer Cakes (un Bavarois, une Crème fraîche, un Entremet ou un Cake nature reçoit la pâte à sucre seulement s'il est carré) | 🔴 | `ERR_QUANTITE_MIN` · `ERR_SUPPLEMENT_PARTS` · `ERR_SUPPLEMENT_SANS_GATEAU` · `ERR_SUPPLEMENT_NON_ADMIS` · `ERR_SUPPLEMENT_TROP_NOMBREUX` | **oui — propriétaire 26/10/2026** · rond en pâte à sucre = Layer Cake : **oui — propriétaire 26/10/2026** · pas sur Number Cake ni pièce montée : **non** (q. 67) · cumul avec photo / écriture : **non** (q. 68) |
| R65 | **Matadi chocolat 4P ne se fait pas** (le Matadi chocolat commence à 6P). La ligne reste au tarif du comptoir (on ne touche pas à votre fichier), mais elle est **refusée à la commande** avec deux boutons : « **Passer en Matadi chocolat 6P** » et « **Prendre Mousse chocolat 4P** ». Le nombre de gâteaux est gardé. Pas de dérogation, même par le gérant. Liste des tailles interdites et de leurs remplaçants : réglable | 🔴 | `ERR_TAILLE_INTERDITE` | **oui — propriétaire 26/10/2026** · goût « Matadi » des Bûches 4P : **non** (q. 71) |

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
- **Règlement intérieur** : acompte d'au moins 50 %, horaires de retrait pâtisserie,
  commande inhabituelle, nom et téléphone, inventaire à 20h00, décompte à la remise
  (R52 à R58).
- **Commande pour le lendemain acceptée**, simple information (R53).
- **Tailles standard des gâteaux simples** : 4, 6, 8, 10, 15, 20, 25, 30 parts (R59).

## Décisions du propriétaire — 18/10/2026

- **Retrait le jour même autorisé** (R2, R53b) : simple information « prévenez l'atelier ».
- **Gâteau à étages** : plus de délai minimum par défaut ; le gérant peut en régler un (R2).
- **Acompte sous 50 %** : accepté avec un avertissement et le bouton « Mettre l'acompte à X € » (R52).
- **Heures d'ouverture du magasin** (6h00 → 20h00, réglables jour par jour et par date) pour
  tous les produits ; la règle « pâtisserie 9h / 12h » est supprimée ; l'heure de retrait
  est facultative (R54).
- **Fermetures** : seul le mardi est fermé, les jours fériés sont ouverts, pas de congés (R1, R1b, R1c).
- **Gâteau simple commandé dans une taille du comptoir** : prix du comptoir, ligne remplacée par le gâteau du comptoir, prix non modifiable (R60).

## Décisions du propriétaire — 26/10/2026

- **Forme du gâteau** : carré ou rond de 4 à 8 parts, carré d'office au-dessus ; un grand rond = un Layer Cake (R63).
- **Pâte à sucre** : supplément par personne, sur un Layer Cake ou un gâteau carré, gâteau de 20 parts au moins (R64).
- **Matadi chocolat 4P** : ne se fait pas ; Matadi chocolat 6P ou Mousse chocolat 4P à la place (R65).

## Comportements par défaut appliqués en l'absence de réponse

Chacun est marqué `// HYPOTHÈSE À VALIDER` dans le code et visible à l'écran :

1. ~~**Délais** → mariage / pièce montée 5 jours ouvrés~~ → **tranché** (18/10/2026) : aucun délai, sauf réglage du gérant pour un gâteau à étages (R2)
2. **Minimum 10/15 pièces** → par ligne de produit, pas par panier
3. ~~**Acompte** → aucun acompte exigé automatiquement~~ → **tranché** : au moins 50 % (R52)
