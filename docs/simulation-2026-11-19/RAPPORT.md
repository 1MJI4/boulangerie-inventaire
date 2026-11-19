# Simulation de la prise de commande — rapport

Date : 19/11/2026 · Version testée : branche `refonte/lot-2`, telle qu'elle est sur le poste
(tarif de novembre, gâteaux en accès direct, écran en trois étapes, bon en onglets).
Rien n'a été modifié pendant la simulation.

## En une page

**Les prix sont justes.** Sur plus de 6 000 combinaisons et 50 commandes de clients, aucun
total ne s'écarte du tarif, et l'écran et le serveur disent toujours la même chose.

**Ce qui pèche, c'est l'information entre le client et le fournil.** Ce que le client dit
arrive bien jusqu'à la tablette, mais une partie ne s'imprime pas, ou s'imprime au mauvais
endroit : allergies, nombre de sandwichs, jour de production, ce qui a changé sur une
commande modifiée.

| Rôle | Résultat |
|---|---|
| Contrôle de chaque produit | 329 produits, 0 prix faux, 0 plantage · 3 défauts bloquants hors prix |
| Vendeur | 50 demandes : 49 validées, 1 contournée, 0 impossible · 50 totaux justes au centime |
| Atelier salé | 24 commandes : 19 préparées juste, 1 fausse, 4 appels au magasin |
| Pâtissier | 42 bons : 24 justes sans appel, 7 justes mais piégeux, 11 appels, 0 faux |

Le « 0 faux » du pâtissier tient à ce qu'il appelle à chaque doute. En lecture rapide,
quatre commandes deviennent fausses, dangereuses ou en retard.

**Les cinq choses à corriger en premier**

1. Une ligne **ALLERGIE** en tête du bon, avec une case à la saisie.
2. Imprimer **« À PRODUIRE LE … »** (la tablette le calcule déjà).
3. Imprimer **le nombre de sandwichs** d'un pain surprise.
4. Dire **ce qui a changé** sur un bon « MODIFIÉE ».
5. Réparer la **Pâte à sucre** (refus en boucle, mauvais gâteau).

---

## Comment la simulation s'est déroulée

Cinq agents, chacun dans son rôle, dans l'ordre réel du travail :

1. **Les clients** — 50 demandes écrites comme elles arrivent : 20 au comptoir, 17 au
   téléphone, 13 sur WhatsApp. Toutes les familles de produits, les seize tuiles de gâteaux,
   13 commandes de viennoiserie et boulangerie, deux grosses commandes de 14 et 15 lignes, et
   les pièges : sous le minimum, mardi, heure hors ouverture, Matadi en 4 parts, client sans
   numéro, refus d'acompte, produit absent du tarif, changement d'avis.
2. **Le contrôle de chaque produit** — les 329 produits et le maximum de combinaisons, passés
   dans les mêmes fonctions que l'écran et le serveur.
3. **Le vendeur** — a pris les 50 commandes, noté chaque geste et chaque gêne, et sorti
   220 bons (4 exemplaires par commande).
4. **L'atelier salé** — a lu les bons ATELIER à l'aveugle, écrit ses fiches de préparation,
   puis comparé à ce que le client avait réellement demandé.
5. **Le pâtissier** — même méthode, sur les 42 bons qui contiennent de la pâtisserie ou de la
   viennoiserie.

Les deux lecteurs ont écrit leurs fiches **avant** de voir la demande du client : ce qu'ils
auraient fabriqué de faux est donc mesuré, pas supposé.

---

## Ce qui marche

- **Les prix**, partout : comptoir, sur commande, au kilo, gâteaux du comptoir jusqu'à 8 parts
  puis prix par personne, changement de tarif (commande du 18/11 à l'ancien prix, du 20/11 au
  nouveau).
- **Les seize tuiles de gâteaux** : 1 206 combinaisons, aucune anomalie. Les trois gâteaux sans
  ligne au tarif sortent lisiblement sur le bon (« Bavarois fraise 6P », « Bavarois chocolat au
  lait praliné 8P », « Fleur caramel chocolat — 15 PARTS »).
- **Les minimums** : tous bloquants, chaque refus propose une sortie qui aboutit.
- **Le mardi** : toujours refusé, avec le mercredi proposé.
- **Les produits au kilo** : pavé du poids, jamais « +1 », bon impeccable
  (« 1,500 kg Corne de gazelle »).
- **Les goûts** : Crème fraîche à la vanille (autre goût sur code du manager), un goût par étage
  pour les pièces montées, listes propres des bûches et des cœurs.
- **Les écritures** : les 16 écritures arrivent au pâtissier conformes à la parole du client,
  fautes voulues comprises.
- **Les favoris** : jamais comptés deux fois (329 produits, pas 351).
- **Viennoiserie et boulangerie** (84 produits, 1 008 cas) : prix exacts à toutes les quantités,
  5 touchers = 5, quantités impossibles refusées, 17 croissants restent 17 pièces sans arrondi
  au plateau, doublons fusionnés.

---

## Les problèmes, par gravité

Chaque point indique **qui l'a vu**. Un point vu par plusieurs rôles est le plus sûr.
J'ai revérifié moi-même dans le code les points marqués ✔.

### A. Graves — un gâteau faux, un client en danger, une vente perdue

**A1. Les allergies n'ont pas de place.** *(pâtissier, atelier, vendeur)*
- Un enfant allergique aux fruits à coque : l'information s'imprime en bas du bon, dans les
  remarques, dans la même phrase que le paiement. Elle est absente de l'exemplaire du client.
- Une cliente fait retirer les cigares parce qu'« il y a des allergiques aux fruits de mer » :
  le mot allergie n'arrive sur aucun bon, et 20 mini-sandwichs crabe/surimi restent commandés.
- Cause : aucun champ à la saisie, donc tout passe par la remarque libre.

**A2. Le nombre de sandwichs d'un pain surprise n'est imprimé sur aucun bon.** ✔
*(vendeur, atelier)*
- Il est saisi et enregistré, mais le bon ne l'écrit pas. L'atelier ne l'a eu que parce que le
  vendeur l'avait réécrit à la main dans une précision.

**A3. Le jour de production n'est pas imprimé.** ✔ *(pâtissier, atelier)*
- Pour un retrait le mercredi matin, la veille est un mardi fermé. La tablette calcule bien le
  lundi, mais ne l'écrit pas. Trois commandes concernées. C'est exactement le piège que la
  règle du mardi voulait éviter.

**A4. Un bon « MODIFIÉE » ne dit pas ce qui a changé.** *(pâtissier, atelier)*
- Il affiche seulement « Jetez l'ancien bon ». Une commande est passée de 14h à 10h et de 50 à
  60 parts ; une autre a perdu 30 pièces ; une autre une ligne entière. Rien sur le papier.
- Il faut une minute pour comparer les deux versions, à condition d'avoir gardé l'ancienne.

**A5. Pâte à sucre : refus en boucle.** ✔ *(contrôle des produits)*
- Bavarois fraise 6P, puis Layer Cake 20 parts, puis « Pâte à sucre » : elle se pose sur le
  Bavarois, l'application refuse, et le bouton de sortie affiche « Passer à undefined parts »
  sans jamais débloquer. Un supplément de 120 € devient invendable.
- Variante : elle va toujours sur le **premier** gâteau admissible. Dans un essai, la sortie
  proposée a fait passer un gâteau de 15 à 20 parts, soit 22,50 € facturés en trop.
- Et le bon ne dit pas quel gâteau la reçoit quand deux gâteaux ont le même nombre de parts.

**A6. Number Cake « Autre dessin ».** *(contrôle des produits)*
- Un cœur de 15 parts s'imprime « CHIFFRES OU LETTRES : C Œ U R ». L'atelier peut faire quatre
  lettres au lieu d'un cœur.
- Si on rouvre la commande, l'application exige 60 parts : 300 € au lieu de 75 €.

**A7. Pièces montées : « ÉTAGE 1 / ÉTAGE 2 ».** *(pâtissier)*
- Les clientes disent « en bas » et « en haut ». Le bon ne dit pas lequel est le bas. Sur
  60 parts, une mauvaise lecture inverse vanille et chocolat. Trois commandes.

**A8. « Mini pizza / quiche » sans précision.** *(atelier)*
- La cliente voulait 25 pizzas ; l'atelier aurait fait moitié quiches. Deux commandes, dont une
  de 40 pièces. Même défaut pour briwate / cigare, éclair / mille-feuille, saumon / poulet :
  la variante n'est demandée nulle part, elle passe en texte libre si le vendeur y pense.

### B. Importants — de l'argent, du temps, ou un appel au magasin

**B1. Le message WhatsApp de confirmation.** ✔ *(vendeur, contrôle des produits)*
- « 1500 × Corne de gazelle » pour 1,5 kg, « 20 × Bavarois » pour un Matadi de 20 parts,
  « 25 × Pâte à sucre », et le goût disparaît (« Bavarois 6P » au lieu de « Bavarois fraise »).
  C'est le message que le client reçoit.

**B2. Un acompte par virement pas encore reçu s'imprime « ACOMPTE X € ».** *(vendeur, atelier)*
- Six commandes. Sur les bons internes, rien ne distingue un acompte encaissé d'un virement
  promis.

**B3. Aucune place pour un acompte promis.** *(vendeur)*
- Onze commandes enregistrées à 0 € avec la promesse en remarque. Sur une commande modifiée,
  les 28 € à rajouter ne sont ni affichés ni tracés.

**B4. Une heure de retrait déjà passée est acceptée.** *(vendeur, contrôle des produits)*
- Commande prise à 10h15 pour 6h00 le même jour : acceptée, sans message. Aucune règle ne le
  prévoit : c'est une question pour vous.

**B5. La recherche ne trouve pas les mots courants.** *(vendeur, contrôle des produits)*
- Zéro résultat pour « pain au chocolat », « couque au chocolat », « coeur » (le produit s'écrit
  « Cœurs »), « pastilla », « mariage », « gâteau chiffre », « cake chocolat ».
- Le produit s'appelle « Pain chocolat » au tarif, et « Couque au chocolat » dans la liste des
  prévisions. Deux noms pour le même produit selon l'écran.

**B6. Le minimum de 10 se contourne.** *(vendeur)*
- La carte du comptoir « Mini-Burger » accepte 9 pièces, à côté du « Mini burger » sur commande,
  au même prix. Mêmes doublons pour la quiche 6 personnes et Bastella / Bestella.

**B7. « Passer à 6 » ou « Passer à 8 » mène à un second refus.** ✔
*(vendeur, contrôle des produits)*
- Sur un Bavarois de 7 parts, le bouton de sortie donne un second message rouge avant d'aboutir.
  Deux gestes pour une correction annoncée en un seul.

**B8. Bûchettes et petits cœurs : une ligne et un goût par pièce.** *(vendeur)*
- Dix bûchettes font dix lignes et vingt gestes. Tout le rayon de fin d'année est classé
  « gâteau », y compris les pièces individuelles.

**B9. Aucune alerte sur une quantité énorme.** *(contrôle des produits)*
- 250 couques pour le lendemain, ou 9 999 croissants : acceptés sans rien dire. L'avertissement
  « demander au responsable » ne sort que si le vendeur coche la case. Aucun seuil n'est défini.

**B10. Les consignes de production sont en bas du bon.** *(atelier, pâtissier)*
- « 6h PILE », « boîtes fermées », « par 6 », « sur les plateaux » : dans les remarques, mêlées
  au paiement. Elles devraient être sous la ligne du produit.

**B11. Des informations enregistrées qui ne s'impriment pas.** *(pâtissier)*
- L'accord du manager pour une Crème fraîche au chocolat (la règle prévoit nom et heure sur la
  ligne).
- « Pas d'écriture » : la case cochée ne s'imprime pas, sur 11 bons. Le pâtissier ne sait pas si
  l'écriture a été oubliée.
- L'heure de prise de commande : une commande prise à 5h45 pour 6h ressemble à une erreur de
  date.

**B12. Le bon relu à l'étape Paiement range mal deux familles.** *(contrôle des produits)*
- Viennoiserie et pains tombent dans « Autres », avec les boissons.
- L'Oriental (msemen, harcha, produits au kilo) tombe dans « Gâteaux et pâtisserie », alors que
  vous l'avez rangé en Salé sur l'accueil.

**B13. Un gâteau perdu dans un bon de boulangerie.** *(pâtissier)*
- Un Fraisier 6P en dernière ligne, après six lignes de pains : il risque d'être rangé avec le
  pain du samedi et de ne pas être monté le vendredi.

### C. Gênants ou à trancher

- **« Cake nature » suivi de « GOÛT : CHOCOLAT »** : le nom contredit le goût.
- **Une écriture de 90 caractères** : la consigne « à recopier tel quel » suit le texte sans
  séparation ; rien ne marque où finit ce qui va sur le gâteau.
- **Les minis sucrés sans parfum** : 45 mini tartelettes, 30 mini bavarois arrivent sans goût.
- **Un gâteau du comptoir touché directement** (« Bavarois 6P » par la recherche) : ni goût ni
  forme demandés, l'atelier reçoit « 1 × Bavarois 6P ».
- **Même nom, deux prix selon le chemin** : un Entremet de 8 parts fait 55,20 € sur commande et
  48,00 € au comptoir ; une recette d'entremet « Forêt noire » en 6 parts fait 41,40 €, la tuile
  « Forêt noire » 31,00 €.
- **Au-dessus de 8 parts**, Bavarois framboise, mangue et passion s'appellent « Bavarois » avec
  le goût à part, alors que Fraisier, Matadi et les autres gardent leur nom.
- **« Autre demande »** exige un prix puis le code du manager, et bloque toute la commande s'il
  est absent.
- **La précision d'une ligne est coupée à 200 caractères** sans prévenir.
- **La part commandée n'arrive pas seule dans les prévisions** : le manager la recopie à la main.
  Une commande de 40 pièces peut être oubliée.
- **Le prix sur les bons internes** : il encombre le pâtissier et l'atelier.

---

## Votre idée du bon atelier sans la pâtisserie

Vous aviez demandé de ne plus imprimer le bon atelier pour la pâtisserie. La simulation vous
donne raison, avec des conditions.

- **Pâtisserie seule (31 bons sur 55)** : oui, sans réserve. Ces bons coûtent 5 à 10 secondes
  chacun à l'atelier, pour rien.
- **Commandes mixtes** : oui, à quatre conditions.
  1. **Décider qui produit les minis sucrés** (mini tartelette, mini bavarois, mini éclair).
     Ils sont classés « gâteau » : avec un filtre simple, ils disparaîtraient du bon de
     l'atelier. C'est le risque principal.
  2. Garder les remarques générales et toute allergie sur son exemplaire.
  3. Ajouter une ligne de rappel : « + 1 gâteau au poste pâtisserie ».
  4. Ne pas réimprimer son bon quand seule la pâtisserie change.

Autre constat : aujourd'hui les exemplaires BUREAU, MAGASIN et ATELIER sont **identiques**,
seul le titre change. Le pâtissier lit donc un bon de caisse. Un vrai bon de production serait
sans prix, avec la pâtisserie en premier.

---

## Ce que les lecteurs changeraient sur le bon, dans l'ordre

1. Une ligne **ALLERGIE** en tête, en gros.
2. **« À PRODUIRE LE … »** sous la date de retrait.
3. Sur un bon modifié, **la liste de ce qui change**.
4. **« BAS / HAUT »** au lieu de « ÉTAGE 1 / ÉTAGE 2 ».
5. Le **nombre de sandwichs** sous le pain surprise.
6. Les **consignes de production sous la ligne**, pas dans les remarques.
7. L'**écriture entre guillemets et encadrée**, la consigne à part ; **« ÉCRITURE : aucune »**
   quand il n'y en a pas.
8. L'**accord du manager** et l'**heure de prise** imprimés.
9. « **VIREMENT NON REÇU** » à côté d'un acompte promis.
10. Un **bon de production sans prix**.

---

## Les gestes du vendeur

- Entre 14 et 87 gestes par commande ; la moitié des commandes en demandent 25 ou moins.
- La plus longue est la commande d'entreprise de 15 lignes (87 gestes).
- Le code du manager n'a servi qu'une fois (Crème fraîche au chocolat).
- La seule commande contournée contenait une tarte citron meringuée et un plateau de fruits,
  absents du tarif : le vendeur s'est replié sur deux tartes et une remarque.

---

## Questions pour vous

Ces points ne se corrigent pas sans votre décision.

1. **Qui produit les minis sucrés**, le pâtissier ou l'atelier ?
2. **Retrait le jour même à une heure déjà passée** : refuser, ou avertir ?
3. **À partir de quelle quantité** faut-il un avertissement « demander au responsable » ?
4. **« Pain chocolat » ou « Couque au chocolat »** : quel nom doit s'afficher, et le même partout ?
5. **Mini-Burger du comptoir à moins de 10 pièces** : autorisé, ou à bloquer comme le sur commande ?
6. **Entremet 8 parts** : 48,00 € (comptoir) ou 55,20 € (sur commande) ?
7. **Bûchettes et petits cœurs** : à la pièce avec une quantité, ou un goût par pièce comme
   aujourd'hui ?
8. **Lettres d'un Number Cake** : chaque lettre compte-t-elle pour 15 parts (« LINA » = 60 parts) ?
9. **Le pain surprise à 20 €** : sandwichs compris, ou en plus ?
10. **Un acompte par virement promis** : faut-il l'enregistrer à part de l'acompte reçu ?

---

## Limites de la simulation

- **Pas de vraie tablette ni de vrai doigt.** Le vendeur a appelé les fonctions de l'application
  dans l'ordre des touchers ; l'aspect, la taille des boutons et la vitesse réelle ne sont pas
  mesurés. Les nombres de gestes sont des estimations.
- **Pas de vraie imprimante.** Les bons sont le texte exact tracé par l'application, mais la
  taille des caractères, le gras, les cadres et les retours à la ligne sur le papier de 72 mm
  ne sont pas jugés.
- **Pas de serveur ni de base réels.** L'enregistrement est reconstitué d'après le code ; la
  synchronisation hors ligne n'a pas été jouée.
- **Les listes du manager** (goûts, recettes, décorations, garnitures) sont en base : les agents
  ont supposé Vanille, Chocolat, Fraise, Framboise, et Oreo, Kinder, Speculoos en décorations.
- **Les temps de lecture** sont estimés, pas chronométrés.
- **Les agents sont des modèles**, pas vos employés : ils lisent tout, ne sont ni fatigués ni
  pressés. Un vrai service fera sortir d'autres problèmes. À l'inverse, certains appels au
  magasin qu'ils jugent nécessaires se régleraient d'un mot à voix haute.
- J'ai revérifié dans le code les points marqués ✔. Les autres reposent sur l'essai de l'agent
  qui les a trouvés ; les scripts sont gardés et rejouables.

---

## Les pièces

Dans ce dossier :

- `rapport-vendeur.md` — les 50 demandes, résultat, total, gestes, et 19 points gênants.
- `journal-vendeur.md` — le détail de chaque commande, toucher par toucher.
- `rapport-patissier.md` — les 42 bons lus, verdict par bon, 20 corrections proposées.
- `rapport-atelier.md` — les 24 commandes, et l'avis détaillé sur le bon atelier.
- `clients.json` — les 50 demandes des clients, mot pour mot.

Les 220 bons imprimés et les scripts des essais sont dans le dossier temporaire de la session ;
dites-moi si vous voulez que je les range aussi ici.
