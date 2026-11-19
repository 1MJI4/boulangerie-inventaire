# Rapport du vendeur — 50 demandes de clients dans l’application de commande

Simulation du **jeudi 19 novembre 2026** (tarif `tarif_2026-11`, affiches `sur-commande_2026-10-26`), sur l’arbre de travail tel quel (branche `refonte/lot-2`, modifications non enregistrées comprises). Aucun fichier du dépôt n’a été modifié, aucun serveur appelé.

Livrables :

- `C:\Users\32483\AppData\Local\Temp\claude\fc9ca71273f5b6d3\2720ff1a-fa94-4160-8007-fe8dd7003d68\scratchpad\simulation\vendeur\journal.md` — le détail geste par geste des 50 demandes ;
- `C:\Users\32483\AppData\Local\Temp\claude\fc9ca71273f5b6d3\2720ff1a-fa94-4160-8007-fe8dd7003d68\scratchpad\simulation\commandes.json` — 55 commandes dans la forme enregistrée (51 en vigueur, 4 premières versions remplacées par leur modification) ;
- `C:\Users\32483\AppData\Local\Temp\claude\fc9ca71273f5b6d3\2720ff1a-fa94-4160-8007-fe8dd7003d68\scratchpad\simulation\bons` — 220 bons, `<id>-<DESTINATION>.txt` (4 exemplaires par commande) ;
- `C:\Users\32483\AppData\Local\Temp\claude\fc9ca71273f5b6d3\2720ff1a-fa94-4160-8007-fe8dd7003d68\scratchpad\simulation\rapport-vendeur.md` — ce rapport ; scripts dans `C:\Users\32483\AppData\Local\Temp\claude\fc9ca71273f5b6d3\2720ff1a-fa94-4160-8007-fe8dd7003d68\scratchpad\simulation\vendeur` (`montage.mjs`, `outils.mjs`, `scenarios-a.mjs`, `scenarios-b.mjs`, `scenarios-c.mjs`, `remarques.mjs`, `produire.mjs`, `rapport.mjs`).

## 1. Les 50 demandes

**49 demandes validées** (dont C48 en deux commandes, et C12, C40, C43, C50 modifiées après coup), **1 contournée** (C36 : la demande d’origine n’existe qu’en remarque libre, la commande enregistrée est un repli), **0 impossible à saisir**. Trois validées portent un élément hors tarif noté en texte libre faute de mieux (C13 fleurs, C15 fruits, C33 licorne).

- Écart de total avec l’attente raisonnable : **0,00 € sur les 50** (7 168,30 € annoncés en tout).
- Gestes par demande : minimum 14, médiane 25, maximum 87 (C40 : 15 produits, puis modification) ; 1392 gestes en tout. Comptage approximatif : 1 par toucher, 2 par saisie au pavé ou au clavier.
- Code du manager : utilisé **1 fois** (C16, crème fraîche au chocolat ; le client a demandé qu’on appelle le manager). Je ne m’en suis pas servi pour le prix négocié (C30) ni pour les demandes hors tarif (C36, C37) : manager absent dans le scénario.
- Acompte : 11 demandes où le client promet un acompte « plus tard » sont enregistrées à 0,00 € avec la promesse en remarque (voir I7). C’est le seul écart avec les attentes, et il ne porte pas sur le total.

| Demande | Client | Résultat | Total annoncé | Attendu | Écart | Gestes | Refus rencontrés à l’écran |
|---|---|---|---:|---:|---:|---:|---|
| C01 | Fatima El Amrani | validée | 38,00 € | 38,00 € | 0,00 € | 16 | FORME_MANQUANTE |
| C02 | Jean-Pierre Vandenbroeck | validée | 54,00 € | 54,00 € | 0,00 € | 18 | — |
| C03 | Samira Benali | validée | 245,00 € | 245,00 € | 0,00 € | 21 | QUANTITE_MIN |
| C04 | Karim Ouali | validée | 31,00 € | 31,00 € | 0,00 € | 17 | TAILLE_INTERDITE, FORME_MANQUANTE |
| C05 | Marie-Claire Dumont | validée | 47,00 € | 47,00 € | 0,00 € | 22 | FORME_MANQUANTE, FORME_ROND_IMPOSSIBLE |
| C06 | Thomas Leclercq | validée | 69,50 € | 69,50 € | 0,00 € | 15 | — |
| C07 | Aïcha Diallo | validée | 36,00 € | 36,00 € | 0,00 € | 22 | TAILLE_NON_STANDARD, PRIX_COMPTOIR, FORME_MANQUANTE |
| C08 | Sophie Peeters | validée | 69,50 € | 69,50 € | 0,00 € | 26 | QUANTITE_MIN, TAILLE_NON_STANDARD |
| C09 | Mehdi Bouzid | validée | 150,00 € | 150,00 € | 0,00 € | 25 | QUANTITE_MIN, GOUT_MANQUANT |
| C10 | Nathalie Janssens | validée | 150,00 € | 150,00 € | 0,00 € | 22 | GOUT_MANQUANT |
| C11 | Hanane Tahiri | validée | 127,00 € | 127,00 € | 0,00 € | 27 | GOUT_MANQUANT |
| C12 | Élodie Lambert | validée | 338,00 € | 338,00 € | 0,00 € | 30 | GOUT_MANQUANT |
| C13 | Youssef Chaoui | validée | 252,00 € | 252,00 € | 0,00 € | 30 | QUANTITE_MIN, GOUT_MANQUANT |
| C14 | Laurent De Smet | validée | 57,40 € | 57,40 € | 0,00 € | 21 | GOUT_MANQUANT |
| C15 | Monique Claes | validée | 33,00 € | 33,00 € | 0,00 € | 20 | FORME_MANQUANTE |
| C16 | Rachid Amrani | validée | 65,00 € | 65,00 € | 0,00 € | 19 | GOUT_RESERVE |
| C17 | Isabelle Mertens | validée | 58,00 € | 58,00 € | 0,00 € | 19 | GOUT_MANQUANT |
| C18 | Philippe Wauters | validée | 143,00 € | 143,00 € | 0,00 € | 36 | GOUT_MANQUANT |
| C19 | Inès Haddad | validée | 79,40 € | 79,40 € | 0,00 € | 31 | GOUT_MANQUANT |
| C20 | Christine Vermeulen | validée | 138,50 € | 138,50 € | 0,00 € | 36 | QUANTITE_MIN |
| C21 | Bilal | validée | 74,00 € | 74,00 € | 0,00 € | 24 | QUANTITE_MIN, CHAMP_OBLIGATOIRE |
| C22 | Khadija Lahlou | validée | 223,50 € | 223,50 € | 0,00 € | 23 | — |
| C23 | Anne-Sophie Goossens | validée | 54,00 € | 54,00 € | 0,00 € | 19 | — |
| C24 | Dominique Maes | validée | 40,00 € | 40,00 € | 0,00 € | 18 | — |
| C25 | Grégory Declercq | validée | 137,50 € | 137,50 € | 0,00 € | 19 | QUANTITE_MIN |
| C26 | Olivier Hermans | validée | 166,00 € | 166,00 € | 0,00 € | 29 | — |
| C27 | Mustapha Benhaddou | validée | 74,00 € | 74,00 € | 0,00 € | 33 | — |
| C28 | Zineb Alaoui | validée | 94,50 € | 94,50 € | 0,00 € | 27 | — |
| C29 | Kevin Dubois | validée | 174,50 € | 174,50 € | 0,00 € | 47 | — |
| C30 | Abdelkader Messaoudi | validée | 67,50 € | 67,50 € | 0,00 € | 19 | SOUS_PLANCHER |
| C31 | Josiane Lefèvre | validée | 32,00 € | 32,00 € | 0,00 € | 14 | ACOMPTE_SUPERIEUR_TOTAL |
| C32 | Nadia Belkacem | validée | 48,00 € | 48,00 € | 0,00 € | 22 | FORME_MANQUANTE |
| C33 | Laura Jacobs | validée | 277,00 € | 277,00 € | 0,00 € | 28 | GOUT_MANQUANT |
| C34 | Soufiane Kabbaj | validée | 33,00 € | 33,00 € | 0,00 € | 20 | FORME_MANQUANTE |
| C35 | Valérie Simon | validée | 76,00 € | 76,00 € | 0,00 € | 20 | FORME_MANQUANTE |
| C36 | Béatrice Renard | contournement (demande d’origine en remarque libre, repli sur 2 tartes du tarif) | 42,00 € | 42,00 € | 0,00 € | 31 | GOUT_MANQUANT, MONTANT_NUL, COMMANDE_VIDE |
| C37 | François Collignon | validée | 71,40 € | 71,40 € | 0,00 € | 27 | TAILLE_NON_STANDARD, GOUT_MANQUANT |
| C38 | Sarah Cohen | validée | 82,00 € | 82,00 € | 0,00 € | 27 | FORME_MANQUANTE |
| C39 | Loubna Idrissi | validée | 1 273,00 € | 1 273,00 € | 0,00 € | 70 | GOUT_MANQUANT, QUANTITE_MIN |
| C40 | Stéphanie Verhaegen | validée | 836,60 € | 836,60 € | 0,00 € | 87 | QUANTITE_MIN |
| C41 | Guy Lemaire | validée | 16,00 € | 16,00 € | 0,00 € | 22 | — |
| C42 | Caroline Thys | validée | 96,00 € | 96,00 € | 0,00 € | 25 | — |
| C43 | Julien Marchal | validée | 150,00 € | 150,00 € | 0,00 € | 40 | — |
| C44 | Patricia Van Damme | validée | 340,00 € | 340,00 € | 0,00 € | 26 | — |
| C45 | Hassan Ben Ali | validée | 89,60 € | 89,60 € | 0,00 € | 30 | — |
| C46 | Martine Baudoux | validée | 56,60 € | 56,60 € | 0,00 € | 28 | — |
| C47 | Dylan Michiels | validée | 33,20 € | 33,20 € | 0,00 € | 21 | — |
| C48 | Nicolas Pirard | validée (2 commandes) | 145,00 € | 145,00 € | 0,00 € | 48 | — |
| C49 | Amina Ouazzani | validée | 99,00 € | 99,00 € | 0,00 € | 27 | — |
| C50 | Brigitte Delvaux | validée | 85,10 € | 85,10 € | 0,00 € | 48 | FORME_MANQUANTE |

## 2. Les problèmes, du plus grave au moins grave

Convention : **(exécuté)** = comportement obtenu en appelant les fonctions du dépôt dans la simulation ; **(lu dans le code, non exécuté)** = déduit de la lecture, à vérifier sur la tablette. Les chemins sont relatifs à `C:\Users\32483\Projets\Clients\PainPatisserie\inventaire\boulangerie-inventaire\`.

Aucun prix faux n'a été trouvé : les 50 totaux sont égaux, au centime, à l'attente raisonnable. Les problèmes sont ailleurs : information perdue entre l'écran et le papier, recherche, sorties, acompte.

### BLOQUANT — information perdue ou fausse

**B1. Le nombre de sandwichs d'un pain surprise n'est imprimé sur aucun bon.** (exécuté)
- Clients : C24 (30 sandwichs), C39 (40 sandwichs).
- Scénario : toucher « Grand pain surprise » → champ « Nombre de sandwichs » au pavé : 30 → avertissement `AVERT_PAIN_SUPPLEMENTAIRE`, bouton « Ajouter un 2ᵉ pain » → valider. La valeur est enregistrée (`nbObjets`), l'avertissement a servi… et les quatre bons impriment seulement « 2 × Grand pain surprise 40,00 € ».
- Attendu : « 30 sandwichs » sous la ligne, sur les exemplaires ATELIER / MAGASIN au moins. Sans ma précision tapée à la main, l'atelier ne sait pas combien garnir.
- En cause : `src/lib/ticketCanvas.ts` — le type `LigneTicket` (l. 52-91) n'a pas de champ pour `nbObjets`, `formaterLigneTicket` (l. 299-335) ne le lit pas, `consignesDeLigne` (l. 370-381) ne l'imprime pas. Il est pourtant enregistré : `src/app/api/commandes/route.ts` l. 535. L'écran de relecture « comme le carnet » (`LigneCarnet`, `src/components/FormulaireCommande.tsx` l. 3754-3838) ne le montre pas non plus.

**B2. Le message de confirmation préparé pour le client (WhatsApp) écrit les grammes et les parts comme des quantités.** (exécuté)
- Clients : C28 (« • 1500 × Corne de gazelle », « • 750 × Sellou », « • 500 × Sablé orientaux », « • 1000 × Halwa arbia »), C39 (2 000 et 1 000), C40 (« • 20 × Bavarois » pour UN Matadi chocolat de 20 parts, « • 15 × Bavarois » pour la Fleur caramel chocolat), C33 (« • 25 × Layer Cake », « • 25 × Pâte à sucre »), et toute commande au kilo ou par personne.
- Scénario : commande validée → page d'impression → message de confirmation (`messageConfirmation`).
- Attendu : « 1,500 kg Corne de gazelle », « Matadi chocolat — 20 parts », comme sur le bon. Le client lit qu'il a commandé 1 500 cornes de gazelle ou 20 bavarois ; le goût, la forme et les précisions n'y sont pas. C'est exactement la confusion kilo / pièce que la LOI 2 veut empêcher, mais dans un texte envoyé au client.
- En cause : `src/lib/commandes.ts` l. 294-297, `` `• ${l.quantite} × ${l.libelle}` `` — ni l'unité (`unite`), ni la base de prix (`prixProduit.basePrix`), ni le libellé selon le goût (`libelleSelonGout`) ne sont utilisés, alors que `formaterLigneTicket` le fait pour le bon. Appelé par `src/app/commandes/[id]/imprimer/page.tsx` l. 161.

### IMPORTANT — vente fragilisée, argent ou production exposés

**I1. Une heure de retrait déjà passée est acceptée sans un mot (retrait le jour même).** (exécuté)
- Client : C47, essai à part. Message lu à 10h15, retrait « aujourd'hui 6h00 » : la bande d'heures propose tous les créneaux depuis 06:00, la commande est enregistrée, seule l'information « Commande pour aujourd'hui : prévenez l'atelier tout de suite. » s'affiche.
- Attendu : un avertissement « cette heure est passée » (ou les créneaux passés grisés), avec la sortie vers le prochain créneau.
- En cause : `validerHeureRetrait` (`src/domaine/reglement.ts` l. 226) ne compare l'heure qu'aux heures d'ouverture ; `creneauxRetrait` (`src/components/commande/modele.ts` l. 1192-1209) ne connaît pas l'heure qu'il est ; `analyser` (`src/domaine/commande.ts` l. 709-716) ne reçoit que la date du jour.

**I2. Un acompte « par virement » pas encore reçu s'imprime comme un acompte versé.** (exécuté)
- Clients : C09 (50 €), C13 (126 €), C25 (68,75 €), C40 (200 €), C43 (99 €), C44 (170 €).
- Scénario : « Commande prise : Téléphone » (met le paiement sur Virement d'office) → acompte saisi → les bons BUREAU, MAGASIN et ATELIER impriment « ACOMPTE 200,00 € / RESTANT DÛ 636,60 € », sans dire que rien n'est arrivé. Seul l'exemplaire CLIENT porte « Communication du virement ».
- Attendu : sur les exemplaires internes, « ACOMPTE ATTENDU PAR VIREMENT » tant que `acompteRecuLe` est vide ; sinon la personne qui remet la commande encaisse 200 € de moins si le virement n'est jamais venu.
- En cause : `dessiner` dans `src/lib/ticketCanvas.ts` l. 758-760 (montants) et l. 770 (mode de paiement lu uniquement pour le CLIENT).

**I3. Je ne trouve pas des produits courants avec les mots du client.** (exécuté)
- « coeur », « gateau coeur » → RIEN (C19) : les produits s'écrivent « Cœurs 5P / 7P / 9P », « Petit Cœurs » ; trouvés seulement en ouvrant la famille « Special fin d'année ».
- « pain au chocolat » → RIEN (C26, C43, C49) ; « couque chocolat » → RIEN (C41, C42, C45) : le produit est « Pain chocolat ».
- « pastilla » → RIEN ; « bastella » → 2 pièces du comptoir ; « bestella » → les 4 produits sur commande (C22).
- « mariage » → RIEN (C12, produit renommé « Pièce montée 2 étages ») ; « gateau chiffre », « lettres » → RIEN (C09, C11) ; « cake chocolat » → RIEN (C17) ; « coca zero » → RIEN (C29) ; « bavarois pistache » → RIEN (C37) ; « licorne » → RIEN (C33).
- Attendu : « œ » lu comme « oe », les petits mots (« au », « de », « aux ») ignorés, et quelques synonymes du comptoir (pastilla, gâteau de mariage, gâteau chiffre, pain au chocolat, couque au chocolat).
- En cause : `normaliserRecherche` (`src/components/commande/modele.ts` l. 61-63 : la décomposition NFD ne sépare pas « œ ») et `fichesVisibles` (l. 93-100 : TOUS les mots tapés doivent se trouver dans « produit + sous-catégorie + rayon »).

**I4. Le minimum de 10 se contourne en touchant l'autre carte.** (exécuté)
- Clients : C21 (essai à part), C03.
- Scénario : recherche « mini burger » → deux cartes au même prix, « Mini-Burger (3,50 €) » (comptoir, `sales/mini-burger`) puis « Mini burger (3,50 €, sur commande) ». La première accepte 9 pièces sans aucun message ; seule la seconde refuse (`ERR_QUANTITE_MIN`, « Passer à 10 pièces »).
- Mêmes doublons, sans enjeu de minimum mais avec le même doute : « Quiche 6P Saumon/poulet » / « Quiche poulet/saumon, 6 personnes » à 27,00 € (C23) ; « Bastella Poulet » / « Bestella poulet / fruits de mer, individuelle » à 3,90 € (C22).
- Attendu : une seule carte pour une commande, ou une mention visible « comptoir » / « sur commande » qui dise laquelle prendre.
- En cause : donnée du catalogue (deux produits) + `fichesVisibles` qui les montre côte à côte ; à trancher par le gérant (LOI 7).

**I5. La sortie « Passer à 8 parts » mène à un deuxième refus.** (exécuté)
- Client : C07. Tuile « Bavarois mangue » → « Autre » → 7 → `ERR_TAILLE_NON_STANDARD` « Ce gâteau se fait en 6 ou 8 parts, pas en 7… » → bouton « Passer à 8 parts » → nouveau refus `ERR_PRIX_COMPTOIR` « « Bavarois » en 8 parts existe au comptoir : il se vend au prix du comptoir. Prenez le gâteau du comptoir à la place. » → second bouton « Prendre le gâteau du comptoir ». Entre les deux, la ligne s'appelle « Bavarois » et le total est « 36,00 € + à compléter ».
- Attendu : « Passer à 8 parts » doit faire ce que fait le bouton de taille « 8 » (devenir « Bavarois mangue 8P » à 36,00 €) en un geste. Même défaut pour « Passer à 6 parts », et pour toute taille standard ≤ 8.
- En cause : `src/components/FormulaireCommande.tsx` l. 1094, `onClick={() => majLigne(iLigne, { quantite: t })}` au lieu de `choisirTaille(…)` (`modele.ts` l. 650-673), que le bouton de taille utilise (l. 1550-1552).

**I6. Dix bûchettes = dix lignes, dix goûts ; six petits cœurs = six lignes.** (exécuté)
- Clients : C18 (10 Bûchettes : 20 gestes, bon de 12 lignes dont dix « 1 × Bûchette / GOÛT : … »), C19 (6 Petit Cœurs).
- La règle « une ligne par gâteau » est voulue pour les gâteaux ; ici elle s'applique à des pièces individuelles à 5,90 € parce que tout le rayon « Special fin d'année » est classé « gâteau ». Conséquence imprévue : chaque pièce a aussi son bloc « Écriture sur ce gâteau ».
- Attendu : pour Bûchette et Petit Cœurs, une quantité par goût (« 5 × Bûchette — Mousse au chocolat »), comme sur le carnet.
- En cause : `toucherProduit` (`modele.ts` l. 173-177) via `estFicheGateauDuComptoir`, et le classement du rayon dans `src/catalogue/familles.ts` l. 43-48 (hypothèse notée dans le code : « classé gâteau »).

**I7. Aucun endroit pour un acompte promis, ni pour un complément d'acompte.** (exécuté)
- Clients : C02, C03, C05 (25 € apportés par le mari), C08, C10 (75 €), C15 (20 €), C19, C22 (100 €), C29 (80 €), C42, C49 (50 €) — 11 demandes sur 50. Rien n'étant reçu, j'ai touché « Pas d'acompte » et écrit la promesse en Remarques ; le bon dit « ACOMPTE 0,00 € » et la promesse est en petit dans le cadre Remarques (absent de l'exemplaire CLIENT).
- C12 (modification) : pour passer de 141,00 € à 169,00 € il faut retaper le total de l'acompte ; l'écran n'affiche pas les 28,00 € à encaisser et l'historique dit seulement « acompte : 141,00 € → 169,00 € ».
- Attendu : « acompte attendu : X € pour le … », et à la modification « à encaisser aujourd'hui : 28,00 € ».
- En cause : un seul champ `acompteCentimes` (`EtatFormulaire`, `modele.ts` l. 458-468) ; `paiement` dans `FormulaireCommande.tsx` l. 1635-1671.

**I8. Les variantes d'un produit ne sont que du texte libre.** (exécuté)
- Clients : C20 (éclairs / mille-feuilles sur la même carte : 2e toucher = +1 sur la même ligne), C22 (individuelles poulet / fruits de mer), C23 (quiche saumon / poulet), C25 et C40 (garnitures des mini-sandwichs), C39 et C40 (briwate / cigare, bestella poulet / fruits de mer).
- Le tarif porte une liste FERMÉE de 10 garnitures pour les mini-sandwichs (`variantesFermees`, `data/tarifs-sur-commande_2026-10-26.json` l. 25-27) : l'écran ne la propose pas ; j'ai pu écrire « 10 Club dinde–fromage » comme j'aurais écrit « jambon-fromage ». La précision est coupée à 200 caractères sans prévenir (exécuté sur la reconstitution de `route.ts` l. 401 : 260 caractères saisis, 200 enregistrés).
- Attendu : pour ces produits, des boutons de variante avec une quantité chacun, imprimés sous la ligne.
- En cause : `LigneDuBon` (`FormulaireCommande.tsx` l. 3342-3375) — un champ « précision » et, au mieux, les mots de la liste du manager ; `variantes` du catalogue n'est lu nulle part dans `src/components/`.

**I9. « Autre demande » ne permet pas de noter une demande « à chiffrer ».** (exécuté)
- Clients : C36 (tarte citron meringuée, plateau de fruits), C37 (sablé breton grand format), C33 (corne et modelages).
- Scénario C36 : « Autre demande » → « C'est un gâteau ? Oui » → `ERR_GOUT_MANQUANT` → `ERR_MONTANT_NUL` « Le prix de la ligne … est nul. Indiquez le prix, s'il vous plaît… » → (avec un prix) `ERR_DROIT_INSUFFISANT` « Seul le manager peut fixer le prix d'une ligne libre… ». Sans manager dans le magasin, la ligne bloque TOUTE la commande ; je l'ai retirée et j'ai écrit la demande en Remarques.
- Attendu : pouvoir enregistrer la ligne « prix à confirmer par le gérant » (le bon sait déjà imprimer « À CONFIRMER PAR LE PÂTISSIER »), sans bloquer les autres produits. La règle de doute (refuser plutôt qu'accepter à tort) est respectée, mais la sortie proposée — le code du manager — n'existe pas quand il est absent.
- En cause : `controlerLigneLibre` (`src/domaine/commande.ts` l. 572-613, hypothèse à valider n° 3).

**I10. Une allergie n'a pas de place, et les Remarques s'impriment en petit.** (exécuté pour le contenu, lu dans le code pour la taille)
- Client : C17 (« un enfant allergique aux fruits à coque »). Seul endroit : Remarques de la commande. Sur le bon : cadre pointillé, texte de 19 points maigre, APRÈS tous les produits ; absent de l'exemplaire CLIENT.
- Attendu : une mention forte en tête du bon (« ALLERGIE : … »), comme « DEMANDE INHABITUELLE ».
- En cause : `src/lib/ticketCanvas.ts` l. 753-755, `mention(plume, 'Remarques', commande.remarques, true)` (le dernier argument = « discret »).

### GÊNANT — fait perdre du temps ou fait douter

**G1. Rond au-dessus de 8 parts : l'écran ne dit rien tant que « Rond » n'était pas déjà choisi.** (exécuté) C06 : à 15 parts il n'y a que le bouton « Carré » et « au-dessus de 8 parts ». Le message utile (« … Pour un rond, passez en « Layer Cake » (minimum 20 parts). ») et son bouton « Passer en Layer Cake (20 parts) » n'apparaissent que si la forme « Rond » était posée avant de monter la taille (C05). Attendu : le bouton « Rond → Layer Cake (20 parts) » visible à côté de « Carré ». `FormulaireCommande.tsx` l. 3243-3265, `formesPossibles` (`src/domaine/formes.ts` l. 40-43).

**G2. Les messages disent « Bavarois » quand ma ligne s'appelle autrement.** (exécuté) C05 : ligne « Fraisier », message « « Bavarois » se fait rond jusqu'à 8 parts… ». C35, C38 : ligne « Bavarois fraise 8P », message « Choisissez la forme de « Bavarois 8P » ». C07 : « « Bavarois » en 8 parts existe au comptoir ». `src/domaine/commande.ts` l. 482 (`libelleProduit(fiche)` au lieu du libellé selon le goût).

**G3. La recherche ramène trop de choses.** (exécuté) « eau » → 71 produits (le mot est dans « Gâteaux et tartes ») ; « tarte » → 58 ; « mini » → 28 dont tous les gâteaux sur commande (leur rayon s'appelle « Tarifs (minimum)… »), si bien que « mini bavarois » met le gros « Bavarois » en premier (C20) ; « spa » → « Pain Espagnol ». Au-delà de 60 cartes, le reste est caché. `modele.ts` l. 99 (le nom du rayon fait partie du texte cherché).

**G4. Sans recherche ni famille, 13 produits sont cachés.** (exécuté) La grille par défaut compte 73 produits, l'écran en montre 60 (`MAX_CARTES`, `FormulaireCommande.tsx` l. 3414, 3639, 3714) : Crème fraîche, Bavarois, Layer Cake, Number Cake, les deux pièces montées, Entremet, les trois minis sucrés et les suppléments ne s'affichent qu'en touchant « Gâteau ». Le message « 13 autres produits : affinez la recherche ou choisissez une famille » le dit.

**G5. Paiement : seulement « Espèces » ou « Virement » ; prise : seulement « Comptoir » ou « Téléphone ».** (lu dans le code, effets exécutés) Carte et Payconiq (C07, C12, C20, C32, C42, C46) n'existent pas ; les 13 demandes WhatsApp sont enregistrées « Téléphone » ; toucher « Téléphone » met le paiement sur « Virement » d'office (l. 2055), à remettre sur « Espèces » pour un client qui paiera au retrait. L'origine n'est imprimée sur aucun bon. `src/lib/commandes.ts` l. 30-31, `FormulaireCommande.tsx` l. 1665-1666 et 2052-2057.

**G6. Le montant d'acompte conseillé ne s'affiche qu'après une erreur.** (exécuté) C37 : le pavé dit « au moins 50 % du total » sans le chiffre ; pour le lire j'ai touché « Pas d'acompte », lu l'avertissement (35,70 €), puis son bouton. `FormulaireCommande.tsx` l. 1355.

**G7. Le bon répète le goût dans le nom.** (exécuté) « Fraisier 8P » puis « GOÛT : FRAISIER » (C01, C50), « Matadi chocolat 6P / GOÛT : MATADI CHOCOLAT » (C04), « Mousse chocolat 6P / GOÛT : MOUSSE CHOCOLAT » (C32), « Bavarois mangue 8P / GOÛT : MANGUE » (C07). Au-dessus de 8 parts le bon est propre (« Matadi chocolat — 25 PARTS »). `ticketCanvas.ts` l. 308 et 326 : la table `LIBELLES_SELON_GOUT` ne couvre pas les produits du comptoir qui portent déjà leur nom.

**G8. L'accord du manager n'est sur aucun bon.** (exécuté) C16 : « Crème fraîche — GOÛT : CHOCOLAT » sans « accordé par … ». Tracé en base (`goutAutorisePar`), invisible pour le pâtissier.

**G9. La photo du client n'accompagne jamais la commande.** (exécuté) C13, C32, C33 : case « Photo d'exemple envoyée sur WhatsApp » → « MODÈLE — Photo d'exemple sur WhatsApp — à réclamer au manager ». Pour une photo À IMPRIMER (C32), le fichier n'est pas rattaché non plus ; une seule photo par gâteau, pas de quantité.

**G10. Décorations, fruits, fleurs : aucun prix, aucune indication.** (exécuté) Oreo (C09), Speculoos (C10), Kinder (C13), fruits (C15), fleurs (C13) : ajoutés sans supplément ; le total annoncé est peut-être trop bas. Question déjà ouverte au tarif (`data/tarifs-sur-commande_2026-10-26.json`, « Décorations à +5 € … »), mais l'écran ne prévient pas le vendeur.

**G11. Plateaux : rien à la prise de commande.** (exécuté) C45 : ni bouton « plateau », ni rappel « 16 par plateau » sur les lignes Croissant / Pain chocolat ; `piecesParPlateau` n'est utilisé que par les écrans de prévision.

**G12. Pas de « recopier la commande ».** (exécuté) C48 : « la même chose pour vendredi » = tout ressaisir (24 gestes), deux bons sans lien.

**G13. Passer d'un produit à un autre = retirer et recommencer.** (exécuté) Pièce montée 3 étages → 2 étages (C13, la seule sortie est « Passer à 60 parts »), Number Cake → Layer Cake (C11, goût perdu), Layer Cake → Bavarois (C08), gâteau retiré puis redemandé (C38).

**G14. L'entremet de la vitrine n'a pas de suite « en 10 ».** (exécuté) C14 : la tuile « Entremet 8P » ne mène pas à l'Entremet sur commande ; et le même gâteau s'appelle « Noisette chocolat » d'un côté, « Chocolat noisette » de l'autre.

**G15. Le supplément Écriture s'imprime entre les gâteaux.** (exécuté) C35 : « 1 × Bavarois fraise 8P » / « 2 × Supplément Écriture simple » / « 1 × Bavarois fraise 8P ». Il reste à la place où il a été créé (après le premier gâteau).

**G16. Un produit à minimum s'allume en rouge dès le premier toucher.** (exécuté) Chaque toucher pose 1 pièce, donc « Minimum 10 pièces pour « Mini burger » » s'affiche avant que j'aie tapé la quantité (C03, C20, C21, C25, 5 fois en C39). Voulu par le modèle (« aucun pré-remplissage au minimum »), mais bruyant sur une commande de minis.

**G17. 250 pièces pour 7h : aucun signal.** (exécuté) C44 : accepté tel quel. La case « Demande inhabituelle (ingrédient particulier, moule spécial…) » fait imprimer « À CONFIRMER — PRIX ET FAISABILITÉ », mais son libellé ne parle pas de quantité.

**G18. Le téléphone manquant n'est signalé qu'à la toute fin.** (exécuté pour la fenêtre, lu dans le code pour le bouton) C21 : « Continuer : les produits » passe avec un téléphone vide (l. 2174) ; la fenêtre « Il manque : • Téléphone » n'arrive qu'à « Valider ».

**G19. Questions sans réponse à l'écran.** Sandwichs compris dans les 20 € du pain surprise ? (C24, question ouverte au tarif) ; parfum du « Trompe l'oeil XXL 4P » ? (C38) ; la pistache se fait-elle ? (C37).

## 3. Ce qui marche bien

- **Les prix.** 50 totaux justes au centime, y compris au kilo (0,750 kg × 22,00 € = 16,50 €), en commande mixte de 17 lignes (877,10 €) et après modification (836,60 €).
- **Les tuiles de gâteaux** (Fraisier, Matadi chocolat, Bavarois fraise, Croûte…) : un toucher, goût déjà posé, prix du comptoir écrit sur les boutons 4 / 6 / 8, bascule automatique au prix par personne au-dessus (C01, C05, C35, C40).
- **Les refus avec leur sortie en un geste** : Matadi 4P → « Passer en Matadi chocolat 6P » / « Prendre Mousse chocolat 4P » (C04) ; Layer Cake 12 → « Passer à 20 parts » (C08) ; 12 parts → « Passer à 10 parts » / « Passer à 15 parts » / « Saisir le code du manager » (C08, C37) ; 9 mini burgers → « Passer à 10 pièces » (C21) ; prix sous le plancher → « Remettre 4,50 € par personne » (C30) ; acompte trop élevé → « Ramener l'acompte à 32,00 € » (C31) ; crème fraîche au chocolat → « Remettre Vanille » / code du manager (C16) ; 30 sandwichs → « Ajouter un 2ᵉ pain » (C24).
- **Le mardi** est grisé dans la bande des jours ; les heures hors ouverture n'existent pas dans la liste (C10, C23, C26, C49).
- **Le Number Cake** : le nombre de chiffres suit le texte (« 25 » → 2, « LINA » → 4), les tailles partent du bon minimum (30, 60), l'aperçu « 2  5 » est clair (C09, C10, C11).
- **Une écriture par gâteau**, supplément ajouté tout seul, texte imprimé tel quel, fautes comprises (C34, C35).
- **Le kilo** : pavé de poids, jamais de « +1 », « 30 pièces » impossible à saisir (C28).
- **La modification** : avertissement « déjà imprimée : réimprimez », bandeau « MODIFIÉE le … / Jetez l'ancien bon », historique avec l'ancienne version des lignes (C12, C40, C43, C50).
- **L'acompte** : jamais oublié (bouton « Valider » grisé tant qu'on n'a ni montant ni « Pas d'acompte »), avertissement sous 50 % avec le montant exact.
- **« Demande inhabituelle »** imprime « À CONFIRMER — PRIX ET FAISABILITÉ » sur les exemplaires internes seulement (C13, C33, C44).

## 4. Ce que je n'ai pas pu simuler

- **L'aspect visuel et le toucher** : taille des boutons, lisibilité debout, défilement du bon dans la colonne étroite, pavés (dont la règle « le premier chiffre tapé remplace le nombre affiché »), clavier de la tablette (c'est lui qui écrit « coeur » et non « cœur »).
- **Les listes du manager** (goûts, recettes d'entremet, décorations, garnitures) : elles sont en base. J'ai supposé Vanille, Chocolat, Fraise, Framboise en goûts et Oreo, Kinder, Speculoos en décorations ; les autres goûts sont comptés comme tapés dans « Autre… ».
- **Le serveur et la base** : aucun appel. L'enregistrement (`commandes.json`) reproduit `lignesAEnregistrer` et `POST` / `PATCH` de `src/app/api/commandes/route.ts` à la main ; numéros fictifs (2026-09xx). Les contraintes en base, la file hors ligne, le code du manager réellement vérifié (C16 : accord posé comme le fait l'écran après un code accepté) ne sont pas exécutés.
- **L'imprimante** : les bons sont le texte tracé par le vrai dessin (`dessinerSurContexte`, `src/lib/ticketCanvas.ts`) sur un contexte factice. Le contenu et l'ordre sont exacts ; les retours à la ligne et le choix « SAMEDI 21 NOVEMBRE 2026 » / « SAMEDI 21/11 » dépendent de largeurs de caractères approchées. Tailles de police, cadres et zone de dessin ne sont pas rendus. BUREAU, MAGASIN et ATELIER ont le même contenu (seul le titre change) ; CLIENT n'a ni vendeur, ni remarques, ni mentions internes.
- **La galerie de photos de modèles** (bouton « Photos »), le rappel d'équipe, l'annulation par le gérant, la liste des commandes et l'écran de remise : non joués.
- **Le temps réel** : les gestes sont comptés (1 par toucher, 2 par saisie), pas chronométrés.
