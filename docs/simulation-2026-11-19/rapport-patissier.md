# Rapport du pâtissier — les bons me permettent-ils de produire sans rappeler le magasin ?

Méthode : j'ai d'abord lu les 55 bons MAGASIN sans rien d'autre et écrit mes fiches de production
(`patissier\fiches.md`). Ensuite seulement j'ai ouvert `clients.json` (ce que le client a dit),
`commandes.json` (ce que la tablette a enregistré) et `vendeur\journal.md`.

**Réponse courte.** Sur 42 bons contenant de la pâtisserie ou de la viennoiserie : 31 se produisent sans
appel (dont 7 où je peux me tromper si je lis vite), 11 m'obligent à rappeler le magasin. **Aucun gâteau
n'aurait été faux à coup sûr.** Les goûts, les parts, les formes et les écritures arrivent justes. Ce qui
n'arrive pas, ou mal : l'allergie, le jour de production, le sens des étages, ce qui a changé sur un bon
modifié, et tout ce que la tablette sait mais n'imprime pas.

Les exemplaires MAGASIN, BUREAU et ATELIER sont **identiques à la ligne de titre près** (vérifié sur les
55). L'exemplaire ATELIER n'est donc pas un bon de production : c'est le bon de caisse avec un autre titre.

---

## 1. Tableau des commandes lues

Verdict : **Juste** = je produis ce que le client voulait, sans appel · **Juste, risque** = je produis
juste si je lis tout, mais le bon me tend un piège · **Appel** = je ne peux pas produire sans rappeler.
« Produit faux » : aucun (voir la note sous le tableau).

| Id | Gâteaux / pièces | Verdict | Lecture |
|---|---|---|---|
| C01 | Fraisier 8P rond, écriture | Juste | 8 s |
| C02 | 2 Tarte riz 6P, 1 Tarte fromage 6P | Juste | 6 s |
| C04 | Matadi chocolat 6P rond | Juste | 5 s |
| C05 | Fraisier 10 parts carré, écriture | Juste | 12 s |
| C06 | Forêt noire 15 parts carré, écriture | Juste | 12 s |
| C07 | Bavarois mangue 8P rond | Juste | 5 s |
| C08 | Bavarois framboise 15 parts carré, écriture | Juste | 15 s |
| C09 | Number Cake « 25 », 30 parts, vanille, Oreo | Juste | 20 s |
| C10 | Number Cake « 18 », 30 parts, framboise, Speculoos | Juste, risque (veille = mardi fermé) | 20 s |
| C11 | Layer Cake 25 parts fraise, écriture | Juste | 12 s |
| C12 (+ modifiée) | Pièce montée 2 étages, 50 → 60 parts, écriture | **Appel** (sens des étages) | 30 s + 40 s pour comparer les deux bons |
| C13 | Pièce montée 2 étages 45 parts, Kinder, fleurs, photo | **Appel** (photo, fleurs, 2 ou 3 étages) | 60 s |
| C14 | Entremet 8P Noisette chocolat, 2 Tartelette citron | Juste | 8 s |
| C15 | Crème fraîche 8P vanille rond, écriture, fruits ? | **Appel** (fruits oui ou non) | 20 s |
| C16 | Crème fraîche 15 parts chocolat carré, écriture | Juste, risque (accord du manager invisible) | 15 s |
| C17 | Cake nature / chocolat 20 parts carré | **Appel** (nature ou chocolat ; allergie) | 30 s |
| C18 | Bûche 6P pistache, Bûche 8P matadi, 10 bûchettes | Juste | 35 s (20 lignes à compter) |
| C19 | Cœur 7P framboise, écriture, 6 Petit Cœurs passion | Juste | 25 s |
| C20 | 40 mini éclairs/mille-feuilles, 15 mini tartelettes, 20 mini bavarois | Juste | 25 s |
| C26 | 40 Croissant, 40 Pain chocolat, 20 Couque suisse | Juste | 12 s |
| C30 | Bavarois passion 15 parts carré | Juste | 10 s |
| C31 | Croûte Fraises 8P | Juste | 5 s |
| C32 | Mousse chocolat 6P rond, photo imprimée, écriture | **Appel** (photo à récupérer, une ou deux ?) | 45 s |
| C33 | Layer Cake licorne 25 parts, pâte à sucre, écriture socle | **Appel** (prix et faisabilité à confirmer) | 60 s |
| C34 | Bavarois framboise 6P rond, écriture longue avec fautes | Juste, risque (où finit le texte) | 30 s |
| C35 | 2 Bavarois fraise 8P (rond + carré), 2 écritures | Juste | 20 s |
| C36 | Tarte pommes 6P, Tarte Moelleux 6P | Juste | 15 s |
| C37 | 8 Sablé breton framboise, Bavarois 10 parts pistache sinon mangue | Juste | 20 s |
| C38 | Croûte framboises 6P, Trompe l'oeil XXL 4P, Bavarois choc. lait praliné 4P | **Appel** (remarque mal comprise) | 25 s |
| C39 | Pièce montée 60 parts, 45 mini tartelettes, 45 mini éclairs | **Appel** (étages, parfum des minis) | 1 min 45 |
| C40 (+ modifiée) | Matadi 20 → 25 parts, Fleur caramel chocolat 15 parts, 2 Croûte Fruits 8P, minis | **Appel** (parfum des 30 mini bavarois) | 2 min + 1 min pour comparer |
| C41 | 6 Croissant, 4 Pain chocolat | Juste | 6 s |
| C42 | 30 Croissant, 20 Pain chocolat, 10 Couque aux raisins | Juste | 10 s |
| C43 (+ modifiée) | 40 → 20 Croissant, 40 → 30 Pain chocolat, 20 raisins, 20 torsades | Juste, risque (veille fermée, ancien bon) | 10 s + 20 s |
| C44 | 100 Mini Croissant, 100 Mini Pain chocolat, 50 Mini Suisse | **Appel** (capacité du fournil) | 25 s |
| C45 | 32 Croissant, 16 Pain chocolat, 8 Couque au beurre ? | **Appel** (« 8 ? à confirmer ») | 15 s |
| C46 | 17 Croissant | Juste | 12 s |
| C47 | 12 Croissant, pour le jour même 6h | Juste, risque (pas d'heure de prise) | 12 s |
| C48 | 20 Croissant, 10 Croissant aux amandes | Juste | 8 s |
| C48-b | idem, vendredi 27/11 | Juste | 8 s |
| C49 | 25 Croissant, 25 Pain chocolat, 10 Couque suisse ronde, lundi 19h45 | Juste, risque (fournée du soir) | 15 s |
| C50 (+ modifiée) | 12 → 18 Croissant, viennoiserie, **Fraisier 6P** en dernière ligne | Juste, risque (fraisier noyé) | 25 s |

**Chiffres : 42 bons — 24 justes · 7 justes avec risque · 11 appels · 0 faux certain.**

Non lus en fiche (ni pâtisserie ni viennoiserie) : C03, C21, C22, C23, C24, C25, C27, C28, C29.

Sur les 11 appels :
- **6 sont normaux** — le vendeur a laissé la question ouverte exprès, c'est bien que je sois consulté :
  C13, C15, C32, C33, C44, C45.
- **5 viennent du bon lui-même** — l'information existait ou était facile à demander : C12 (sens des
  étages), C17 (libellé contradictoire, allergie), C38 (remarque à double sens), C39 et C40 (minis sans
  parfum).

Note sur « produit faux » : je n'en compte aucun parce qu'à chaque doute j'ai écrit « j'appelle ». Mais
quatre bons donnent un gâteau **faux ou dangereux si je n'appelle pas ou si je lis vite** : C17
(allergie), C12 et C39 (étages inversés), C10 (planifié un mardi). Ils sont en « Grave » ci-dessous.

---

## 2. Les problèmes, classés

### GRAVE — peut donner un gâteau faux, raté, oublié, ou dangereux

**G1. L'allergie est tout en bas, dans la phrase du paiement — C17**
- Bon : `REMARQUES` / « ALLERGIE : un enfant allergique aux fruits à coque — vérifier avec le pâtissier,
  rien promis. Paie tout demain au retrait. »
- La cliente : « Il n'y a pas de fruits à coque dedans ? Il y a un enfant allergique. » — cake pour une
  classe, à sortir le lendemain 7h00.
- Ce que j'aurais fait : je l'ai vue parce que je lisais lentement. Un jour de production, je m'arrête
  après la ligne du gâteau (« Cake nature … FORME : CARRÉ ») et je fais mon cake sur le plan de travail où
  je viens de passer les noisettes. Le vendeur n'avait **aucun autre endroit** où la noter (son journal :
  « Allergie aux fruits à coque : aucun endroit prévu »).

**G2. Une allergie dite au téléphone n'est arrivée nulle part — C40-modifiée (salé, mais même bon)**
- La cliente, le lendemain : « retirez les mini cigares, il y a des allergiques aux fruits de mer ».
- Bon modifié : la ligne des cigares a disparu, **sans un mot sur l'allergie**. Il reste « 40 ×
  Mini-sandwichs garnis — 20 Poulet curry, 20 Crabe/surimi ». La cliente n'a pas demandé de retirer le
  crabe, donc la commande est conforme à sa parole ; mais l'atelier ne sait pas qu'il y a des allergiques
  dans ce groupe et personne ne lui a reposé la question. Ce n'est pas ma partie : je le signale parce que
  je l'ai sous les yeux.

**G3. « ÉTAGE 1 / ÉTAGE 2 » : bas ou haut ? — C12, C13, C39**
- Bon C12 : « ÉTAGE 1 : VANILLE » / « ÉTAGE 2 : CHOCOLAT ». Bon C39 : « ÉTAGE 1 : VANILLE-FRAMBOISE » /
  « ÉTAGE 2 : CHOCOLAT ».
- Les clientes : « Vanille en bas, chocolat en haut » (C12), « Vanille-framboise en bas, chocolat en
  haut » (C39), « Vanille en bas et chocolat en haut » (C13). Toutes ont dit **bas / haut**, la tablette a
  traduit en **1 / 2**.
- Ce que j'aurais fait : sur 60 parts, l'étage du bas fait à peu près 40 parts et celui du haut 20. Si je
  lis « étage 1 » comme « celui du dessus », je fais 40 parts de chocolat et 20 de vanille : l'inverse.
  J'ai deviné juste (1 = bas), mais c'était une devinette.

**G4. Le jour où je dois produire n'est pas sur le bon — et la tablette le connaît — C10, C43, C49**
- Bon C10 : « POUR LE / MERCREDI 25/11 / à 17h00 ». Rien d'autre.
- `commandes.json` contient pour chaque commande une date de production déjà calculée, et juste : C10 →
  lundi 23/11, C43 → lundi 23/11 (elle saute le mardi fermé). **Elle n'est pas imprimée.**
- Ce que j'aurais fait : je classe mes bons par « veille du retrait ». C10 et C43 tombent mardi 24, jour
  où le fournil est vide. Je m'en aperçois mercredi matin : Number Cake de 30 parts à monter dans la
  journée, 90 viennoiseries sans pâte tourée.

**G5. Le bon « MODIFIÉE » ne dit pas ce qui a changé — C12, C40, C43, C50**
- Bon : « MODIFIÉE le 20/11 à 11h00 » / « Jetez l'ancien bon ». Puis le bon entier, comme neuf.
- Ce qui a changé en vrai : C12 parts 50 → 60 **et heure 14h → 10h** ; C40 Matadi 20 → 25 parts, heure
  11h30 → 11h00, ligne cigares supprimée ; C43 croissants 40 → 20, pains au chocolat 40 → 30 ; C50
  croissants 12 → 18.
- La tablette **a** ce détail (historique de C12 : « heure : 14h00 → 10h00 … »). Il n'est pas imprimé.
- Ce que j'aurais fait : j'ai trouvé les différences en posant les deux bons côte à côte, ligne par ligne
  (1 minute pour C40). Au fournil, si l'ancien bon est déjà épinglé, je garde en tête « samedi 14h » et la
  pièce montée de mariage n'est pas finie à 10h.

**G6. Texte à recopier : on ne voit pas où il finit — C34**
- Bon : « ÉCRITURE : Joyeu aniversaire a notre » / « maman cheri Khadija, 60 ans de » / « boneur, on
  t'aime fort fort fort » / « Texte à recopier TEL QUEL (fautes voulues » / « par le client), écrire petit ».
- La cliente : « Vous écrivez exactement ça… c'est fait exprès. »
- Ce que j'aurais fait : juste, mais sans filet. Cinq lignes qui se suivent, sans guillemets ni trait ;
  je ne sais pas si les retours à la ligne sont ceux du client. 90 caractères sur un rond de 6 parts,
  facturés « Écriture simple ».

**G7. « Cake nature » avec « GOÛT : CHOCOLAT » — C17**
- Bon : « Cake nature    58,00 € » / « 1 gâteau — 20 PARTS » / « GOÛT : CHOCOLAT ».
- La cliente : « un cake au chocolat pour 20 ».
- Ce que j'aurais fait : j'appelle. Si je ne peux pas (c'est pour 7h demain), une chance sur deux de faire
  un cake nature. Le nom du produit dit le contraire du goût.

**G8. Un gâteau à la crème caché en bas d'un bon de pain — C50**
- Bon : 6 lignes de croissants et de pains, puis en dernier « 1 × Fraisier 6P    31,00 € ».
- Ce que j'aurais fait : ce bon part dans la pile « boulangerie du samedi matin ». Le fraisier se monte le
  vendredi. Si personne ne me le montre, il n'existe pas samedi 8h30.

### GÊNANT — appel nécessaire, temps perdu, doute

**N1. L'accord du manager n'est pas imprimé — C16**
- Bon : « Crème fraîche » / « GOÛT : CHOCOLAT ». Rien d'autre.
- Enregistré dans la tablette : goût accepté par « Karim (manager) ». Journal du vendeur : « enregistré,
  imprimé nulle part ».
- Moi : la crème fraîche est vanille chez nous. Chocolat sans signature = soit une exception, soit une
  erreur de touche. J'appelle pour une réponse que la tablette avait déjà.

**N2. Une remarque qui se lit à l'envers — C38**
- Bon : « Parfum du trompe-l'œil XXL demandé par la cliente. »
- La cliente : « Il est à quoi, le trompe-l'œil ? » — elle **demande à savoir** le parfum.
- Moi : j'ai compris « elle a demandé un parfum précis, et on a oublié de l'écrire ». J'aurais appelé le
  magasin pour qu'il me le donne, alors que c'est le magasin qui attend ma réponse. Commande du jour même,
  17h.

**N3. « Pas d'écriture » n'est pas imprimé — C04, C07, C09, C10, C13, C17, C30, C37, C38, C40, C50**
- La tablette enregistre « sans écriture » (le vendeur a coché). Sur le bon, il n'y a simplement pas de
  ligne ÉCRITURE.
- Clientes : « Sans rien dessus » (C17), « Sur le fraisier, rien d'écrit » (C50).
- Moi : une ligne absente ne me dit pas si on n'en veut pas ou si on a oublié de demander. Sur un cake
  d'école ça va ; sur la pièce montée de fiançailles C13, je me pose la question.

**N4. Des minis sans parfum — C39 (45 mini tartelettes, 45 mini éclairs), C40 (30 mini bavarois)**
- Bon C39 : « 45 ×    Mini tartelette    85,50 € » et rien dessous ; « 45 ×    Mini éclair / » /
  « mille-feuille » / « éclairs ».
- Les clientes n'ont rien précisé, et on ne leur a pas demandé. Sur C20, le vendeur l'a fait
  (« assortiment, un peu de tout », « aux fraises », « 10 chocolat, 10 moka ») et je produis sans appel.
- Moi : 90 pièces pour un baptême, je ne choisis pas seul. Un mot suffit : « au choix du pâtissier ».

**N5. Photo à imprimer et « MODÈLE » : une photo ou deux ? — C32**
- Bon : « PHOTO À IMPRIMER SUR CE GÂTEAU » / « Photo à imprimer reçue sur WhatsApp (un peu floue :
  vérifier la qualité) », puis plus bas « MODÈLE » / « Photo d'exemple sur WhatsApp — à réclamer au manager ».
- La cliente : une seule photo, celle à imprimer (la deuxième, « bébé », a été abandonnée).
- Moi : j'ai cru à un modèle de gâteau à copier **en plus** de la photo. Le bloc « MODÈLE » sort dès qu'une
  photo est sur WhatsApp, même quand ce n'est pas un modèle.

**N6. Pas d'heure de prise — C38, C47**
- Bon : « Prise le 19/11/2026 · Nadia ». La tablette a l'heure (C47 : pris à 5h45 pour 6h00).
- Moi : pour un retrait le jour même, c'est la seule chose qui me dit s'il reste 15 minutes ou 8 heures.

**N7. Contradiction entre la ligne et la remarque — C13**
- Ligne : « Pièce montée 2 étages ». Remarque : « Modèle : photo d'une pièce montée 3 étages ».
- Le client : voulait « la même » que la photo, 45 personnes, a accepté 2 étages. Le bon ne dit pas « le
  client sait que ce sera 2 étages au lieu de 3 ».
- Autre gêne : « À CONFIRMER — PRIX ET FAISABILITÉ », et 126 € d'acompte déjà notés.

**N8. Des questions imprimées telles quelles — C15, C45, C44**
- C15 : « Avec des fruits dessus si possible (supplément à voir) ». C45 : « demi-plateau (8 ? à
  confirmer) ». C44 : « Capacité du fournil à confirmer AVANT de dire oui ».
- Le vendeur a bien fait de noter. Mais le bon ne dit ni **qui** doit répondre, ni **à qui**, ni **avant
  quand**. C15 se retire dans deux jours à 9h30 ; C45 dans deux jours à 8h00. Pour C45 le client était au
  comptoir : « 8 » pouvait se confirmer sur place.

**N9. Consignes d'heure dans les remarques de caisse — C26, C38, C49**
- C26 : « Paie cash au retrait. À 6h PILE, prêt — prévenir le fournil. » C49 : « Dépose 50 € d'acompte
  demain. Emballer en boîtes FERMÉES (c'est pour mardi matin). » C38 : « POUR AUJOURD'HUI 17h — … ».
- Moi : ce sont des consignes de fournil, rangées avec les histoires d'acompte. Pour C49, « pour mardi
  matin » veut dire fournée de l'après-midi : c'est écrit entre parenthèses, à la fin.

**N10. Mes lignes mélangées au salé et aux boissons — C39, C40**
- C39 : pièce montée en ligne 1, mini tartelettes en ligne 9, mini éclairs en ligne 10, entre « Grand pain
  surprise » et « Corne de gazelle ». C40 : gâteaux en haut, mini bavarois en ligne 11, mini croissants en
  ligne 13.
- Moi : presque 2 minutes par bon, et je recopie mes lignes à la main sur un papier pour ne rien oublier.

**N11. Number Cake : libellé de case et « 1 gâteau » — C09, C10**
- Bon : « 1 gâteau — 30 PARTS » / « CHIFFRES OU LETTRES : 2  5 ».
- Moi : compris, mais « 1 gâteau » est faux (deux chiffres = deux pièces de 15 parts) et « CHIFFRES OU
  LETTRES » est le titre de la case, pas une consigne.

**N12. Information du client jamais arrivée (sans gâteau faux)**
- C35 : « Fraise hein, pas fraisier, Inès n'aime pas la génoise. » Le bon dit « Bavarois fraise 8P » :
  bon produit, mais « pas de génoise » n'est nulle part.
- C17 : « Si 7h c'est trop tôt, 7h30 au plus tard. » Le bon dit 7h00 sec. J'aurais aimé savoir que j'ai
  une demi-heure.
- C12, C13, C39 : mariage, fiançailles, baptême. C39 le dit en remarque (« Baptême. »), les deux autres
  pas du tout. C'est l'occasion qui me dit le style du décor.
- C49 : la cliente a demandé « Elles seront encore bonnes mardi ? » — la question est restée sans réponse,
  seul « pour mardi matin » arrive.

### CONFORT — ça marche, mais ça ralentit

- **K1. Les prix partout.** Un montant sur chaque ligne, « 4,50 € par personne », « Supplément Écriture
  simple 2,00 € », TOTAL / ACOMPTE / RESTANT DÛ, et des remarques qui ne parlent que d'argent (C07 : « Paie
  par Payconiq au retrait. » ; C08 : « Vient payer l'acompte samedi 21/11 (34,75 €). »). Sur un bon simple,
  la moitié des lignes ne me sert à rien.
- **K2. Produits identiques non regroupés.** C18 : 10 bûchettes sur 20 lignes ; C19 : 6 Petit Cœurs sur 12
  lignes ; C02 : deux « 1 × Tarte riz 6P » ; C40 : deux « 1 × Croûte Fruits 8P ». Je compte au doigt.
- **K3. Le supplément écriture entre deux gâteaux — C35.** « 2 × Supplément Écriture simple    4,00 € »
  est sous le gâteau d'Adam, avant celui d'Inès.
- **K4. Le goût répété.** « Fraisier 8P » / « GOÛT : FRAISIER » (C01, C50), « Matadi chocolat 6P » /
  « GOÛT : MATADI CHOCOLAT » (C04), « Mousse chocolat 6P » / « GOÛT : MOUSSE CHOCOLAT » (C32). Et pas
  constant : C35 « Bavarois fraise 8P » n'a pas de ligne GOÛT, C34 « Bavarois framboise 6P » en a une.
- **K5. Nom coupé par le prix.** C14 : « Entremet 8P Noisette    48,00 € » / « chocolat ». C11 :
  « Supplément Écriture    2,00 € » / « simple ». C39 : « Mini éclair /    67,50 € » / « mille-feuille ».
- **K6. Deux noms pour un produit.** C41 : ligne « Pain chocolat », remarque « couques au chocolat ».
- **K7. Date écrite de deux façons.** « SAMEDI 21 NOVEMBRE 2026 » ou « DIMANCHE 22/11 » ; le 12/12 est en
  long, le 18/12 en court (« VENDREDI 18/12 », sans année).
- **K8. Pluriels du tarif.** « 1 × Bûches 6P », « 1 × Cœurs 7P », « 1 × Petit Cœurs ». C'est le libellé du
  catalogue ; je comprends.
- **K9. Les plateaux.** C26, C42, C43 : 40, 30, 20 croissants, jamais des multiples de 16, et aucun
  équivalent en plateaux. Seul C45 l'a, parce que le vendeur l'a tapé (« 2 plateaux »).
- **K10. La pâte à sucre n'apparaît que comme un prix — C33** : « Pâte à sucre — 25 parts    150,00 € »,
  après le supplément écriture.
- **K11. Trois lignes d'adresse et de téléphone** de la boulangerie en tête d'un bon interne.
- **K12. « ZONE LIBRE — DESSIN, PRÉCISIONS »** n'apparaît que sur C33. Je l'aurais voulue sur C12, C13,
  C39 aussi.

---

## 3. Ce que je changerais sur le bon, par ordre d'importance

1. **Une ligne ALLERGIE, en haut, en gros, encadrée, juste sous la date.** Jamais dans les remarques. Et
   une case à la prise de commande pour que le vendeur ait où la mettre.
2. **Imprimer « À PRODUIRE LE … »** sous la date de retrait. La tablette l'a déjà calculé, mardi fermé
   compris. C'est la ligne que je lis en premier pour ranger mes bons.
3. **Sur un bon modifié, dire ce qui a changé**, en tête : « HEURE : 14h → 10h », « PARTS : 50 → 60 »,
   « RETIRÉ : 30 mini cigares ». La tablette le sait.
4. **Écrire « BAS » et « HAUT »** au lieu de « ÉTAGE 1 » et « ÉTAGE 2 » — avec les parts de chaque étage
   si on les connaît.
5. **Un vrai bon ATELIER** : sans prix, sans acompte, sans remarques de paiement, sans lignes
   « Supplément ». Mes produits d'abord (gâteaux, puis minis sucrés, puis viennoiserie), le salé et les
   boissons après ou pas du tout. Un gâteau à la crème ne doit jamais finir en dernière ligne d'un bon de
   pain.
6. **L'écriture entre guillemets, dans un cadre, seule.** La consigne (« tel quel, fautes voulues »,
   « écrire petit ») sur une ligne à part, avec un mot devant : « CONSIGNE : ». Et dire si les retours à la
   ligne sont voulus.
7. **Toujours dire quand il n'y a rien** : « ÉCRITURE : aucune », « DÉCO : aucune ». La tablette sait que
   le vendeur a coché « pas d'écriture ».
8. **Imprimer qui a autorisé une exception** : « GOÛT : CHOCOLAT — accord Karim (manager) ».
9. **Séparer les remarques en deux** : « POUR L'ATELIER » (6h pile, boîtes fermées, pour mardi matin,
   laisser sur les plateaux) et « CAISSE » (acompte, facture, Payconiq). Je ne lis que la première.
10. **Quand une question reste ouverte, l'imprimer comme une question** : « À DÉCIDER AVANT LE … — par … »
    (fruits sur la crème fraîche, capacité du fournil, demi-plateau). Aujourd'hui elle ressemble à une
    consigne.
11. **Pas de mini sans parfum** : le vendeur choisit un parfum ou « au choix du pâtissier ». Une ligne
    vide me fait décrocher le téléphone.
12. **Imprimer l'heure de prise**, et un bandeau « AUJOURD'HUI » ou « DEMAIN » quand c'est le cas.
13. **Regrouper les lignes pareilles** : « 5 × Bûchette — mousse au chocolat », « 5 × Bûchette —
    framboise ».
14. **Number Cake** : « CHIFFRES : 25 — 2 pièces de 15 parts ».
15. **Un gâteau dont le nom dit un goût et la ligne GOÛT un autre** (Cake nature / chocolat) : imprimer
    « Cake — CHOCOLAT ». Et ne pas répéter le goût quand il est déjà dans le nom.
16. **Photo** : « PHOTO À IMPRIMER (1) — sur WhatsApp, à demander à … » d'un côté, « MODÈLE À COPIER » de
    l'autre. Jamais les deux blocs pour une seule photo.
17. **L'occasion** (mariage, baptême, anniversaire d'enfant) en une ligne sous le gâteau.
18. **Les plateaux** pour croissants et couques au chocolat : « 40 = 2 plateaux + 8 ».
19. **La zone de dessin** sur toute pièce montée et tout gâteau avec modèle.
20. Une seule façon d'écrire la date, avec le jour en toutes lettres.

---

## 4. Ce qui est bien fait — à ne pas toucher

- **Le jour et l'heure en tête, seuls sur leurs lignes** (« POUR LE / SAMEDI 21 NOVEMBRE 2026 / à 11h00 »).
  C'est ce que je cherche d'abord et je le trouve tout de suite.
- **« 1 gâteau — 15 PARTS »** : le nombre de parts en majuscules, sous le nom. Jamais confondu avec un
  nombre de gâteaux.
- **GOÛT, FORME, ÉCRITURE en majuscules, un par ligne, sous le gâteau concerné.** Sur les 42 bons, aucun
  goût, aucune forme, aucun nombre de parts ne s'est perdu entre le client et moi.
- **Le goût sert de titre** quand c'est un bavarois par personne : la tablette enregistre « Bavarois, goût
  Forêt noire », le bon imprime « Forêt noire » (C06), « Fraisier » (C05), « Matadi chocolat » (C40). C'est
  comme ça que je parle.
- **La précision écrite juste sous la ligne** : C20 (« 20 éclairs (10 chocolat, 10 moka) + 20
  mille-feuilles »), C37 (« Pistache si le pâtissier le fait, SINON MANGUE »), C45 (« 2 plateaux »), C33
  (toute la licorne). Quand elle est là, je n'appelle pas.
- **L'écriture recopiée à la lettre**, fautes, accents et « & » compris : « Joyeu aniversaire… » (C34),
  « Élodie & Maxime » (C12), « 5 ans Ilyès » (C32). Les 16 écritures (15 bons) correspondent à la parole du client.
- **« Texte à recopier TEL QUEL (fautes voulues par le client) »** : sans cette phrase, j'aurais corrigé.
- **« DEMANDE INHABITUELLE / À CONFIRMER — PRIX ET FAISABILITÉ »** : je sais qu'il ne faut pas commencer.
- **« PHOTO À IMPRIMER SUR CE GÂTEAU »** en majuscules sous le gâteau.
- **« MODIFIÉE le … / Jetez l'ancien bon »** en tête : l'alerte est bonne, il lui manque le détail.
- **Les quantités au kilo** écrites « 1,500 kg » (C28, C39) : impossible de lire « 1 500 pièces ».
- **Deux commandes = deux bons** (C48 et C48-b), chacun avec sa date.
- **Le vendeur a noté les questions au lieu de promettre** (allergie « rien promis », fruits « supplément à
  voir », capacité du fournil). C'est le bon réflexe ; il lui manque juste la bonne case.

---

## 5. Limites de ma lecture

- **J'ai lu du texte, pas du papier de 72 mm.** Je ne vois ni la taille des caractères, ni le gras, ni les
  cadres, ni les traits de séparation. Le journal du vendeur dit que les remarques sortent « en petit, dans
  un cadre pointillé » : sur le vrai ticket, l'allergie de C17 est peut-être encore moins visible que ce que
  j'ai lu, ou un peu plus grâce au cadre — je ne peux pas le dire. Mes remarques « trop petit » sont donc
  absentes de ce rapport : je ne peux pas en juger.
- **Les retours à la ligne** que je cite (« Entremet 8P Noisette » / « chocolat ») sont ceux du fichier
  texte. S'ils sont identiques sur le papier, mes remarques K5 et G6 tiennent ; sinon, à revoir.
- **Mes temps de lecture sont des estimations**, pas des mesures : un lecteur qui prend son temps, au calme,
  sans farine sur les doigts. En production, compter le double, et plus de lecture en diagonale.
- **Je n'ai pas vu les photos** (C13, C32, C33) : je ne peux pas dire si le modèle était faisable.
- **Je connais les règles de la maison** (crème fraîche vanille, plateaux de 16, mardi fermé). Un
  remplaçant ne tiquerait pas sur C16 et ne penserait pas au mardi pour C10.
- **Verdicts « juste »** : jugés contre la parole du client dans `clients.json`. Là où le client n'a rien
  dit (décor de C11, C12, C39), j'ai compté « juste » un gâteau sobre ; un vrai client peut en attendre plus.
- **« 0 faux »** dépend de ce que j'appelle vraiment à chaque doute noté. Un pâtissier pressé qui n'appelle
  pas transforme C17, C12, C39 et C10 en gâteaux faux ou en retard.
- **Bons non fichés** : les 9 commandes sans pâtisserie ni viennoiserie n'ont pas de fiche. Je les ai lues
  (et j'ai comparé leurs trois exemplaires internes), sans les juger.
- La simulation a une seule vendeuse et une seule journée de prise (19/11) : je n'ai pas vu de bon pris
  par un vendeur qui écrit moins que Nadia dans les précisions. Avec moins de précisions, il y aurait
  plus d'appels.
