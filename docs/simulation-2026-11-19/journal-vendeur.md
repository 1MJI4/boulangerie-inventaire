# Journal du vendeur — 50 demandes jouées dans l’application de commande

Date de prise : **jeudi 19 novembre 2026** (tarif `tarif_2026-11`, affiches `sur-commande_2026-10-26`). Vendeuse : Nadia, tablette au comptoir.

Comment lire : chaque « Étape … » est un geste du vendeur, rejoué par les fonctions de l’écran (`src/components/commande/modele.ts`). Chaque ligne « ↳ APP » est une réponse EXÉCUTÉE du domaine (`controlerLigne`, `blocagesCommande`, `controlerCommande`) : code, message exact, boutons de sortie tels que l’écran les construit. « ↳ DOMAINE » : message que le domaine produirait pour une valeur que l’écran ne laisse pas toucher (case grisée, créneau absent). Les lignes en clair sont les paroles du client et ce que je fais de tête. Les gestes sont comptés approximativement : 1 par toucher, 2 par saisie au pavé ou au clavier.

Limites de la simulation : les listes réglées par le manager (goûts, recettes d’entremet, décorations, garnitures) sont en base et non lisibles ici ; j’ai supposé que Vanille, Chocolat, Fraise et Framboise sont des goûts proposés, et Oreo, Kinder, Speculoos des décorations. Tout autre goût est « tapé dans Autre… ». Aucun serveur n’a été appelé : l’enregistrement est reconstitué d’après `src/app/api/commandes/route.ts`.

## C01 — Fatima El Amrani (comptoir)

> **Le client dit :** Bonjour, je voudrais un fraisier pour 8 personnes pour samedi. Avec écrit dessus « Joyeux anniversaire Yasmine ». C'est possible ?
> **Retrait souhaité :** samedi vers 11h · **Paiement :** Je vous laisse 20 € maintenant, le reste samedi.
> **Rebondissements :** Si on lui demande la forme : « Rond, comme d'habitude. » / Yasmine s'écrit avec un Y et un seul S.

**Résultat : validée** — commande n° 2026-0901 · **16 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Fatima El Amrani »
Étape 1 · Téléphone (pavé) : 0486 12 34 51
Étape 1 · Jour de retrait : samedi 21 novembre
Étape 1 · Heure de retrait : 11:00
« Continuer : les produits »
Étape 2 · Recherche « fraisier » → tuiles : Fraisier — 3 produit(s) : Fraisier 4P (20,00 €) · Fraisier 6P (31,00 €) · Fraisier 8P (36,00 €)
Étape 2 · Toucher la tuile « Fraisier » → gâteau au bon, goût « Fraisier » déjà posé, boutons de taille ouverts
Étape 2 · Bouton de taille « 8 » (affiché avec 36,00 €, prix du comptoir) → ligne : Fraisier 8P
   ↳ APP : ERR_FORME_MANQUANTE [ligne 1 : Fraisier 8P] — « Choisissez la forme de « Fraisier 8P » : carré ou rond. » — sortie(s) : [(champ vide : « À remplir : forme (carré ou rond) »)]
Étape 2 · Forme : Rond
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Fraisier 8P] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Bloc « Sur ce gâteau » : écriture « Joyeux anniversaire Yasmine »
« Continuer : le paiement »
Étape 3 · Acompte au pavé : 20,00 €
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 38,00 €, acompte 20,00 €, reste 18,00 €.
```

### Total annoncé contre l’attente du client

- Total : **38,00 €** annoncés, **38,00 €** attendus → écart **0,00 €**.
- Commande 2026-0901 : acompte enregistré 20,00 € (espèces), reste dû 18,00 €.
- Attente rédigée : Fraisier 8P au prix du comptoir 36,00 € + Écriture 2,00 € = 38,00 €. Retrait samedi 21/11 à 11h00. Acompte 20,00 € (plus de 50 %, pas d'avertissement), reste 18,00 €.

### Bons sortis

`bons/C01-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- rien (tout ce que j’ai saisi se retrouve sur au moins un exemplaire).

### Remarques du vendeur

- Cas simple, rien à redire : tuile, taille (le prix du comptoir est écrit sur le bouton), forme, écriture.
- Le bon imprime « Fraisier 8P » puis « GOÛT : FRAISIER » : redite inutile sous un gâteau dont le nom dit déjà le goût.

---

## C02 — Jean-Pierre Vandenbroeck (telephone)

> **Le client dit :** Allô, c'est pour commander deux tartes au riz pour dimanche matin. Les grandes hein, pas les morceaux.
> **Retrait souhaité :** dimanche matin, vers 9h · **Paiement :** Je paierai tout en venant, ça va ?
> **Rebondissements :** Ajoute après coup : « Et mettez-moi aussi une tarte au fromage, ma femme préfère. » / Si on insiste pour l'acompte : « Bon, je passerai déposer 20 € demain. »

**Résultat : validée** — commande n° 2026-0902 · **18 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Jean-Pierre Vandenbroeck »
Étape 1 · Téléphone (pavé) : 0475 88 21 40
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : dimanche 22 novembre
Étape 1 · Heure de retrait : 09:00
« Continuer : les produits »
Étape 2 · Recherche « tarte riz » → 2 produit(s) : Tarte riz 6P (18,00 €) · Morceau tarte au riz (3,60 €)
« Les grandes, pas les morceaux » : la carte « Tarte riz 6P », pas « Morceau tarte au riz ». Deux tartes = deux touchers (une ligne par gâteau).
Étape 2 · Toucher carte « Tarte riz 6P » → 1 gâteau au bon (sa ligne)
Étape 2 · Toucher carte « Tarte riz 6P » → 1 gâteau au bon (sa ligne)
Client : « Et mettez-moi aussi une tarte au fromage. »
Étape 2 · Recherche « tarte fromage » → 1 produit(s) : Tarte fromage 6P (18,00 €)
Étape 2 · Toucher carte « Tarte fromage 6P » → 1 gâteau au bon (sa ligne)
« Continuer : le paiement »
Étape 3 · Remarques : « Paie tout au retrait. Passera peut-être déposer 20 € demain. »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (27,00 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 27,00 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 54,00 €, acompte 0,00 €, reste 54,00 €.
```

### Total annoncé contre l’attente du client

- Total : **54,00 €** annoncés, **54,00 €** attendus → écart **0,00 €**.
- Commande 2026-0902 : acompte enregistré 0,00 € (espèces), reste dû 54,00 €.
- Écart d’ACOMPTE : le client annonce 20,00 € à venir (plus tard, en espèces ou par carte) ; rien n’étant reçu, j’ai enregistré 0,00 € et noté la promesse en remarque (aucun champ « acompte promis »).
- Attente rédigée : 2 × Tarte riz 6P à 18,00 € = 36,00 €, puis + 1 Tarte fromage 6P 18,00 € = 54,00 €. Retrait dimanche 22/11 à 9h00. Acompte 0 € : simple avertissement (viser 27,00 €), la commande est acceptée.

### Bons sortis

`bons/C02-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- La recherche « tarte riz » ne montre pas la tuile « Tarte 6P » (une tuile ne s’affiche que si tous les mots cherchés sont dans SON nom) ; elle montre la carte « Tarte riz 6P » et le « Morceau tarte au riz », côte à côte. Bien lire avant de toucher.
- « Deux tartes au riz » = deux touchers, deux lignes « 1 × Tarte riz 6P » sur le bon (une ligne par gâteau). Lisible, mais l’atelier doit additionner.
- Client au téléphone qui paiera en venant : « Téléphone » a mis le paiement sur Virement d’office, j’ai dû le remettre sur Espèces.
- Il « passera peut-être déposer 20 € » : aucune case pour un acompte promis ; je l’ai écrit en remarque.

---

## C03 — Samira Benali (whatsapp)

> **Le client dit :** Salam, je voudrais des minis burgers pour 25 personnes et des petites pizzas aussi. C'est pour vendredi prochain en fin de journée. Vous me dites le prix svp ?
> **Retrait souhaité :** vendredi prochain (le 27) vers 18h · **Paiement :** Je passe demain payer la moitié.
> **Rebondissements :** Quand on lui demande combien de pièces : « Comptez 2 burgers par personne, donc 50, et 25 pizzas. » / « Les pizzas c'est bien les minis hein, pas les grandes à 3,50. »

**Résultat : validée** — commande n° 2026-0903 · **21 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Samira Benali »
Étape 1 · Téléphone (pavé) : 0488 40 17 62
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : vendredi 27 novembre
Étape 1 · Heure de retrait : 18:00
« Continuer : les produits »
Cliente : « pour 25 personnes » — l’écran ne prend que des pièces : je lui demande combien de pièces (50 burgers, 25 pizzas).
Étape 2 · Recherche « mini burger » → 2 produit(s) : Mini-Burger (3,50 €) · Mini burger (3,50 €, sur commande)
Étape 2 · Toucher carte « Mini burger » → 1 au bon, pavé de quantité ouvert
   ↳ APP : ERR_QUANTITE_MIN [ligne 1 : Mini burger] — « Minimum 10 pièces pour « Mini burger ». » — sortie(s) : [Passer à 10 pièces]
Étape 2 · Quantité au pavé : 50 — Mini burger
Étape 2 · Recherche « pizza » → 4 produit(s) : Pizza thon (3,50 €) · Pizza viande hachée (3,50 €) · Pizza poulet (3,50 €) · Mini pizza / quiche (2,80 €, sur commande)
Étape 2 · Toucher carte « Mini pizza / quiche » → 1 au bon, pavé de quantité ouvert
   ↳ APP : ERR_QUANTITE_MIN [ligne 2 : Mini pizza / quiche] — « Minimum 10 pièces pour « Mini pizza / quiche ». » — sortie(s) : [Passer à 10 pièces]
Étape 2 · Quantité au pavé : 25 — Mini pizza / quiche
« Continuer : le paiement »
Étape 3 · Remarques : « Passe demain payer la moitié (122,50 €). »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (122,50 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 122,50 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 245,00 €, acompte 0,00 €, reste 245,00 €.
```

### Total annoncé contre l’attente du client

- Total : **245,00 €** annoncés, **245,00 €** attendus → écart **0,00 €**.
- Commande 2026-0903 : acompte enregistré 0,00 € (espèces), reste dû 245,00 €.
- Écart d’ACOMPTE : le client annonce 122,50 € à venir (plus tard, en espèces ou par carte) ; rien n’étant reçu, j’ai enregistré 0,00 € et noté la promesse en remarque (aucun champ « acompte promis »).
- Attente rédigée : Convertir les personnes en pièces avec la cliente. 50 Mini burger × 3,50 € = 175,00 € ; 25 Mini pizza / quiche × 2,80 € = 70,00 €. Total 245,00 €. Acompte conseillé 122,50 €. Retrait vendredi 27/11 à 18h00.

### Bons sortis

`bons/C03-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- La cliente compte en personnes, l’écran en pièces : aucune aide (pas de « 2 par personne »). Conversion de tête.
- La recherche « mini burger » montre DEUX cartes au même prix : « Mini-Burger » (comptoir) et « Mini burger » (sur commande). Rien ne dit laquelle prendre pour une commande ; seule la seconde porte le minimum de 10 (voir C21).
- Le premier toucher met 1 au bon et affiche tout de suite « Minimum 10 pièces » en rouge avant que j’aie tapé 50 : un refus qui s’allume à chaque produit à minimum, pour rien.
- Elle passe demain payer la moitié : pas d’acompte reçu aujourd’hui → « Pas d’acompte » + remarque.

---

## C04 — Karim Ouali (comptoir)

> **Le client dit :** Je voudrais un Matadi, le petit, pour 4. On n'est que nous quatre demain.
> **Retrait souhaité :** demain vers 15h · **Paiement :** Je paie tout maintenant.
> **Rebondissements :** Si on lui dit que le Matadi ne se fait pas en 4 : « Ah bon ? Bon ben le 6 alors, on en remangera le lendemain. » / « Ou alors c'est quoi qui existe en 4 au chocolat ? » (mousse chocolat 4P)

**Résultat : validée** — commande n° 2026-0904 · **17 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Karim Ouali »
Étape 1 · Téléphone (pavé) : 0492 31 07 85
Étape 1 · Jour de retrait : vendredi 20 novembre
   ↳ APP : INFO_COMMANDE_LENDEMAIN — « Commande pour demain : prévenez l’atelier. » — aucune sortie proposée
Étape 1 · Heure de retrait : 15:00
« Continuer : les produits »
Étape 2 · Recherche « matadi » → tuiles : Matadi chocolat — 3 produit(s) : Matadi chocolat 4P (20,00 €) · Matadi chocolat 6P (31,00 €) · Matadi chocolat 8P (36,00 €)
Étape 2 · Toucher la tuile « Matadi chocolat » → gâteau au bon, goût « Matadi chocolat » déjà posé, boutons de taille ouverts
Étape 2 · Bouton de taille « 4 » (affiché avec 20,00 €, prix du comptoir) → ligne : Matadi chocolat 4P
   ↳ APP : ERR_TAILLE_INTERDITE [ligne 1 : Matadi chocolat 4P] — « « Matadi chocolat 4P » ne se fait pas. Proposez au client « Matadi chocolat 6P » ou « Mousse chocolat 4P ». » — sortie(s) : [Passer en Matadi chocolat 6P] [Prendre Mousse chocolat 4P]
Client : « Bon ben le 6 alors. »
   → Vendeur touche la sortie [Passer en Matadi chocolat 6P]
   ↳ APP : ERR_FORME_MANQUANTE [ligne 1 : Matadi chocolat 6P] — « Choisissez la forme de « Matadi chocolat 6P » : carré ou rond. » — sortie(s) : [(champ vide : « À remplir : forme (carré ou rond) »)]
Étape 2 · Forme : Rond
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Matadi chocolat 6P] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Bloc « Sur ce gâteau » : « Pas d’écriture » coché
« Continuer : le paiement »
Étape 3 · Acompte au pavé : 31,00 €
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 31,00 €, acompte 31,00 €, reste 0,00 €.
```

### Total annoncé contre l’attente du client

- Total : **31,00 €** annoncés, **31,00 €** attendus → écart **0,00 €**.
- Commande 2026-0904 : acompte enregistré 31,00 € (espèces), reste dû 0,00 €.
- Attente rédigée : Refuser le Matadi 4P et proposer le 6P : Matadi chocolat 6P = 31,00 € (ou Mousse chocolat 4P à 20,00 € s'il tient à 4 parts). Retrait vendredi 20/11 à 15h00, prévenir l'atelier. Acompte = total 31,00 €.

### Bons sortis

`bons/C04-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- rien (tout ce que j’ai saisi se retrouve sur au moins un exemplaire).

### Remarques du vendeur

- Très bien : le Matadi 4P est refusé à la taille, avec les deux sorties « Passer en Matadi chocolat 6P » / « Prendre Mousse chocolat 4P ». Un geste et c’est réglé.
- Le bouton de taille « 4 » affiche pourtant « 20,00 € » comme une taille normale : le client voit un prix pour un gâteau qui ne se fait pas.
- Client qui ne veut rien d’écrit : il faut quand même cocher « Pas d’écriture », sinon l’avertissement reste.

---

## C05 — Marie-Claire Dumont (telephone)

> **Le client dit :** Bonjour, je voudrais commander un fraisier pour 6 personnes pour samedi, avec « Bonne fête Mamy » écrit dessus.
> **Retrait souhaité :** samedi vers 10h · **Paiement :** Mon mari passera donner un acompte cet après-midi, 25 €.
> **Rebondissements :** En cours de commande : « Ah attendez, ma belle-sœur vient avec les enfants... mettez-le pour 10 finalement. » / Apprenant qu'en 10 il sera carré : « Carré ? Bon, tant pis, ça ira. » / À la fin : « Et en fait non, pas samedi, dimanche. Même heure. »

**Résultat : validée** — commande n° 2026-0905 · **22 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Marie-Claire Dumont »
Étape 1 · Téléphone (pavé) : 0477 56 90 13
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : samedi 21 novembre
Étape 1 · Heure de retrait : 10:00
« Continuer : les produits »
Étape 2 · Toucher la tuile « Fraisier » → gâteau au bon, goût « Fraisier » déjà posé, boutons de taille ouverts
Étape 2 · Recherche « fraisier » → tuiles : Fraisier — 3 produit(s) : Fraisier 4P (20,00 €) · Fraisier 6P (31,00 €) · Fraisier 8P (36,00 €)
Étape 2 · Bouton de taille « 6 » (affiché avec 31,00 €, prix du comptoir) → ligne : Fraisier 6P
   ↳ APP : ERR_FORME_MANQUANTE [ligne 1 : Fraisier 6P] — « Choisissez la forme de « Fraisier 6P » : carré ou rond. » — sortie(s) : [(champ vide : « À remplir : forme (carré ou rond) »)]
Étape 2 · Forme : Rond
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Fraisier 6P] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Bloc « Sur ce gâteau » : écriture « Bonne fête Mamy »
Total annoncé à ce stade : 33,00 €. Cliente : « mettez-le pour 10 finalement. »
Étape 2 · Bouton de taille « 10 » → ligne : Fraisier
   ↳ APP : ERR_FORME_ROND_IMPOSSIBLE [ligne 1 : Fraisier] — « « Bavarois » se fait rond jusqu’à 8 parts : en 10 parts, il est carré. Pour un rond, passez en « Layer Cake » (minimum 20 parts). » — sortie(s) : [Passer en carré] [Passer en Layer Cake (20 parts)]
Cliente : « Carré ? Bon, tant pis, ça ira. »
   → Vendeur touche la sortie [Passer en carré]
Cliente : « Et en fait non, pas samedi, dimanche. Même heure. »
Retour à l’étape 1 (barre d’étapes)
Étape 1 · Jour de retrait : dimanche 22 novembre
« Continuer : le paiement »
Étape 3 · Remarques : « Son mari passe cet après-midi déposer 25 € d’acompte. »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (23,50 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 23,50 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 47,00 €, acompte 0,00 €, reste 47,00 €.
```

### Total annoncé contre l’attente du client

- Total : **47,00 €** annoncés, **47,00 €** attendus → écart **0,00 €**.
- Commande 2026-0905 : acompte enregistré 0,00 € (espèces), reste dû 47,00 €.
- Écart d’ACOMPTE : le client annonce 25,00 € à venir (plus tard, en espèces ou par carte) ; rien n’étant reçu, j’ai enregistré 0,00 € et noté la promesse en remarque (aucun champ « acompte promis »).
- Attente rédigée : Départ : Fraisier 6P 31,00 € + écriture 2,00 €. Après changement : Bavarois goût Fraisier 10 parts = 10 × 4,50 € = 45,00 € (carré) + Écriture 2,00 € = 47,00 €. Retrait dimanche 22/11 à 10h00. Acompte 25,00 € (plus de 50 % de 47,00 €).

### Bons sortis

`bons/C05-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- Le passage 6 → 10 parts se fait d’un toucher et le prix suit (33,00 € → 47,00 €). Bien.
- Le message du rond impossible parle de « Bavarois » alors que ma ligne s’appelle « Fraisier » : j’ai cru une seconde m’être trompée de gâteau.
- Changer le jour oblige à revenir à l’étape 1 par la barre d’étapes, puis à revenir au paiement : 3 gestes pour une date.
- Acompte de 25 € que le mari apportera cet après-midi : rien pour le noter, sauf la remarque. Le bon dit « ACOMPTE 0,00 € ».

---

## C06 — Thomas Leclercq (comptoir)

> **Le client dit :** Il me faudrait une forêt noire pour 15 personnes, mais ronde hein, pas un rectangle, c'est plus joli sur la table.
> **Retrait souhaité :** samedi 28 novembre à 16h · **Paiement :** Combien vous voulez d'acompte ? Je peux mettre 30 €.
> **Rebondissements :** Si on lui explique que rond au-dessus de 8 = Layer Cake de 20 parts minimum : « 100 € ? Non, c'est trop. Faites-le carré alors. » / « Vous mettez quand même « Félicitations Hugo » dessus. » / Si on lui propose deux ronds de 8 : « Non, un seul gâteau. »

**Résultat : validée** — commande n° 2026-0906 · **15 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Thomas Leclercq »
Étape 1 · Téléphone (pavé) : 0479 03 44 28
Étape 1 · Jour de retrait : samedi 28 novembre
Étape 1 · Heure de retrait : 16:00
« Continuer : les produits »
Étape 2 · Recherche « foret noire » → tuiles : Forêt noire — 4 produit(s) : Forêt noire 4P (20,00 €) · Forêt noire 6P (31,00 €) · Forêt noire 8P (36,00 €) · Forêt noire (4,80 €)
Étape 2 · Toucher la tuile « Forêt noire » → gâteau au bon, goût « Forêt noire » déjà posé, boutons de taille ouverts
Étape 2 · Bouton de taille « 15 » → ligne : Forêt noire
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Forêt noire] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Forme « rond » : bouton absent (boutons : Carré — « au-dessus de 8 parts »).
Je dois expliquer moi-même : rond au-dessus de 8 = Layer Cake de 20 parts minimum (100 €). Client : « Non, c’est trop. Faites-le carré alors. »
Étape 2 · Bloc « Sur ce gâteau » : écriture « Félicitations Hugo »
« Continuer : le paiement »
Étape 3 · Acompte au pavé : 30,00 €
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (34,75 €) : 30,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 34,75 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 69,50 €, acompte 30,00 €, reste 39,50 €.
```

### Total annoncé contre l’attente du client

- Total : **69,50 €** annoncés, **69,50 €** attendus → écart **0,00 €**.
- Commande 2026-0906 : acompte enregistré 30,00 € (espèces), reste dû 39,50 €.
- Attente rédigée : Options à annoncer : carré 15 parts = 15 × 4,50 € = 67,50 € ; Layer Cake rond 20 parts = 20 × 5,00 € = 100,00 €. Choix final : Forêt noire carrée 15 parts 67,50 € + Écriture 2,00 € = 69,50 €. Acompte 30,00 € < 34,75 € : avertissement, proposer de monter à 34,75 €.

### Bons sortis

`bons/C06-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- rien (tout ce que j’ai saisi se retrouve sur au moins un exemplaire).

### Remarques du vendeur

- À 15 parts il n’y a QUE le bouton « Carré » (« au-dessus de 8 parts »). L’écran ne me dit pas quoi répondre au client qui veut un rond : la sortie « Passer en Layer Cake (20 parts) » n’apparaît que si « Rond » était déjà choisi avant de monter la taille (vu en C05). J’ai dû connaître la règle et calculer 100 € de tête.
- Avertissement d’acompte clair, avec le bouton « Mettre l’acompte à 34,75 € ».

---

## C07 — Aïcha Diallo (whatsapp)

> **Le client dit :** Bonjour, je voudrais un bavarois mangue pour 7 personnes pour dimanche midi svp
> **Retrait souhaité :** dimanche à midi · **Paiement :** Je peux payer par Payconiq en venant ?
> **Rebondissements :** Si on lui propose 6 ou 8 : « Ah on ne peut pas 7 ? Alors 8, mieux vaut trop que pas assez. » / « Rond s'il vous plaît. »

**Résultat : validée** — commande n° 2026-0907 · **22 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Aïcha Diallo »
Étape 1 · Téléphone (pavé) : 0465 77 20 94
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : dimanche 22 novembre
Étape 1 · Heure de retrait : 12:00
« Continuer : les produits »
Étape 2 · Recherche « bavarois mangue » → tuiles : Bavarois mangue — 3 produit(s) : Bavarois mangue 4P (20,00 €) · Bavarois mangue 6P (31,00 €) · Bavarois mangue 8P (36,00 €)
Étape 2 · Toucher la tuile « Bavarois mangue » → gâteau au bon, goût « Mangue » déjà posé, boutons de taille ouverts
Étape 2 · Pas de bouton « 7 » (boutons : 4, 6, 8, 10, 15, 20, 25, 30) → « Autre », 7 au pavé
   ↳ APP : ERR_TAILLE_NON_STANDARD [ligne 1 : Bavarois] — « Ce gâteau se fait en 6 ou 8 parts, pas en 7. Choisissez une de ces tailles, ou demandez l’accord du manager. » — sortie(s) : [Passer à 6 parts] [Passer à 8 parts] [Saisir le code du manager]
Cliente : « Alors 8. »
   → Vendeur touche la sortie [Passer à 8 parts]
   ↳ APP : ERR_PRIX_COMPTOIR [ligne 1 : Bavarois] — « « Bavarois » en 8 parts existe au comptoir : il se vend au prix du comptoir. Prenez le gâteau du comptoir à la place. » — sortie(s) : [Prendre le gâteau du comptoir]
La sortie « Passer à 8 parts » ne suffit pas : nouveau refus, il faut encore toucher une deuxième sortie. Total affiché pendant ce temps : 36,00 € + à compléter ; la ligne s’appelle « Bavarois ».
   → Vendeur touche la sortie [Prendre le gâteau du comptoir]
   ↳ APP : ERR_FORME_MANQUANTE [ligne 1 : Bavarois mangue 8P] — « Choisissez la forme de « Bavarois mangue 8P » : carré ou rond. » — sortie(s) : [(champ vide : « À remplir : forme (carré ou rond) »)]
Étape 2 · Forme : Rond
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Bavarois mangue 8P] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Bloc « Sur ce gâteau » : « Pas d’écriture » coché
« Continuer : le paiement »
Étape 3 · Remarques : « Paie par Payconiq au retrait. »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (18,00 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 18,00 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 36,00 €, acompte 0,00 €, reste 36,00 €.
```

### Total annoncé contre l’attente du client

- Total : **36,00 €** annoncés, **36,00 €** attendus → écart **0,00 €**.
- Commande 2026-0907 : acompte enregistré 0,00 € (espèces), reste dû 36,00 €.
- Attente rédigée : Refuser 7 parts, proposer 6P (31,00 €) ou 8P (36,00 €). Choix : Bavarois mangue 8P = 36,00 €, rond. Retrait dimanche 22/11 à 12h00. Pas d'acompte : avertissement (viser 18,00 €).

### Bons sortis

`bons/C07-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- La sortie « Passer à 8 parts » ne règle pas le problème : elle provoque un DEUXIÈME refus (« existe au comptoir… Prenez le gâteau du comptoir à la place ») avec un deuxième bouton. Deux gestes et deux messages pour ce que le bouton de taille « 8 » fait en un.
- Pendant ce temps la ligne s’appelle « Bavarois » (plus « Bavarois mangue ») et le total affiche 36,00 € « + à compléter ».
- Payconiq au retrait : pas de mode de paiement correspondant (Espèces / Virement seulement).

---

## C08 — Sophie Peeters (telephone)

> **Le client dit :** Bonjour, j'ai vu vos layer cakes sur Instagram, j'en voudrais un pour 12 personnes, pour l'anniversaire de ma fille.
> **Retrait souhaité :** samedi 28 novembre vers 14h · **Paiement :** Je viens payer l'acompte samedi qui vient.
> **Rebondissements :** Quand on annonce minimum 20 parts : « 100 € pour 12 personnes ? Non, c'est trop. Alors un bavarois framboise pour 12. » / Quand on lui dit que 12 n'existe pas : « Pfff. Bon, 15 alors, on en donnera aux voisins. » / « Vous écrivez « Joyeux anniversaire Emma 8 ans ». »

**Résultat : validée** — commande n° 2026-0908 · **26 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Sophie Peeters »
Étape 1 · Téléphone (pavé) : 0473 62 15 39
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : samedi 28 novembre
Étape 1 · Heure de retrait : 14:00
« Continuer : les produits »
Étape 2 · Recherche « layer » → 1 produit(s) : Layer Cake (5,00 €/pers., sur commande)
Étape 2 · Toucher carte « Layer Cake » → boutons de taille ouverts
Étape 2 · Pas de bouton « 12 » (boutons : 20, 25, 30, 35, 40, 45, 50, 55, 60) → « Autre », 12 au pavé
   ↳ APP : ERR_QUANTITE_MIN [ligne 1 : Layer Cake] — « Minimum 20 parts pour « Layer Cake ». » — sortie(s) : [Passer à 20 parts]
Cliente : « 100 € pour 12 personnes ? Non. Alors un bavarois framboise pour 12. »
Étape 2 · × retirer la ligne « Layer Cake »
Étape 2 · Recherche « bavarois framboise » → tuiles : Bavarois framboise — 4 produit(s) : Bavarois framboise 4P (20,00 €) · Bavarois framboise 6P (31,00 €) · Bavarois framboise 8P (36,00 €) · Bavarois framboise (4,80 €)
Étape 2 · Toucher la tuile « Bavarois framboise » → gâteau au bon, goût « Framboise » déjà posé, boutons de taille ouverts
Étape 2 · Pas de bouton « 12 » (boutons : 4, 6, 8, 10, 15, 20, 25, 30) → « Autre », 12 au pavé
   ↳ APP : ERR_TAILLE_NON_STANDARD [ligne 1 : Bavarois] — « Ce gâteau se fait en 10 ou 15 parts, pas en 12. Choisissez une de ces tailles, ou demandez l’accord du manager. » — sortie(s) : [Passer à 10 parts] [Passer à 15 parts] [Saisir le code du manager]
Cliente : « Pfff. Bon, 15 alors. »
   → Vendeur touche la sortie [Passer à 15 parts]
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Bavarois] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Bloc « Sur ce gâteau » : écriture « Joyeux anniversaire Emma 8 ans »
« Continuer : le paiement »
Étape 3 · Remarques : « Vient payer l’acompte samedi 21/11 (34,75 €). »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (34,75 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 34,75 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 69,50 €, acompte 0,00 €, reste 69,50 €.
```

### Total annoncé contre l’attente du client

- Total : **69,50 €** annoncés, **69,50 €** attendus → écart **0,00 €**.
- Commande 2026-0908 : acompte enregistré 0,00 € (espèces), reste dû 69,50 €.
- Écart d’ACOMPTE : le client annonce 34,75 € à venir (plus tard, en espèces ou par carte) ; rien n’étant reçu, j’ai enregistré 0,00 € et noté la promesse en remarque (aucun champ « acompte promis »).
- Attente rédigée : Layer Cake 12 parts refusé ; 20 parts = 100,00 €. Repli : Bavarois framboise 12 refusé, 10 parts = 45,00 € ou 15 parts = 67,50 €. Choix final : Bavarois framboise 15 parts (carré) 67,50 € + Écriture 2,00 € = 69,50 €. Acompte conseillé 34,75 €.

### Bons sortis

`bons/C08-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- Layer Cake 12 : refus net avec « Passer à 20 parts ». Bien. Mais pour repartir sur un bavarois, je dois retirer la ligne et recommencer (pas de sortie « autre gâteau »).
- 12 parts : « Passer à 10 parts » / « Passer à 15 parts » / « Saisir le code du manager » — exactement ce qu’il faut.
- Pour taper 12 il faut passer par « Autre » puis le pavé (3 gestes) alors que la réponse sera de toute façon un refus.
- Acompte promis pour samedi : remarque libre.

---

## C09 — Mehdi Bouzid (whatsapp)

> **Le client dit :** Salut, je veux le gâteau chiffre « 25 » pour les 25 ans de mon frère, on sera une vingtaine. Goût Oreo.
> **Retrait souhaité :** samedi 5 décembre à 19h · **Paiement :** Je fais un virement de 50 € ce soir.
> **Rebondissements :** Quand on annonce 30 parts minimum : « On est 20, pas 30... mais bon, si c'est comme ça. » / Quand on lui dit qu'Oreo est une décoration : « Ah. Ben vanille dedans alors, et Oreo dessus. »

**Résultat : validée** — commande n° 2026-0909 · **25 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Mehdi Bouzid »
Étape 1 · Téléphone (pavé) : 0484 19 53 70
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : samedi 5 décembre
Étape 1 · Heure de retrait : 19:00
« Continuer : les produits »
Étape 2 · Recherche « gateau chiffre » → RIEN (aucune tuile, aucun produit)
Étape 2 · Recherche « number » → 1 produit(s) : Number Cake (5,00 €/pers., sur commande)
Étape 2 · Toucher carte « Number Cake » → « combien de chiffres ou lettres ? »
Étape 2 · « Combien de chiffres ou lettres ? » : 2
Étape 2 · « Quels chiffres ou lettres ? » : « 25 » → 2 compté(s), au bon : « 2  5 »
Étape 2 · Pas de bouton « 20 » (boutons : 30, 35, 40, 45, 50, 55, 60, 65, 70) → « Autre », 20 au pavé
   ↳ APP : ERR_QUANTITE_MIN [ligne 1 : Number Cake] — « Minimum 30 parts pour « Number Cake » (15 parts par chiffre ou lettre, 2 chiffres ou lettres). » — sortie(s) : [Passer à 30 parts]
Client : « On est 20, pas 30… mais bon. »
   → Vendeur touche la sortie [Passer à 30 parts]
   ↳ APP : ERR_GOUT_MANQUANT [ligne 1 : Number Cake] — « Choisissez le goût pour « Number Cake ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Client veut « goût Oreo » : Oreo n’est pas dans les goûts (c’est une décoration). Client : « Vanille dedans alors, et Oreo dessus. »
Étape 2 · Goût : « Vanille » → ligne : Number Cake
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Number Cake] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · « Décoration (facultatif) » : Oreo
Étape 2 · Bloc « Sur ce gâteau » : « Pas d’écriture » coché
« Continuer : le paiement »
Étape 3 · Acompte au pavé : 50,00 €
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (75,00 €) : 50,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 75,00 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 150,00 €, acompte 50,00 €, reste 100,00 €.
```

### Total annoncé contre l’attente du client

- Total : **150,00 €** annoncés, **150,00 €** attendus → écart **0,00 €**.
- Commande 2026-0909 : acompte enregistré 50,00 € (virement), reste dû 100,00 €.
- Attente rédigée : Number Cake 2 symboles : minimum 30 parts × 5,00 € = 150,00 €. Goût Vanille, décoration Oreo (supplément éventuel : à voir, pas au tarif). Retrait samedi 05/12 à 19h00. Acompte 50,00 € < 75,00 € : avertissement.

### Bons sortis

`bons/C09-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon
- acompte PAR VIREMENT pas encore reçu : les bons internes impriment « ACOMPTE 50,00 € » comme un acompte versé ; seul l’exemplaire CLIENT porte « Communication du virement »

### Remarques du vendeur

- « Gâteau chiffre » : la recherche ne trouve rien. Il faut savoir que ça s’appelle « Number Cake ».
- Le nombre de chiffres suit bien le texte tapé (« 25 » → 2) et l’aperçu « 2  5 » rassure.
- Oreo : absent des goûts, présent dans « Décoration (facultatif) », repliée par défaut. Rien ne dit si la décoration Oreo se paie (le client demande « c’est combien en plus ? » : je ne sais pas).
- Acompte de 50 € « par virement ce soir » : je le saisis en Virement ; le bon interne imprimera « ACOMPTE 50,00 € » sans dire qu’il n’est pas encore arrivé.

---

## C10 — Nathalie Janssens (telephone)

> **Le client dit :** Bonjour, c'est pour un number cake « 18 » pour ma fille, framboise avec des spéculoos dessus. Elle a 18 ans mardi, donc je viens le chercher mardi en fin d'après-midi.
> **Retrait souhaité :** mardi 24 novembre vers 17h · **Paiement :** Je passerai samedi déposer 75 €.
> **Rebondissements :** Quand on lui dit que c'est fermé le mardi : « Ah zut. Lundi soir alors, il tiendra au frigo ? » / Puis : « Non, finalement mercredi 17h, on fêtera mercredi. » / « On sera 30, donc ça tombe bien. »

**Résultat : validée** — commande n° 2026-0910 · **22 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Nathalie Janssens »
Étape 1 · Téléphone (pavé) : 0476 08 92 47
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait mardi 24 novembre (mardi demandé) : la case est grisée dans la bande (jour fermé), impossible à toucher.
   ↳ DOMAINE (ce que dirait le serveur si la date arrivait quand même) : ERR_JOUR_FERME — « Fermé le mardi — choisissez un autre jour de retrait. » — valeur proposée : "2026-11-25"
Cliente : « Lundi soir alors ? » puis « Non, finalement mercredi 17h. »
Étape 1 · Jour de retrait : mercredi 25 novembre
Étape 1 · Heure de retrait : 17:00
« Continuer : les produits »
Étape 2 · Recherche « number » → 1 produit(s) : Number Cake (5,00 €/pers., sur commande)
Étape 2 · Toucher carte « Number Cake » → « combien de chiffres ou lettres ? »
Étape 2 · « Combien de chiffres ou lettres ? » : 2
Étape 2 · « Quels chiffres ou lettres ? » : « 18 » → 2 compté(s), au bon : « 1  8 »
Étape 2 · Bouton de taille « 30 » → ligne : Number Cake
   ↳ APP : ERR_GOUT_MANQUANT [ligne 1 : Number Cake] — « Choisissez le goût pour « Number Cake ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Framboise » → ligne : Number Cake
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Number Cake] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · « Décoration (facultatif) » : Speculoos
Étape 2 · Bloc « Sur ce gâteau » : « Pas d’écriture » coché
« Continuer : le paiement »
Étape 3 · Remarques : « Passera samedi 21/11 déposer 75 € d’acompte. »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (75,00 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 75,00 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 150,00 €, acompte 0,00 €, reste 150,00 €.
```

### Total annoncé contre l’attente du client

- Total : **150,00 €** annoncés, **150,00 €** attendus → écart **0,00 €**.
- Commande 2026-0910 : acompte enregistré 0,00 € (espèces), reste dû 150,00 €.
- Écart d’ACOMPTE : le client annonce 75,00 € à venir (plus tard, en espèces ou par carte) ; rien n’étant reçu, j’ai enregistré 0,00 € et noté la promesse en remarque (aucun champ « acompte promis »).
- Attente rédigée : Refuser le mardi 24/11, proposer lundi 23 ou mercredi 25. Number Cake « 18 » = 2 symboles × 15 = 30 parts × 5,00 € = 150,00 €. Goût Framboise, décoration Speculoos. Retrait mercredi 25/11 à 17h00. Acompte 75,00 € = 50 %.

### Bons sortis

`bons/C10-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- Mardi : la case du jour est grisée, impossible de se tromper. Mais comme elle est grisée, je ne vois PAS le message « Fermé le mardi » ni la proposition du mercredi : c’est moi qui explique.
- Speculoos en décoration, Framboise en goût : pas d’hésitation possible une fois qu’on a compris les deux listes.
- Elle déposera 75 € samedi : remarque libre, acompte 0 € au bon.

---

## C11 — Hanane Tahiri (comptoir)

> **Le client dit :** Vous faites les gâteaux en lettres ? Je voudrais le prénom de ma fille, LINA, en gâteau, pour ses 6 ans. On sera 25.
> **Retrait souhaité :** dimanche 29 novembre à 13h · **Paiement :** Je vous donne 50 € aujourd'hui.
> **Rebondissements :** Quand on annonce 4 lettres = 60 parts = 300 € : « Quoi ?! Non non. Juste la lettre L alors ? » / Puis : « Non, c'est nul un L tout seul. Faites-moi un layer cake pour 25 avec « Lina 6 ans » écrit dessus, goût fraise. »

**Résultat : validée** — commande n° 2026-0911 · **27 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Hanane Tahiri »
Étape 1 · Téléphone (pavé) : 0489 64 30 18
Étape 1 · Jour de retrait : dimanche 29 novembre
Étape 1 · Heure de retrait : 13:00
« Continuer : les produits »
Étape 2 · Recherche « lettres » → RIEN (aucune tuile, aucun produit)
Étape 2 · Recherche « number » → 1 produit(s) : Number Cake (5,00 €/pers., sur commande)
Étape 2 · Toucher carte « Number Cake » → « combien de chiffres ou lettres ? »
Étape 2 · « Combien de chiffres ou lettres ? » : 4
Étape 2 · « Quels chiffres ou lettres ? » : « LINA » → 4 compté(s), au bon : « L  I  N  A »
Boutons de taille proposés pour 4 lettres : 60, 65, 70, 75, 80, 85, 90, 95, 100.
Étape 2 · Bouton de taille « 60 » → ligne : Number Cake
   ↳ APP : ERR_GOUT_MANQUANT [ligne 1 : Number Cake] — « Choisissez le goût pour « Number Cake ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Fraise » → ligne : Number Cake
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Number Cake] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Total annoncé : 300,00 €. Cliente : « Quoi ?! Non non. Juste la lettre L alors ? »
Étape 2 · « Combien de chiffres ou lettres ? » : 1
Étape 2 · « Quels chiffres ou lettres ? » : « L » → 1 compté(s), au bon : « L »
Étape 2 · Bouton de taille « 15 » → ligne : Number Cake
Total annoncé : 75,00 € pour 15 parts (elle est 25). Cliente : « Non, c’est nul un L tout seul. Un layer cake pour 25 avec « Lina 6 ans », goût fraise. »
Étape 2 · × retirer la ligne « Number Cake »
Étape 2 · Recherche « layer » → 1 produit(s) : Layer Cake (5,00 €/pers., sur commande)
Étape 2 · Toucher carte « Layer Cake » → boutons de taille ouverts
Étape 2 · Bouton de taille « 25 » → ligne : Layer Cake
   ↳ APP : ERR_GOUT_MANQUANT [ligne 1 : Layer Cake] — « Choisissez le goût pour « Layer Cake ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Fraise » → ligne : Layer Cake
Étape 2 · Bloc « Sur ce gâteau » : écriture « Lina 6 ans »
« Continuer : le paiement »
Étape 3 · Acompte au pavé : 50,00 €
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (63,50 €) : 50,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 63,50 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 127,00 €, acompte 50,00 €, reste 77,00 €.
```

### Total annoncé contre l’attente du client

- Total : **127,00 €** annoncés, **127,00 €** attendus → écart **0,00 €**.
- Commande 2026-0911 : acompte enregistré 50,00 € (espèces), reste dû 77,00 €.
- Attente rédigée : « LINA » = 4 symboles × 15 = 60 parts × 5,00 € = 300,00 €. « L » seul = 15 parts = 75,00 € (insuffisant pour 25). Choix final : Layer Cake 25 parts × 5,00 € = 125,00 € + Écriture 2,00 € = 127,00 €, goût Fraise. Acompte 50,00 € < 63,50 € : avertissement.

### Bons sortis

`bons/C11-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- rien (tout ce que j’ai saisi se retrouve sur au moins un exemplaire).

### Remarques du vendeur

- « Lettres » : rien à la recherche. « Number Cake » encore.
- Pour « LINA » les tailles démarrent à 60 : le total 300,00 € tombe tout de suite, la cliente comprend.
- Passer de 4 lettres à 1 : je touche « 1 », le texte « LINA » est vidé, je retape « L », et la taille 60 reste affichée jusqu’à ce que je retouche 15 : il faut penser à la rechanger.
- Du Number Cake au Layer Cake : retirer la ligne, rechercher, retoucher, rechoisir le goût Fraise (perdu avec la ligne).

---

## C12 — Élodie Lambert (comptoir)

> **Le client dit :** Bonjour, on se marie le 12 décembre et on voudrait un gâteau de mariage à deux étages pour 50 personnes. En bas vanille-fraise, en haut chocolat. Avec « Élodie & Maxime » dessus.
> **Retrait souhaité :** samedi 12 décembre à 14h · **Paiement :** On laisse la moitié aujourd'hui par carte.
> **Rebondissements :** Si on demande un goût par étage : « Vanille en bas, chocolat en haut, c'est plus simple. » / LE LENDEMAIN (vendredi 20/11), elle rappelle : « On a 10 invités en plus, il faut passer à 60 personnes. Et on viendra le chercher à 10h au lieu de 14h. » / « Du coup je dois rajouter combien d'acompte ? »

**Résultat : validée** — commande n° 2026-0912 · **30 gestes** environ · code du manager : non utilisé

### Jour 1 (jeudi 19/11) — prise de commande

```
Étape 1 · Nom du client : « Élodie Lambert »
Étape 1 · Téléphone (pavé) : 0478 25 71 06
Étape 1 · Jour de retrait : samedi 12 décembre
Étape 1 · Heure de retrait : 14:00
« Continuer : les produits »
Étape 2 · Recherche « mariage » → RIEN (aucune tuile, aucun produit)
Étape 2 · Recherche « piece montee » → 2 produit(s) : Pièce montée 2 étages (5,60 €/pers., sur commande) · Pièce montée 3 étages (5,60 €/pers., sur commande)
Étape 2 · Toucher carte « Pièce montée 2 étages » → boutons de taille ouverts
Étape 2 · Bouton de taille « 50 » → ligne : Pièce montée 2 étages
   ↳ APP : ERR_GOUT_MANQUANT [ligne 1 : Pièce montée 2 étages] — « Choisissez le goût de l’étage 1 pour « Pièce montée 2 étages ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
La cliente a dit « vanille-fraise en bas » ; à la question « un goût par étage ? » : « Vanille en bas, chocolat en haut. »
Étape 2 · Goûts par étage : étage 1 « Vanille », étage 2 « Chocolat » → ligne : Pièce montée 2 étages
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Pièce montée 2 étages] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Bloc « Sur ce gâteau » : écriture « Élodie & Maxime »
« Continuer : le paiement »
Étape 3 · Acompte au pavé : 141,00 €
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 282,00 €, acompte 141,00 €, reste 141,00 €.
```

### Jour 2 (vendredi 20/11) — modification

```
VENDREDI 20/11 — la cliente rappelle. Liste des commandes → sa commande → « Modifier » (l’écran s’ouvre à l’étape 2, lignes relues).
Étape 2 · Toucher l’onglet « Pièce montée 2 étages » du bon pour rouvrir ses réglages
Étape 2 · Bouton de taille « 60 » → ligne : Pièce montée 2 étages
   ↳ APP : AVERT_COMMANDE_DEJA_IMPRIMEE — « Cette commande est déjà imprimée : réimprimez les bons après la modification. » — sortie(s) : [Réimprimer]
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (169,00 €) : 141,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 169,00 €]
Retour à l’étape 1 (barre d’étapes)
Étape 1 · Heure de retrait : 10:00
Cliente : « Je dois rajouter combien d’acompte ? »
« Continuer : le paiement »
L’écran affiche : total 338,00 €, acompte 141,00 € (inchangé). Il ne calcule pas le complément : 169,00 − 141,00 = 28,00 € de tête.
Étape 3 · Acompte au pavé : 169,00 €
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 338,00 €, acompte 169,00 €, reste 169,00 €.
   ↳ Historique enregistré : « à réimprimer — heure : 14h00 → 10h00, produits — avant : 50 × Pièce montée 2 étages [goût Vanille / Chocolat ; écriture « Élodie & Maxime »] à 5,60 € ; 1 × Supplément Écriture simple à 2,00 €, total : 282,00 € → 338,00 €, acompte : 141,00 € → 169,00 € »
```

### Total annoncé contre l’attente du client

- Première version : **282,00 €** annoncés, **282,00 €** attendus → écart 0,00 €.
- Après modification : **338,00 €** annoncés, **338,00 €** attendus → écart **0,00 €**.
- Commande 2026-0912 : acompte enregistré 169,00 € (espèces), reste dû 169,00 €.
- Attente rédigée : Jour 1 : 50 parts × 5,60 € = 280,00 € + Écriture 2,00 € = 282,00 € ; acompte 141,00 €. Lendemain : 60 parts × 5,60 € = 336,00 € + 2,00 € = 338,00 € ; acompte à 50 % = 169,00 €, soit 28,00 € à rajouter. Retrait samedi 12/12 à 10h00. La modification doit rester tracée.

### Bons sortis

`bons/C12-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt` · `bons/C12-modifiee-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt` — la version « -modifiee » remplace la première (bandeau « MODIFIÉE … Jetez l’ancien bon »).

**Saisi mais imprimé sur AUCUN bon :**

- rien (tout ce que j’ai saisi se retrouve sur au moins un exemplaire).

### Remarques du vendeur

- « Gâteau de mariage » : la recherche « mariage » ne trouve rien (le produit s’appelle « Pièce montée 2 étages »).
- Un goût par étage, clair. « Vanille-fraise » aurait dû se taper dans « Autre… ».
- Paiement par carte : pas de mode « carte » ; resté sur Espèces.
- Modification du lendemain : simple (onglet, taille 60, heure). L’avertissement « déjà imprimée : réimprimez » et le bandeau « MODIFIÉE… Jetez l’ancien bon » sont très bien.
- L’écran ne dit pas combien d’acompte il faut RAJOUTER (28,00 €) : il affiche le nouveau minimum (169,00 €) et je soustrais de tête. Et je dois remplacer 141,00 par 169,00 au pavé : rien ne trace que 28 € ont été encaissés aujourd’hui (l’historique dit seulement « acompte : 141,00 € → 169,00 € »).

---

## C13 — Youssef Chaoui (whatsapp)

> **Le client dit :** Bonsoir, je vous envoie une photo d'une pièce montée 3 étages, je veux la même pour les fiançailles de ma sœur. On sera 45. Goût Kinder partout. C'est combien ?
> **Retrait souhaité :** samedi 19 décembre vers 17h · **Paiement :** Je peux payer l'acompte par virement ?
> **Rebondissements :** Quand on annonce 60 parts minimum pour 3 étages : « Non, 45 c'est 45. Faites 2 étages alors. » / Quand on lui dit que Kinder est une décoration : « Ah ok. Vanille en bas et chocolat en haut, avec du Kinder dessus. » / « Mais les fleurs comme sur la photo vous pouvez les faire ? »

**Résultat : validée** — commande n° 2026-0913 · **30 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Youssef Chaoui »
Étape 1 · Téléphone (pavé) : 0493 81 46 22
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : samedi 19 décembre
Étape 1 · Heure de retrait : 17:00
« Continuer : les produits »
Étape 2 · Recherche « piece montee » → 2 produit(s) : Pièce montée 2 étages (5,60 €/pers., sur commande) · Pièce montée 3 étages (5,60 €/pers., sur commande)
Étape 2 · Toucher carte « Pièce montée 3 étages » → boutons de taille ouverts
Étape 2 · Pas de bouton « 45 » (boutons : 60, 65, 70, 75, 80, 85, 90, 95, 100) → « Autre », 45 au pavé
   ↳ APP : ERR_QUANTITE_MIN [ligne 1 : Pièce montée 3 étages] — « Minimum 60 parts pour « Pièce montée 3 étages ». » — sortie(s) : [Passer à 60 parts]
Client : « Non, 45 c’est 45. Faites 2 étages alors. » — aucune sortie vers « 2 étages » : je retire la ligne et je reprends.
Étape 2 · × retirer la ligne « Pièce montée 3 étages »
Étape 2 · Toucher carte « Pièce montée 2 étages » → boutons de taille ouverts
Étape 2 · Bouton de taille « 45 » → ligne : Pièce montée 2 étages
   ↳ APP : ERR_GOUT_MANQUANT [ligne 1 : Pièce montée 2 étages] — « Choisissez le goût de l’étage 1 pour « Pièce montée 2 étages ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
« Goût Kinder partout » : Kinder n’est pas dans les goûts. Client : « Vanille en bas et chocolat en haut, avec du Kinder dessus. »
Étape 2 · Goûts par étage : étage 1 « Vanille », étage 2 « Chocolat » → ligne : Pièce montée 2 étages
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Pièce montée 2 étages] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · « Décoration (facultatif) » : Kinder
Étape 2 · Bloc « Sur ce gâteau » : « Pas d’écriture » coché
Étape 2 · « Précision… » de la ligne Pièce montée 2 étages : « Fleurs comme sur la photo du client : à voir avec le pâtissier (supplément ?) »
« Continuer : le paiement »
Étape 3 · Remarques : « Modèle : photo d’une pièce montée 3 étages envoyée sur WhatsApp. Fleurs en décor demandées. »
Étape 3 · Case « Photo d’exemple envoyée sur WhatsApp » cochée
Étape 3 · Case « Demande inhabituelle (ingrédient particulier, moule spécial…) » cochée
   ↳ APP : AVERT_COMMANDE_INHABITUELLE — « Commande inhabituelle : demandez d’abord l’accord du manager avant de confirmer au client. Le client peut aussi commander par WhatsApp. » — sortie(s) : [(Appeler le manager ou proposer WhatsApp)]
Étape 3 · Acompte au pavé : 126,00 €
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 252,00 €, acompte 126,00 €, reste 126,00 €.
```

### Total annoncé contre l’attente du client

- Total : **252,00 €** annoncés, **252,00 €** attendus → écart **0,00 €**.
- Commande 2026-0913 : acompte enregistré 126,00 € (virement), reste dû 126,00 €.
- Attente rédigée : 3 étages : minimum 60 parts × 5,60 € = 336,00 €. Choix : Pièce montée 2 étages 45 parts × 5,60 € = 252,00 €. Goûts Vanille / Chocolat, décoration Kinder. Joindre la photo à la commande ; fleurs du modèle : demander au pâtissier, supplément à voir. Acompte conseillé 126,00 €.

### Bons sortis

`bons/C13-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon
- acompte PAR VIREMENT pas encore reçu : les bons internes impriment « ACOMPTE 126,00 € » comme un acompte versé ; seul l’exemplaire CLIENT porte « Communication du virement »

### Remarques du vendeur

- 3 étages pour 45 : seule sortie « Passer à 60 parts ». Le repli naturel « 2 étages » n’est pas proposé : retirer, retoucher.
- Fleurs « comme sur la photo » : rien au tarif ; précision libre + case « Demande inhabituelle ». Le bon interne porte bien « À CONFIRMER — PRIX ET FAISABILITÉ ».
- La photo du client est sur WhatsApp : je ne peux que cocher « Photo d’exemple envoyée sur WhatsApp » ; le bon dit « à réclamer au manager ». Le pâtissier n’a pas l’image.
- Kinder en décoration : toujours pas de prix.

---

## C14 — Laurent De Smet (comptoir)

> **Le client dit :** Je voudrais un entremet chocolat noisette, celui qui est dans la vitrine, pour 8. C'est pour dimanche.
> **Retrait souhaité :** dimanche vers 11h30 · **Paiement :** Je paie tout de suite.
> **Rebondissements :** « Ah en fait on sera 10, ma mère vient avec son compagnon. Vous l'avez en 10 ? » / Si on lui annonce le prix en 10 : « 69 € ? Alors que le 8 est à 48 ? Bon... laissez le 8 et ajoutez-moi deux tartelettes citron. »

**Résultat : validée** — commande n° 2026-0914 · **21 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Laurent De Smet »
Étape 1 · Téléphone (pavé) : 0474 39 58 11
Étape 1 · Jour de retrait : dimanche 22 novembre
Étape 1 · Heure de retrait : 11:30
« Continuer : les produits »
Étape 2 · Recherche « entremet » → tuiles : Entremet 8P — 5 produit(s) : Entremet (6,90 €/pers., sur commande) · Entremet 8P Noisette chocolat (48,00 €) · Entremet 8P Framboise (48,00 €) · Entremet 8P Passion (48,00 €) · Entremet 8P Vanille (48,00 €)
Étape 2 · Toucher le bouton « Noisette chocolat » de la tuile « Entremet 8P » : « Entremet 8P Noisette chocolat » → 1 gâteau au bon (sa ligne)
Client : « En fait on sera 10. Vous l’avez en 10 ? » — pas de bouton de taille sur ce gâteau du comptoir : j’ajoute l’« Entremet » sur commande pour voir le prix.
Étape 2 · Toucher carte « Entremet » → boutons de taille ouverts
Étape 2 · Bouton de taille « 10 » → ligne : Entremet
   ↳ APP : ERR_GOUT_MANQUANT [ligne 2 : Entremet] — « Choisissez la recette pour « Entremet ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Chocolat noisette » (tapé dans « Autre… ») → ligne : Entremet
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 2 : Entremet] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Total affiché avec les deux lignes : 117,00 € (l’entremet 10 parts seul : 69,00 €). Client : « 69 € alors que le 8 est à 48 ? Laissez le 8 et ajoutez deux tartelettes citron. »
Étape 2 · × retirer la ligne « Entremet »
Étape 2 · Recherche « tartelette citron » → 1 produit(s) : Tartelette citron (4,70 €)
Étape 2 · Toucher carte « Tartelette citron » × 2 → 2 au bon, pavé de quantité ouvert
« Continuer : le paiement »
Étape 3 · Acompte au pavé : 57,40 €
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 57,40 €, acompte 57,40 €, reste 0,00 €.
```

### Total annoncé contre l’attente du client

- Total : **57,40 €** annoncés, **57,40 €** attendus → écart **0,00 €**.
- Commande 2026-0914 : acompte enregistré 57,40 € (espèces), reste dû 0,00 €.
- Attente rédigée : Entremet 8P Noisette chocolat (comptoir) = 48,00 €. En 10 parts sur commande : 10 × 6,90 € = 69,00 € (recette Chocolat noisette). Choix final : Entremet 8P 48,00 € + 2 Tartelette citron × 4,70 € = 9,40 € → 57,40 €, payé en entier. Retrait dimanche 22/11 à 11h30.

### Bons sortis

`bons/C14-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- rien (tout ce que j’ai saisi se retrouve sur au moins un exemplaire).

### Remarques du vendeur

- L’entremet de la vitrine (tuile « Entremet 8P ») n’a pas de bouton de taille : pour répondre « et en 10 ? » j’ai dû ajouter l’Entremet sur commande à côté, choisir 10, taper la recette, lire 117,00 € (les deux lignes), soustraire, puis retirer la ligne.
- La recette « Chocolat noisette » s’écrit « Noisette chocolat » sur la tuile du comptoir : deux noms pour le même gâteau.
- 2 tartelettes : deux touchers de la carte, parfait.

---

## C15 — Monique Claes (telephone)

> **Le client dit :** Bonjour madame, je voudrais un gâteau à la crème fraîche pour 8 personnes, tout simple, à la vanille, avec « Bon anniversaire Papy » dessus.
> **Retrait souhaité :** samedi à 9h30 · **Paiement :** Je passerai demain vous donner 20 €.
> **Rebondissements :** « Avec des fruits dessus si possible. » / « Rond ou carré ? Oh, rond. »

**Résultat : validée** — commande n° 2026-0915 · **20 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Monique Claes »
Étape 1 · Téléphone (pavé) : 0471 20 66 93
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : samedi 21 novembre
Étape 1 · Heure de retrait : 09:30
« Continuer : les produits »
Étape 2 · Recherche « creme fraiche » → 3 produit(s) : Crème fraîche (4,20 €/pers., sur commande) · Crème fraîche 6P (26,00 €) · Crème fraîche 8P (31,00 €)
Étape 2 · Toucher carte « Crème fraîche » → boutons de taille ouverts
Étape 2 · Bouton de taille « 8 » (affiché avec 31,00 €, prix du comptoir) → ligne : Crème fraîche 8P
   ↳ APP : ERR_FORME_MANQUANTE [ligne 1 : Crème fraîche 8P] — « Choisissez la forme de « Crème fraîche 8P » : carré ou rond. » — sortie(s) : [(champ vide : « À remplir : forme (carré ou rond) »)]
Étape 2 · Forme : Rond
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Crème fraîche 8P] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Bloc « Sur ce gâteau » : écriture « Bon anniversaire Papy »
Étape 2 · « Précision… » de la ligne Crème fraîche 8P : « Avec des fruits dessus si possible (supplément à voir) »
« Continuer : le paiement »
Étape 3 · Remarques : « Passera demain donner 20 € d’acompte. »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (16,50 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 16,50 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 33,00 €, acompte 0,00 €, reste 33,00 €.
```

### Total annoncé contre l’attente du client

- Total : **33,00 €** annoncés, **33,00 €** attendus → écart **0,00 €**.
- Commande 2026-0915 : acompte enregistré 0,00 € (espèces), reste dû 33,00 €.
- Écart d’ACOMPTE : le client annonce 20,00 € à venir (plus tard, en espèces ou par carte) ; rien n’étant reçu, j’ai enregistré 0,00 € et noté la promesse en remarque (aucun champ « acompte promis »).
- Attente rédigée : Crème fraîche 8P (comptoir) 31,00 € + Écriture 2,00 € = 33,00 €. Goût Vanille sans code. Fruits : à noter en remarque, supplément à voir. Retrait samedi 21/11 à 9h30. Acompte 20,00 € ≥ 16,50 €.

### Bons sortis

`bons/C15-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- Goût Vanille déjà posé, taille 8 au prix du comptoir (31,00 € écrit sur le bouton) : très rapide.
- « Des fruits dessus » : aucun supplément au tarif, je l’écris en précision ; le prix reste 33,00 € et personne ne sait si c’est gratuit.
- Acompte de 20 € promis pour demain : remarque libre.

---

## C16 — Rachid Amrani (comptoir)

> **Le client dit :** Un gâteau crème fraîche pour 15 personnes, mais au chocolat, pas vanille. Avec écrit « Bravo Sofiane ».
> **Retrait souhaité :** vendredi 27 novembre à 18h30 · **Paiement :** Je mets 30 €.
> **Rebondissements :** Si le manager n'est pas là pour le code : « Mais on me l'a déjà fait au chocolat l'année passée ! Bon... appelez-le. » / Si vraiment impossible : « Alors vanille, mais avec des copeaux de chocolat dessus. »

**Résultat : validée** — commande n° 2026-0916 · **19 gestes** environ · **code du manager utilisé 1 fois** (Crème fraîche au chocolat au lieu de vanille, client habitué, manager joint)

### Prise de commande

```
Étape 1 · Nom du client : « Rachid Amrani »
Étape 1 · Téléphone (pavé) : 0485 47 09 36
Étape 1 · Jour de retrait : vendredi 27 novembre
Étape 1 · Heure de retrait : 18:30
« Continuer : les produits »
Étape 2 · Recherche « creme fraiche » → 3 produit(s) : Crème fraîche (4,20 €/pers., sur commande) · Crème fraîche 6P (26,00 €) · Crème fraîche 8P (31,00 €)
Étape 2 · Toucher carte « Crème fraîche » → boutons de taille ouverts
Étape 2 · Bouton de taille « 15 » → ligne : Crème fraîche
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Crème fraîche] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Goût : « Chocolat » → ligne : Crème fraîche
   ↳ APP : ERR_GOUT_RESERVE [ligne 1 : Crème fraîche] — « « Crème fraîche » se fait au goût Vanille. Pour « Chocolat », il faut l’accord du manager : demandez-lui son code, ou remettez Vanille. » — sortie(s) : [Remettre Vanille] [Saisir le code du manager]
Client : « On me l’a déjà fait au chocolat l’année passée ! Appelez-le. » — le manager, joint par téléphone, vient saisir son code.
Étape 2 · CODE DU MANAGER saisi (Crème fraîche au chocolat au lieu de vanille, client habitué, manager joint) → accord « deverrouillageGout » posé sur la ligne, au nom de Karim (manager)
   ↳ APP : AVERT_GOUT_AUTORISE [ligne 1 : Crème fraîche] — « Goût « Chocolat » accepté par Karim (manager). L’accord du manager est enregistré. » — aucune sortie proposée
Étape 2 · Bloc « Sur ce gâteau » : écriture « Bravo Sofiane »
« Continuer : le paiement »
Étape 3 · Acompte au pavé : 30,00 €
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (32,50 €) : 30,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 32,50 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 65,00 €, acompte 30,00 €, reste 35,00 €.
```

### Total annoncé contre l’attente du client

- Total : **65,00 €** annoncés, **65,00 €** attendus → écart **0,00 €**.
- Commande 2026-0916 : acompte enregistré 30,00 € (espèces), reste dû 35,00 €.
- Attente rédigée : Crème fraîche 15 parts × 4,20 € = 63,00 € + Écriture 2,00 € = 65,00 €. Goût Chocolat seulement avec le code du manager (nom + heure tracés), sinon Vanille. Acompte 30,00 € < 32,50 € : avertissement, proposer 32,50 €.

### Bons sortis

`bons/C16-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- ligne 1 « Crème fraîche » : accord du manager (goutAutorisePar = Karim (manager)) — enregistré, imprimé nulle part

### Remarques du vendeur

- Refus du chocolat très clair, deux sorties (« Remettre Vanille », « Saisir le code du manager »). Le manager a dû venir taper son code (joint par téléphone, il était dans le magasin) : sans lui, la vente partait en vanille.
- L’accord du manager n’apparaît sur AUCUN bon : le pâtissier lit « Crème fraîche — GOÛT : CHOCOLAT » sans savoir que c’est une exception validée.
- CODE DU MANAGER UTILISÉ : 1 fois (goût réservé), justifié par le rebondissement « appelez-le ».

---

## C17 — Isabelle Mertens (telephone)

> **Le client dit :** Bonjour, je sais que c'est tard, mais il me faudrait un cake au chocolat pour 20 personnes pour demain matin, c'est pour la classe de mon fils. Sans rien dessus.
> **Retrait souhaité :** demain matin à 7h, avant l'école · **Paiement :** Je paie tout demain en venant, je n'ai pas le temps de passer aujourd'hui.
> **Rebondissements :** « Il n'y a pas de fruits à coque dedans ? Il y a un enfant allergique. » / « Si 7h c'est trop tôt, 7h30 au plus tard. »

**Résultat : validée** — commande n° 2026-0917 · **19 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Isabelle Mertens »
Étape 1 · Téléphone (pavé) : 0472 94 13 58
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : vendredi 20 novembre
   ↳ APP : INFO_COMMANDE_LENDEMAIN — « Commande pour demain : prévenez l’atelier. » — aucune sortie proposée
Étape 1 · Heure de retrait : 07:00
« Continuer : les produits »
Étape 2 · Recherche « cake chocolat » → RIEN (aucune tuile, aucun produit)
Étape 2 · Recherche « cake » → 3 produit(s) : Cake nature (2,90 €/pers., sur commande) · Layer Cake (5,00 €/pers., sur commande) · Number Cake (5,00 €/pers., sur commande)
Étape 2 · Toucher carte « Cake nature » → boutons de taille ouverts
Étape 2 · Bouton de taille « 20 » → ligne : Cake nature
   ↳ APP : ERR_GOUT_MANQUANT [ligne 1 : Cake nature] — « Choisissez le goût pour « Cake nature ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Chocolat » → ligne : Cake nature
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Cake nature] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Bloc « Sur ce gâteau » : « Pas d’écriture » coché
« Continuer : le paiement »
Étape 3 · Remarques : « ALLERGIE : un enfant allergique aux fruits à coque — vérifier avec le pâtissier, rien promis. Paie tout demain au retrait. »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (29,00 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 29,00 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 58,00 €, acompte 0,00 €, reste 58,00 €.
```

### Total annoncé contre l’attente du client

- Total : **58,00 €** annoncés, **58,00 €** attendus → écart **0,00 €**.
- Commande 2026-0917 : acompte enregistré 0,00 € (espèces), reste dû 58,00 €.
- Attente rédigée : Cake nature goût Chocolat 20 parts × 2,90 € = 58,00 €. Retrait vendredi 20/11 à 7h00 (dans les heures d'ouverture). Prévenir l'atelier tout de suite. Acompte 0 € : avertissement. Allergènes : demander au pâtissier, ne rien promettre.

### Bons sortis

`bons/C17-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- « Cake chocolat » : rien. « Cake » → Cake nature, et le chocolat est un goût. Un cake « nature » au chocolat, ça fait drôle à dire au client.
- Allergie aux fruits à coque : aucun endroit prévu. Je l’ai mis dans Remarques — imprimé en petit, dans un cadre pointillé, sous les produits, et absent de l’exemplaire CLIENT (lu dans le code : `mention(..., true)`).
- « Commande pour demain : prévenez l’atelier » : simple information, comme prévu.

---

## C18 — Philippe Wauters (comptoir)

> **Le client dit :** Je viens réserver mes bûches pour le réveillon. Une bûche pistache pour 6, une Matadi pour 8, et dix bûchettes : cinq Matadi, cinq framboise.
> **Retrait souhaité :** le 24 décembre vers 16h · **Paiement :** Je vous laisse 70 €.
> **Rebondissements :** Quand on lui dit que la bûchette Matadi n'existe pas : « Ah. Mousse au chocolat alors, ça se rapproche. » / « Et une bûche pour 12, ça existe ? Non ? Bon, laissez comme ça. »

**Résultat : validée** — commande n° 2026-0918 · **36 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Philippe Wauters »
Étape 1 · Téléphone (pavé) : 0477 31 85 02
Étape 1 · Jour de retrait : jeudi 24 décembre
Étape 1 · Heure de retrait : 16:00
« Continuer : les produits »
Étape 2 · Recherche « buche » → 5 produit(s) : Bûches 4P (24,00 €) · Bûches 6P (36,00 €) · Bûches 8P (48,00 €) · Bûches 10P (60,00 €) · Bûchette (5,90 €)
Étape 2 · Toucher carte « Bûches 6P » → 1 gâteau au bon (sa ligne)
   ↳ APP : ERR_GOUT_MANQUANT [ligne 1 : Bûches 6P] — « Choisissez le goût pour « Bûches 6P ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Pistache » → ligne : Bûches 6P
Étape 2 · Toucher carte « Bûches 8P » → 1 gâteau au bon (sa ligne)
   ↳ APP : ERR_GOUT_MANQUANT [ligne 2 : Bûches 8P] — « Choisissez le goût pour « Bûches 8P ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Matadi » → ligne : Bûches 8P
« Dix bûchettes : cinq Matadi, cinq framboise » — la liste des goûts de la Bûchette n’a pas « Matadi ». Client : « Mousse au chocolat alors. »
Chaque toucher de « Bûchette » crée une NOUVELLE ligne de 1 (une ligne par gâteau), et chaque ligne réclame son goût : 10 touchers, 10 goûts.
Étape 2 · Toucher carte « Bûchette » → 1 gâteau au bon (sa ligne)
   ↳ APP : ERR_GOUT_MANQUANT [ligne 3 : Bûchette] — « Choisissez le goût pour « Bûchette ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Mousse au chocolat » → ligne : Bûchette
Étape 2 · Toucher carte « Bûchette » → 1 gâteau au bon (sa ligne)
   ↳ APP : ERR_GOUT_MANQUANT [ligne 4 : Bûchette] — « Choisissez le goût pour « Bûchette ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Mousse au chocolat » → ligne : Bûchette
Étape 2 · Toucher carte « Bûchette » → 1 gâteau au bon (sa ligne)
   ↳ APP : ERR_GOUT_MANQUANT [ligne 5 : Bûchette] — « Choisissez le goût pour « Bûchette ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Mousse au chocolat » → ligne : Bûchette
Étape 2 · Toucher carte « Bûchette » → 1 gâteau au bon (sa ligne)
   ↳ APP : ERR_GOUT_MANQUANT [ligne 6 : Bûchette] — « Choisissez le goût pour « Bûchette ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Mousse au chocolat » → ligne : Bûchette
Étape 2 · Toucher carte « Bûchette » → 1 gâteau au bon (sa ligne)
   ↳ APP : ERR_GOUT_MANQUANT [ligne 7 : Bûchette] — « Choisissez le goût pour « Bûchette ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Mousse au chocolat » → ligne : Bûchette
Étape 2 · Toucher carte « Bûchette » → 1 gâteau au bon (sa ligne)
   ↳ APP : ERR_GOUT_MANQUANT [ligne 8 : Bûchette] — « Choisissez le goût pour « Bûchette ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Framboise » → ligne : Bûchette
Étape 2 · Toucher carte « Bûchette » → 1 gâteau au bon (sa ligne)
   ↳ APP : ERR_GOUT_MANQUANT [ligne 9 : Bûchette] — « Choisissez le goût pour « Bûchette ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Framboise » → ligne : Bûchette
Étape 2 · Toucher carte « Bûchette » → 1 gâteau au bon (sa ligne)
   ↳ APP : ERR_GOUT_MANQUANT [ligne 10 : Bûchette] — « Choisissez le goût pour « Bûchette ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Framboise » → ligne : Bûchette
Étape 2 · Toucher carte « Bûchette » → 1 gâteau au bon (sa ligne)
   ↳ APP : ERR_GOUT_MANQUANT [ligne 11 : Bûchette] — « Choisissez le goût pour « Bûchette ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Framboise » → ligne : Bûchette
Étape 2 · Toucher carte « Bûchette » → 1 gâteau au bon (sa ligne)
   ↳ APP : ERR_GOUT_MANQUANT [ligne 12 : Bûchette] — « Choisissez le goût pour « Bûchette ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Framboise » → ligne : Bûchette
Le bon compte maintenant 12 lignes. Client : « Et une bûche pour 12, ça existe ? » — cartes : Bûches 4P, 6P, 8P, 10P : non.
« Continuer : le paiement »
Étape 3 · Acompte au pavé : 70,00 €
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (71,50 €) : 70,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 71,50 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 143,00 €, acompte 70,00 €, reste 73,00 €.
```

### Total annoncé contre l’attente du client

- Total : **143,00 €** annoncés, **143,00 €** attendus → écart **0,00 €**.
- Commande 2026-0918 : acompte enregistré 70,00 € (espèces), reste dû 73,00 €.
- Attente rédigée : Bûches 6P Pistache 36,00 € + Bûches 8P Matadi 48,00 € + 10 Bûchette × 5,90 € = 59,00 € (5 Mousse au chocolat, 5 Framboise) = 143,00 €. Retrait jeudi 24/12 à 16h00. Acompte 70,00 € < 71,50 € : avertissement, proposer 71,50 €.

### Bons sortis

`bons/C18-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- rien (tout ce que j’ai saisi se retrouve sur au moins un exemplaire).

### Remarques du vendeur

- DIX BÛCHETTES = dix touchers, dix lignes, dix fois le goût à choisir (la bûchette est traitée comme un gâteau : une ligne par pièce). 20 gestes pour une ligne de carnet « 5 mousse choc, 5 framboise ». Le bon imprime dix fois « 1 × Bûchette / GOÛT : … ».
- Bûchette au goût Matadi : absente de la liste (liste fermée, pas de « Autre… »). Clair.
- Acompte 70,00 € : avertissement à 1,50 € près, bouton « Mettre l’acompte à 71,50 € ».

---

## C19 — Inès Haddad (whatsapp)

> **Le client dit :** Coucou, vous faites toujours les gâteaux en forme de cœur ? J'en voudrais un pour 6 à la framboise pour le 31, et 6 petits cœurs passion. Avec « Bonne année mon amour » sur le grand.
> **Retrait souhaité :** le 31 décembre vers 18h · **Paiement :** Je passe ce week-end pour l'acompte.
> **Rebondissements :** Quand on lui dit que le cœur existe en 5, 7 ou 9 : « Ah, 7 alors. » / « L'écriture sur un cœur c'est possible, il y a la place ? »

**Résultat : validée** — commande n° 2026-0919 · **31 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Inès Haddad »
Étape 1 · Téléphone (pavé) : 0487 52 04 79
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : jeudi 31 décembre
Étape 1 · Heure de retrait : 18:00
« Continuer : les produits »
Étape 2 · Recherche « coeur » → RIEN (aucune tuile, aucun produit)
Étape 2 · Recherche « gateau coeur » → RIEN (aucune tuile, aucun produit)
Étape 2 · Famille « Special fin d'année » → 13 produit(s) : Galette des rois Frangipane 6P (27,00 €) · Galette des rois Frangipane 8P (31,00 €) · Galette des rois Abricot/Frangipane 6P (27,00 €) · Galette des rois Abricot/Frangipane 8P (31,00 €) · Bûches 4P (24,00 €) · Bûches 6P (36,00 €) · Bûches 8P (48,00 €) · Bûches 10P (60,00 €) …
Cliente : « pour 6 » — cartes : Cœurs 5P, 7P, 9P. « Ah, 7 alors. »
Étape 2 · Toucher carte « Cœurs 7P » → 1 gâteau au bon (sa ligne)
   ↳ APP : ERR_GOUT_MANQUANT [ligne 1 : Cœurs 7P] — « Choisissez le goût pour « Cœurs 7P ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Framboise » → ligne : Cœurs 7P
Étape 2 · Bloc « Sur ce gâteau » : écriture « Bonne année mon amour »
« 6 petits cœurs passion » : 6 touchers, 6 lignes, 6 fois le goût.
Étape 2 · Toucher carte « Petit Cœurs » → 1 gâteau au bon (sa ligne)
   ↳ APP : ERR_GOUT_MANQUANT [ligne 3 : Petit Cœurs] — « Choisissez le goût pour « Petit Cœurs ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Passion » → ligne : Petit Cœurs
Étape 2 · Toucher carte « Petit Cœurs » → 1 gâteau au bon (sa ligne)
   ↳ APP : ERR_GOUT_MANQUANT [ligne 4 : Petit Cœurs] — « Choisissez le goût pour « Petit Cœurs ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Passion » → ligne : Petit Cœurs
Étape 2 · Toucher carte « Petit Cœurs » → 1 gâteau au bon (sa ligne)
   ↳ APP : ERR_GOUT_MANQUANT [ligne 5 : Petit Cœurs] — « Choisissez le goût pour « Petit Cœurs ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Passion » → ligne : Petit Cœurs
Étape 2 · Toucher carte « Petit Cœurs » → 1 gâteau au bon (sa ligne)
   ↳ APP : ERR_GOUT_MANQUANT [ligne 6 : Petit Cœurs] — « Choisissez le goût pour « Petit Cœurs ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Passion » → ligne : Petit Cœurs
Étape 2 · Toucher carte « Petit Cœurs » → 1 gâteau au bon (sa ligne)
   ↳ APP : ERR_GOUT_MANQUANT [ligne 7 : Petit Cœurs] — « Choisissez le goût pour « Petit Cœurs ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Passion » → ligne : Petit Cœurs
Étape 2 · Toucher carte « Petit Cœurs » → 1 gâteau au bon (sa ligne)
   ↳ APP : ERR_GOUT_MANQUANT [ligne 8 : Petit Cœurs] — « Choisissez le goût pour « Petit Cœurs ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Passion » → ligne : Petit Cœurs
« Continuer : le paiement »
Étape 3 · Remarques : « Passe ce week-end pour l’acompte (39,70 €). »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (39,70 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 39,70 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 79,40 €, acompte 0,00 €, reste 79,40 €.
```

### Total annoncé contre l’attente du client

- Total : **79,40 €** annoncés, **79,40 €** attendus → écart **0,00 €**.
- Commande 2026-0919 : acompte enregistré 0,00 € (espèces), reste dû 79,40 €.
- Écart d’ACOMPTE : le client annonce 39,70 € à venir (plus tard, en espèces ou par carte) ; rien n’étant reçu, j’ai enregistré 0,00 € et noté la promesse en remarque (aucun champ « acompte promis »).
- Attente rédigée : Cœurs 7P Framboise 42,00 € + Écriture 2,00 € + 6 Petit Cœurs Passion × 5,90 € = 35,40 € → 79,40 €. Retrait jeudi 31/12 à 18h00. Acompte conseillé 39,70 €.

### Bons sortis

`bons/C19-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- JE NE TROUVE PAS : « coeur » ne donne rien, « gateau coeur » non plus. Le produit s’écrit « Cœurs » avec le e dans l’o ; mon clavier écrit « coeur ». Trouvé seulement en ouvrant la famille « Special fin d’année ».
- 6 petits cœurs passion = 6 lignes, 6 goûts (comme les bûchettes).
- Écriture sur un cœur : acceptée, supplément ajouté tout seul. Rien ne dit s’il y a la place sur un 7P.

---

## C20 — Christine Vermeulen (telephone)

> **Le client dit :** Bonjour, pour un goûter au bureau je voudrais des minis : 20 mini éclairs, 20 mini mille-feuilles, 12 mini tartelettes aux fraises et 20 mini bavarois.
> **Retrait souhaité :** jeudi prochain à 13h · **Paiement :** Je règle par carte au retrait, mais je peux donner un acompte par virement si vous voulez.
> **Rebondissements :** Pour les 12 tartelettes : « Minimum 15 ? Bon, mettez 15. » / « Les éclairs moitié chocolat moitié moka, les bavarois un peu de tout. »

**Résultat : validée** — commande n° 2026-0920 · **36 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Christine Vermeulen »
Étape 1 · Téléphone (pavé) : 0479 68 27 14
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : jeudi 26 novembre
Étape 1 · Heure de retrait : 13:00
« Continuer : les produits »
Étape 2 · Recherche « eclair » → 6 produit(s) : Éclair Pistache (3,20 €) · Éclair framboises fraiches (3,20 €) · Éclair framboises (2,60 €) · Éclair Chocolat (2,60 €) · Éclair Moka (2,60 €) · Mini éclair / mille-feuille (1,50 €, sur commande)
Étape 2 · Toucher carte « Mini éclair / mille-feuille » → 1 au bon, pavé de quantité ouvert
   ↳ APP : ERR_QUANTITE_MIN [ligne 1 : Mini éclair / mille-feuille] — « Minimum 15 pièces pour « Mini éclair / mille-feuille ». » — sortie(s) : [Passer à 15 pièces]
Étape 2 · Quantité au pavé : 20 — Mini éclair / mille-feuille (20 mini éclairs)
Étape 2 · Recherche « mille » → 4 produit(s) : Mille-feuille Amande praliné (2,60 €) · Mille-feuille Classique (2,60 €) · Mille-feuille Chocolat (2,60 €) · Mini éclair / mille-feuille (1,50 €, sur commande)
« Mille-feuille » est sur la MÊME carte que l’éclair (« Mini éclair / mille-feuille ») : la retoucher ajoute 1 à la même ligne (21). Je mets 40 au pavé et je détaille en précision.
Étape 2 · Toucher carte « Mini éclair / mille-feuille » → 21 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 40 — Mini éclair / mille-feuille (20 éclairs + 20 mille-feuilles)
Étape 2 · « Précision… » de la ligne Mini éclair / mille-feuille : « 20 éclairs (10 chocolat, 10 moka) + 20 mille-feuilles »
Étape 2 · Recherche « mini tartelette » → 1 produit(s) : Mini tartelette (1,90 €, sur commande)
Étape 2 · Toucher carte « Mini tartelette » → 1 au bon, pavé de quantité ouvert
   ↳ APP : ERR_QUANTITE_MIN [ligne 2 : Mini tartelette] — « Minimum 15 pièces pour « Mini tartelette ». » — sortie(s) : [Passer à 15 pièces]
Étape 2 · Quantité au pavé : 12 — Mini tartelette
Cliente : « Minimum 15 ? Bon, mettez 15. »
   → Vendeur touche la sortie [Passer à 15 pièces]
Étape 2 · « Précision… » de la ligne Mini tartelette : « aux fraises »
Étape 2 · Recherche « mini bavarois » → 2 produit(s) : Bavarois (4,50 €/pers., sur commande) · Mini bavarois (2,50 €, sur commande)
Étape 2 · Toucher carte « Mini bavarois » → 1 au bon, pavé de quantité ouvert
   ↳ APP : ERR_QUANTITE_MIN [ligne 3 : Mini bavarois] — « Minimum 15 pièces pour « Mini bavarois ». » — sortie(s) : [Passer à 15 pièces]
Étape 2 · Quantité au pavé : 20 — Mini bavarois
Étape 2 · « Précision… » de la ligne Mini bavarois : « assortiment, un peu de tout »
« Continuer : le paiement »
Étape 3 · Remarques : « Règle par carte au retrait ; acompte par virement possible si on le demande (69,25 €). »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (69,25 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 69,25 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 138,50 €, acompte 0,00 €, reste 138,50 €.
```

### Total annoncé contre l’attente du client

- Total : **138,50 €** annoncés, **138,50 €** attendus → écart **0,00 €**.
- Commande 2026-0920 : acompte enregistré 0,00 € (espèces), reste dû 138,50 €.
- Attente rédigée : 40 Mini éclair / mille-feuille × 1,50 € = 60,00 € ; 15 Mini tartelette × 1,90 € = 28,50 € ; 20 Mini bavarois × 2,50 € = 50,00 €. Total 138,50 €. Retrait jeudi 26/11 à 13h00. Acompte conseillé 69,25 €.

### Bons sortis

`bons/C20-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- Éclairs et mille-feuilles sont UNE carte : impossible d’avoir deux lignes (le 2e toucher ajoute 1 à la même). Tout le détail (10 chocolat, 10 moka, 20 mille-feuilles) part en précision libre.
- « Mini bavarois » cherché → la première carte est « Bavarois » (le gros gâteau), la bonne est en 2e. La recherche « mini » ramène tous les gâteaux sur commande parce que leur rayon s’appelle « Tarifs (minimum)… ».
- 12 tartelettes : « Passer à 15 pièces », un geste.

---

## C21 — Bilal (whatsapp)

> **Le client dit :** Slt, 9 mini burgers et 10 mini wraps pour samedi 12h. Pas besoin de numéro, je suis sur WhatsApp, vous m'écrivez ici.
> **Retrait souhaité :** samedi à 12h · **Paiement :** Je paie sur place.
> **Rebondissements :** Pour les 9 burgers : « On est 9... ok mettez 10. » / Si on insiste pour le nom complet et le numéro : « Bilal Ziani, 0466 21 90 43, c'est le même numéro que WhatsApp de toute façon. »

**Résultat : validée** — commande n° 2026-0921 · **24 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Bilal »
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : samedi 21 novembre
Étape 1 · Heure de retrait : 12:00
« Continuer : les produits »
Étape 2 · Famille « Salé » → 13 produit(s) : Bestella poulet, 10 personnes (75,00 €, sur commande) · Bestella fruits de mer, 10 personnes (90,00 €, sur commande) · Quiche poulet/saumon, 6 personnes (27,00 €, sur commande) · Bestella poulet / fruits de mer, individuelle (3,90 €, sur commande) · Mini cêpe farcie classique (3,20 €, sur commande) · Mini pizza / quiche (2,80 €, sur commande) · Mini wrap (3,90 €, sur commande) · Mini burger (3,50 €, sur commande) …
Étape 2 · Toucher carte « Mini burger » → 1 au bon, pavé de quantité ouvert
   ↳ APP : ERR_QUANTITE_MIN [ligne 1 : Mini burger] — « Minimum 10 pièces pour « Mini burger ». » — sortie(s) : [Passer à 10 pièces]
Étape 2 · Quantité au pavé : 9 — Mini burger
Client : « On est 9… ok mettez 10. »
   → Vendeur touche la sortie [Passer à 10 pièces]
Étape 2 · Toucher carte « Mini wrap » → 1 au bon, pavé de quantité ouvert
   ↳ APP : ERR_QUANTITE_MIN [ligne 2 : Mini wrap] — « Minimum 10 pièces pour « Mini wrap ». » — sortie(s) : [Passer à 10 pièces]
Étape 2 · Quantité au pavé : 10 — Mini wrap
« Continuer : le paiement »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
Étape 3 · « Qui prend la commande ? » : Nadia
   ↳ APP : ERR_CHAMP_OBLIGATOIRE — « Indiquez un numéro de téléphone. » — sortie(s) : [(champ vide : « Indiquez un numéro de téléphone. »)]
Étape 3 · « Valider la commande » → fenêtre « Il manque : » • Téléphone
Client : « Bilal Ziani, 0466 21 90 43. » — je touche « Téléphone » dans la fenêtre : retour à l’étape 1.
Retour à l’étape 1 (barre d’étapes)
Étape 1 · Nom du client : « Bilal Ziani »
Étape 1 · Téléphone (pavé) : 0466 21 90 43
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (37,00 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 37,00 €]
« Continuer : le paiement »
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 74,00 €, acompte 0,00 €, reste 74,00 €.
```

### Essai à part

```
ESSAI À PART (non enregistré) : même demande par la recherche « mini burger », en touchant la PREMIÈRE carte, « Mini-Burger » (comptoir, même prix).
Étape 2 · Recherche « mini burger » → 2 produit(s) : Mini-Burger (3,50 €) · Mini burger (3,50 €, sur commande)
Étape 2 · Toucher carte « Mini-Burger » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 9 — Mini-Burger
→ 9 pièces acceptées sans aucun message (total 31,50 €) : le minimum de 10 ne porte que sur la carte « Mini burger » sur commande.
```

### Total annoncé contre l’attente du client

- Total : **74,00 €** annoncés, **74,00 €** attendus → écart **0,00 €**.
- Commande 2026-0921 : acompte enregistré 0,00 € (espèces), reste dû 74,00 €.
- Attente rédigée : Ne pas valider sans nom ni téléphone. 10 Mini burger × 3,50 € = 35,00 € ; 10 Mini wrap × 3,90 € = 39,00 €. Total 74,00 €. Retrait samedi 21/11 à 12h00. Acompte 0 € : avertissement (viser 37,00 €).

### Bons sortis

`bons/C21-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- Sans téléphone : la fenêtre « Il manque : • Téléphone » arrive seulement au moment de valider, à l’étape 3. Rien ne m’a arrêtée à l’étape 1 (« Continuer : les produits » passe avec un téléphone vide).
- 9 mini burgers : « Passer à 10 pièces ». Parfait.
- ESSAI : par la recherche, la première carte « Mini-Burger » (comptoir, 3,50 €) accepte 9 pièces sans rien dire. Le minimum se contourne en touchant l’autre carte.
- WhatsApp n’existe pas dans « Commande prise » (Comptoir / Téléphone) : j’ai mis Téléphone.

---

## C22 — Khadija Lahlou (telephone)

> **Le client dit :** Salam, je voudrais commander des pastillas pour dimanche : une grande au poulet, une grande aux fruits de mer, et 15 petites individuelles.
> **Retrait souhaité :** dimanche à 12h30 · **Paiement :** Mon fils passera demain avec 100 €.
> **Rebondissements :** « Les individuelles : 8 poulet et 7 fruits de mer. » / « La grande c'est bien pour 10 personnes ? Parce qu'on sera 20 à table. » / Si on propose une 2e grande : « Non non, avec les individuelles ça ira. »

**Résultat : validée** — commande n° 2026-0922 · **23 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Khadija Lahlou »
Étape 1 · Téléphone (pavé) : 0486 73 11 65
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : dimanche 22 novembre
Étape 1 · Heure de retrait : 12:30
« Continuer : les produits »
Étape 2 · Recherche « pastilla » → RIEN (aucune tuile, aucun produit)
Étape 2 · Recherche « bastella » → 2 produit(s) : Bastella Poulet (3,90 €) · Bastella Fruits de mer (3,90 €)
Étape 2 · Recherche « bestella » → 4 produit(s) : Bestella poulet, 10 personnes (75,00 €, sur commande) · Bestella fruits de mer, 10 personnes (90,00 €, sur commande) · Bestella poulet / fruits de mer, individuelle (3,90 €, sur commande) · Mini bestella poulet / fruits de mer (2,90 €, sur commande)
Étape 2 · Toucher carte « Bestella poulet, 10 personnes » → 1 au bon, pavé de quantité ouvert
Étape 2 · Toucher carte « Bestella fruits de mer, 10 personnes » → 1 au bon, pavé de quantité ouvert
Étape 2 · Toucher carte « Bestella poulet / fruits de mer, individuelle » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 15 — Bestella poulet / fruits de mer, individuelle
Étape 2 · « Précision… » de la ligne Bestella poulet / fruits de mer, individuelle : « 8 poulet, 7 fruits de mer »
« Continuer : le paiement »
Étape 3 · Remarques : « Son fils passe demain avec 100 € d’acompte. Ils seront 20 à table (2e grande refusée par la cliente). »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (111,75 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 111,75 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 223,50 €, acompte 0,00 €, reste 223,50 €.
```

### Total annoncé contre l’attente du client

- Total : **223,50 €** annoncés, **223,50 €** attendus → écart **0,00 €**.
- Commande 2026-0922 : acompte enregistré 0,00 € (espèces), reste dû 223,50 €.
- Écart d’ACOMPTE : le client annonce 100,00 € à venir (plus tard, en espèces ou par carte) ; rien n’étant reçu, j’ai enregistré 0,00 € et noté la promesse en remarque (aucun champ « acompte promis »).
- Attente rédigée : Bestella poulet 10 personnes 75,00 € + Bestella fruits de mer 10 personnes 90,00 € + 15 Bestella individuelle × 3,90 € = 58,50 € → 223,50 €. Retrait dimanche 22/11 à 12h30. Acompte 100,00 € < 111,75 € : avertissement.

### Bons sortis

`bons/C22-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- JE NE TROUVE PAS « pastilla ». « bastella » → deux pièces du comptoir à 3,90 € ; « bestella » → les quatre produits sur commande. Deux orthographes, deux listes différentes : selon ce que je tape, je ne vois pas les grandes.
- Les individuelles : une seule carte « poulet / fruits de mer », le partage 8 / 7 va en précision.
- 100 € apportés demain par le fils : remarque libre.

---

## C23 — Anne-Sophie Goossens (telephone)

> **Le client dit :** Bonsoir, je voudrais deux quiches pour 6, une au saumon et une au poulet, pour demain soir. Je finis tard, je passerais vers 21h.
> **Retrait souhaité :** demain (vendredi) à 21h · **Paiement :** Je paie au retrait.
> **Rebondissements :** Quand on lui dit que le magasin ferme à 20h : « 20h je n'y serai jamais. Alors samedi matin à l'ouverture, c'est quelle heure ? » / « 6h ?! Non, mettez 8h. »

**Résultat : validée** — commande n° 2026-0923 · **19 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Anne-Sophie Goossens »
Étape 1 · Téléphone (pavé) : 0475 14 60 87
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : vendredi 20 novembre (demain)
   ↳ APP : INFO_COMMANDE_LENDEMAIN — « Commande pour demain : prévenez l’atelier. » — aucune sortie proposée
Étape 1 · Heure 21:00 (demandé) : pas de créneau à toucher (créneaux proposés de 06:00 à 20:00, par quart d’heure).
   ↳ DOMAINE (si l’heure arrivait quand même) : ERR_HEURE_HORS_OUVERTURE — « Le magasin est ouvert de 6h00 à 20h00 le vendredi — choisissez une heure dans ces horaires. » — valeur proposée : "20:00"
Cliente : « 20h je n’y serai jamais. Samedi matin à l’ouverture ? … 6h ?! Non, mettez 8h. »
Étape 1 · Jour de retrait : samedi 21 novembre
Étape 1 · Heure de retrait : 08:00
« Continuer : les produits »
Étape 2 · Recherche « quiche » → 4 produit(s) : Quiche 6P Saumon/poulet (27,00 €) · Quiche (morceau) Saumon/poulet (3,50 €) · Quiche poulet/saumon, 6 personnes (27,00 €, sur commande) · Mini pizza / quiche (2,80 €, sur commande)
Deux cartes au même prix : « Quiche 6P Saumon/poulet » (comptoir) et « Quiche poulet/saumon, 6 personnes » (sur commande). Je prends celle marquée sur commande.
Étape 2 · Toucher carte « Quiche poulet/saumon, 6 personnes » × 2 → 2 au bon, pavé de quantité ouvert
Étape 2 · « Précision… » de la ligne Quiche poulet/saumon, 6 personnes : « 1 au saumon, 1 au poulet »
« Continuer : le paiement »
Étape 3 · Remarques : « Paie au retrait. »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (27,00 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 27,00 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 54,00 €, acompte 0,00 €, reste 54,00 €.
```

### Total annoncé contre l’attente du client

- Total : **54,00 €** annoncés, **54,00 €** attendus → écart **0,00 €**.
- Commande 2026-0923 : acompte enregistré 0,00 € (espèces), reste dû 54,00 €.
- Attente rédigée : 2 × Quiche poulet/saumon 6 personnes à 27,00 € = 54,00 € (noter : 1 saumon, 1 poulet). 21h refusé, proposer 20h00 ; choix final samedi 21/11 à 8h00. Acompte 0 € : avertissement (viser 27,00 €).

### Bons sortis

`bons/C23-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- 21h : il n’y a simplement pas de créneau après 20:00 dans la liste. Je n’ai donc jamais vu le message « ouvert de 6h00 à 20h00 » ni la sortie 20h00 : c’est moi qui le dis.
- Deux cartes « quiche 6 personnes » au même prix (comptoir et sur commande). Laquelle pour une commande ?
- « Une au saumon, une au poulet » : précision libre sur une ligne « 2 × ».

---

## C24 — Dominique Maes (comptoir)

> **Le client dit :** Pour le drink de mon club de pétanque, je voudrais un grand pain surprise avec 30 sandwichs dedans. Moitié thon mayonnaise, moitié américain.
> **Retrait souhaité :** samedi 28 novembre à 17h · **Paiement :** C'est 20 €, c'est ça ? Je paie maintenant.
> **Rebondissements :** Quand on lui dit maximum 20 sandwichs par pain : « Ah. Deux pains de 15 alors. » / « Mais les 20 €, c'est avec les sandwichs compris ou c'est juste le pain ? »

**Résultat : validée** — commande n° 2026-0924 · **18 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Dominique Maes »
Étape 1 · Téléphone (pavé) : 0478 90 35 21
Étape 1 · Jour de retrait : samedi 28 novembre
Étape 1 · Heure de retrait : 17:00
« Continuer : les produits »
Étape 2 · Recherche « pain surprise » → 1 produit(s) : Grand pain surprise (20,00 €, sur commande)
Étape 2 · Toucher carte « Grand pain surprise » → 1 au bon, pavé de quantité ouvert
Étape 2 · « Nombre de sandwichs » au pavé : 30
   ↳ APP : AVERT_PAIN_SUPPLEMENTAIRE [ligne 1 : Grand pain surprise] — « Un pain surprise contient au plus 20 sandwichs (30 demandés). Ajoutez un 2ᵉ pain pour les sandwichs en plus. » — sortie(s) : [Ajouter un 2ᵉ pain]
Client : « Ah. Deux pains de 15 alors. »
   → Vendeur touche la sortie [Ajouter un 2ᵉ pain]
Étape 2 · « Précision… » de la ligne Grand pain surprise : « 2 pains de 15 sandwichs : moitié thon mayonnaise, moitié américain préparé »
Client : « Les 20 €, c’est avec les sandwichs compris ou juste le pain ? » — l’écran ne dit rien : 20,00 € le pain, c’est tout ce que je vois. Je réponds « sandwichs compris » sans en être sûre.
« Continuer : le paiement »
Étape 3 · Acompte au pavé : 40,00 €
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 40,00 €, acompte 40,00 €, reste 0,00 €.
```

### Total annoncé contre l’attente du client

- Total : **40,00 €** annoncés, **40,00 €** attendus → écart **0,00 €**.
- Commande 2026-0924 : acompte enregistré 40,00 € (espèces), reste dû 0,00 €.
- Attente rédigée : 30 sandwichs > 20 par pain : proposer un 2e pain. 2 × Grand pain surprise à 20,00 € = 40,00 € (15 sandwichs chacun, thon mayonnaise / américain préparé). Si les sandwichs se paient en plus : à voir avec le gérant (question ouverte). Paiement intégral.

### Bons sortis

`bons/C24-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- ligne 1 « Grand pain surprise » : nombre de sandwichs (30) — enregistré, imprimé nulle part

### Remarques du vendeur

- 30 sandwichs : avertissement clair et bouton « Ajouter un 2ᵉ pain ».
- LE NOMBRE DE SANDWICHS N’EST IMPRIMÉ SUR AUCUN BON. J’ai tapé 30 dans « Nombre de sandwichs » : le bon dit « 2 × Grand pain surprise », point. Heureusement j’avais aussi écrit la précision.
- « Sandwichs compris dans les 20 € ? » : l’écran ne le dit pas (question ouverte au tarif). J’ai encaissé 40,00 € sans savoir.

---

## C25 — Grégory Declercq (whatsapp)

> **Le client dit :** Bonjour, pour une réunion lundi midi il me faut 50 mini-sandwichs garnis : 20 thon piquant, 20 poulet curry et 10 jambon-fromage. Et 5 végétariens en plus si possible, juste fromage.
> **Retrait souhaité :** lundi à 11h45 · **Paiement :** Il me faut une facture au nom de la société, on paie par virement.
> **Rebondissements :** Quand on lui dit que jambon-fromage n'est pas dans la liste : « Qu'est-ce qui s'en rapproche ? Club dinde-fromage, ok. » / Pour les 5 végétariens : « Si c'est compliqué, laissez tomber, mettez 5 fromage-saumon. »

**Résultat : validée** — commande n° 2026-0925 · **19 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Grégory Declercq »
Étape 1 · Téléphone (pavé) : 0494 05 78 32
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : lundi 23 novembre
Étape 1 · Heure de retrait : 11:45
« Continuer : les produits »
Étape 2 · Recherche « mini sandwich » → 1 produit(s) : Mini-sandwichs garnis (2,50 €, sur commande)
Étape 2 · Toucher carte « Mini-sandwichs garnis » → 1 au bon, pavé de quantité ouvert
   ↳ APP : ERR_QUANTITE_MIN [ligne 1 : Mini-sandwichs garnis] — « Minimum 10 pièces pour « Mini-sandwichs garnis ». » — sortie(s) : [Passer à 10 pièces]
Étape 2 · Quantité au pavé : 55 — Mini-sandwichs garnis
Garnitures : pas de boutons de garniture sur la ligne dans cette simulation (liste « garnitures » du manager, en base, non lisible ici) ; le tarif a une liste fermée de 10 garnitures, mais l’écran ne la montre pas : je tape tout dans « Garnitures, précision… ».
Client : jambon-fromage n’existe pas → « Club dinde-fromage, ok » ; végétarien → « mettez 5 fromage-saumon ».
Étape 2 · « Précision… » de la ligne Mini-sandwichs garnis : « 20 Thon piquant, 20 Poulet curry, 10 Club dinde–fromage, 5 Fromage–saumon »
« Continuer : le paiement »
Étape 3 · Remarques : « FACTURE au nom de la société demandée — voir le gérant. Paiement par virement. »
Étape 3 · Acompte au pavé : 68,75 €
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 137,50 €, acompte 68,75 €, reste 68,75 €.
```

### Total annoncé contre l’attente du client

- Total : **137,50 €** annoncés, **137,50 €** attendus → écart **0,00 €**.
- Commande 2026-0925 : acompte enregistré 68,75 € (virement), reste dû 68,75 €.
- Attente rédigée : 55 Mini-sandwichs garnis × 2,50 € = 137,50 € (20 Thon piquant, 20 Poulet curry, 10 Club dinde–fromage, 5 Fromage–saumon), saisis en une ligne assortie. Sans les 5 en plus : 50 × 2,50 € = 125,00 €. Retrait lundi 23/11 à 11h45. Acompte conseillé 68,75 € ; facture : voir le gérant.

### Bons sortis

`bons/C25-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon
- acompte PAR VIREMENT pas encore reçu : les bons internes impriment « ACOMPTE 68,75 € » comme un acompte versé ; seul l’exemplaire CLIENT porte « Communication du virement »

### Remarques du vendeur

- Les 10 garnitures du tarif (liste fermée) ne sont pas proposées en boutons avec des quantités : tout est tapé à la main dans la précision. « Jambon-fromage » ou « végétarien » : rien ne m’empêche de l’écrire.
- Facture au nom de la société : aucun champ. Remarque libre.
- Acompte par virement 68,75 € saisi : imprimé comme versé sur les bons internes.

---

## C26 — Olivier Hermans (telephone)

> **Le client dit :** Bonjour, pour un petit-déjeuner d'équipe sur chantier demain : 40 croissants, 40 pains au chocolat et 20 couques suisses. Je passe à 5h30, on commence tôt.
> **Retrait souhaité :** demain (vendredi) à 5h30 · **Paiement :** Je paie cash en venant.
> **Rebondissements :** Quand on lui dit que ça ouvre à 6h : « 6h pile alors, mais que ce soit prêt. » / « Les suisses, moitié longues moitié rondes. »

**Résultat : validée** — commande n° 2026-0926 · **29 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Olivier Hermans »
Étape 1 · Téléphone (pavé) : 0473 48 22 96
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : vendredi 20 novembre (demain)
   ↳ APP : INFO_COMMANDE_LENDEMAIN — « Commande pour demain : prévenez l’atelier. » — aucune sortie proposée
Étape 1 · Heure 05:30 (demandé) : pas de créneau à toucher (créneaux proposés de 06:00 à 20:00, par quart d’heure).
   ↳ DOMAINE (si l’heure arrivait quand même) : ERR_HEURE_HORS_OUVERTURE — « Le magasin est ouvert de 6h00 à 20h00 le vendredi — choisissez une heure dans ces horaires. » — valeur proposée : "06:00"
Client : « 6h pile alors, mais que ce soit prêt. »
Étape 1 · Heure de retrait : 06:00
« Continuer : les produits »
Étape 2 · Recherche « croissant » → 6 produit(s) : Croissant (1,60 €) · Croissant au chocolat (1,90 €) · Croissant aux amandes (2,30 €) · Croissant à la pâte d'amande (2,30 €) · Mini Croissant (1,30 €) · Croissant et couque a la crème (2,50 €)
Étape 2 · Toucher carte « Croissant » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 40 — Croissant
Étape 2 · Recherche « pain au chocolat » → RIEN (aucune tuile, aucun produit)
Étape 2 · Recherche « chocolat » → tuiles : Matadi chocolat, Mousse chocolat, Bavarois chocolat au lait praliné, Fleur caramel chocolat — 17 produit(s) : Pain chocolat (1,60 €) · Croissant au chocolat (1,90 €) · Coque croquant noisettes chocolat (1,90 €) · Mini Pain chocolat (1,30 €) · Matadi chocolat 4P (20,00 €) · Matadi chocolat 6P (31,00 €) · Matadi chocolat 8P (36,00 €) · Mousse chocolat 4P (20,00 €) …
Étape 2 · Toucher carte « Pain chocolat » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 40 — Pain chocolat
Étape 2 · Recherche « suisse » → 3 produit(s) : Couque suisse longue (1,90 €) · Couque suisse ronde (1,90 €) · Mini Suisse (1,60 €)
Étape 2 · Toucher carte « Couque suisse longue » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 10 — Couque suisse longue
Étape 2 · Toucher carte « Couque suisse ronde » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 10 — Couque suisse ronde
« Continuer : le paiement »
Étape 3 · Remarques : « Paie cash au retrait. À 6h PILE, prêt — prévenir le fournil. »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (83,00 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 83,00 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 166,00 €, acompte 0,00 €, reste 166,00 €.
```

### Total annoncé contre l’attente du client

- Total : **166,00 €** annoncés, **166,00 €** attendus → écart **0,00 €**.
- Commande 2026-0926 : acompte enregistré 0,00 € (espèces), reste dû 166,00 €.
- Attente rédigée : 40 Croissant × 1,60 € = 64,00 € ; 40 Pain chocolat × 1,60 € = 64,00 € ; 10 Couque suisse longue + 10 Couque suisse ronde × 1,90 € = 38,00 €. Total 166,00 €. 5h30 refusé → vendredi 20/11 à 6h00. Prévenir le fournil. Acompte 0 € : avertissement (viser 83,00 €).

### Bons sortis

`bons/C26-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- JE NE TROUVE PAS « pain au chocolat » : zéro résultat (le produit s’appelle « Pain chocolat », le mot « au » fait échouer la recherche). J’ai retapé « chocolat » : 17 produits et 4 tuiles de gâteaux, le bon est en premier.
- 5h30 : pas de créneau avant 06:00. Même remarque que pour 21h.
- « Prévenez l’atelier » pour demain : l’écran le dit, mais ne prévient personne.

---

## C27 — Mustapha Benhaddou (comptoir)

> **Le client dit :** Pour dimanche matin tôt, il me faut 30 pistolets blancs, 10 baguettes blanches, 5 grands pains gris coupés et 20 sandwichs mous. C'est pour le club de foot.
> **Retrait souhaité :** dimanche à 6h30 · **Paiement :** Un acompte pour du pain ? Non, je ne paie pas d'avance, je suis client depuis dix ans. Je paie dimanche.
> **Rebondissements :** Si on insiste gentiment : « Non. Notez mon nom, vous me connaissez. » / « Ah, et 3 cramiques aussi. »

**Résultat : validée** — commande n° 2026-0927 · **33 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Mustapha Benhaddou »
Étape 1 · Téléphone (pavé) : 0483 26 59 40
Étape 1 · Jour de retrait : dimanche 22 novembre
Étape 1 · Heure de retrait : 06:30
« Continuer : les produits »
Étape 2 · Recherche « pistolet » → 2 produit(s) : Pistolet blanc (0,70 €) · Pistolet gris (0,70 €)
Étape 2 · Toucher carte « Pistolet blanc » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 30 — Pistolet blanc
Étape 2 · Recherche « baguette » → 5 produit(s) : Baguette grise (1,40 €) · Baguette blanche (1,40 €) · Baguette Sésames (1,60 €) · Baguette Céréales (1,80 €) · Baguette au levain (2,10 €)
Étape 2 · Toucher carte « Baguette blanche » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 10 — Baguette blanche
Étape 2 · Recherche « pain gris » → 10 produit(s) : Pain Marocain gris (1,40 €) · Pain Shawarma - bagnat gris (0,60 €) · Grand pain gris (2,90 €) · Grand pain demi gris (2,90 €) · Grand pain campagne Demi Gris (2,90 €) · Grand pain campagne Gris (2,90 €) · Petit pain gris (1,90 €) · Petit pain demi gris (1,90 €) …
Étape 2 · Toucher carte « Grand pain gris » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 5 — Grand pain gris
Étape 2 · « Précision… » de la ligne Grand pain gris : « coupés »
Étape 2 · Recherche « sandwich mou » → 1 produit(s) : Sandwich mou (0,70 €)
Étape 2 · Toucher carte « Sandwich mou » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 20 — Sandwich mou
Client : « Ah, et 3 cramiques aussi. »
Étape 2 · Recherche « cramique » → 1 produit(s) : Cramique (3,50 €)
Étape 2 · Toucher carte « Cramique » × 3 → 3 au bon, pavé de quantité ouvert
« Continuer : le paiement »
Étape 3 · Remarques : « Client depuis 10 ans, refuse l’acompte, paie dimanche. »
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (37,00 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 37,00 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 74,00 €, acompte 0,00 €, reste 74,00 €.
```

### Total annoncé contre l’attente du client

- Total : **74,00 €** annoncés, **74,00 €** attendus → écart **0,00 €**.
- Commande 2026-0927 : acompte enregistré 0,00 € (espèces), reste dû 74,00 €.
- Attente rédigée : 30 Pistolet blanc × 0,70 € = 21,00 € ; 10 Baguette blanche × 1,40 € = 14,00 € ; 5 Grand pain gris × 2,90 € = 14,50 € ; 20 Sandwich mou × 0,70 € = 14,00 € ; 3 Cramique × 3,50 € = 10,50 €. Total 74,00 €. Retrait dimanche 22/11 à 6h30. Acompte 0 € accepté avec avertissement (viser 37,00 €).

### Bons sortis

`bons/C27-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- rien (tout ce que j’ai saisi se retrouve sur au moins un exemplaire).

### Remarques du vendeur

- Client qui refuse l’acompte : « Pas d’acompte », avertissement, la commande passe. Comme prévu.
- « Pain gris » : dix cartes (marocain, shawarma, grand, petit, campagne…). J’ai pris « Grand pain gris » parce que je connais.
- « Coupés » : précision libre sur la ligne.

---

## C28 — Zineb Alaoui (comptoir)

> **Le client dit :** Pour les fiançailles de mon fils, je voudrais des cornes de gazelle, un kilo et demi, 750 grammes de sellou et un demi-kilo de sablés.
> **Retrait souhaité :** vendredi 27 novembre à 10h · **Paiement :** Je vous laisse 40 €.
> **Rebondissements :** « En fait non, pour les cornes de gazelle mettez-m'en 30 pièces plutôt, c'est plus facile à compter. » / Quand on lui explique que c'est au poids : « Alors laissez un kilo et demi. Et ajoutez un kilo de halwa. »

**Résultat : validée** — commande n° 2026-0928 · **27 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Zineb Alaoui »
Étape 1 · Téléphone (pavé) : 0489 37 64 15
Étape 1 · Jour de retrait : vendredi 27 novembre
Étape 1 · Heure de retrait : 10:00
« Continuer : les produits »
Étape 2 · Recherche « corne » → 1 produit(s) : Corne de gazelle (28,00 €/kg)
Étape 2 · Toucher carte « Corne de gazelle » → pavé du POIDS ouvert (pas de +1)
Étape 2 · Poids au pavé décimal : 1,5 kg — Corne de gazelle
Étape 2 · Recherche « sellou » → 1 produit(s) : Sellou (22,00 €/kg)
Étape 2 · Toucher carte « Sellou » → pavé du POIDS ouvert (pas de +1)
Étape 2 · Poids au pavé décimal : 0,75 kg — Sellou
Étape 2 · Recherche « sable » → 7 produit(s) : Sablé orientaux (22,00 €/kg) · Sablé poire frangipane (3,30 €) · Sablé frangipane (3,30 €) · Sablé breton pistache (3,30 €) · Sablé breton praliné (3,30 €) · Sablé breton framboise (3,30 €) · Sablé breton café caramel (3,30 €)
Étape 2 · Toucher carte « Sablé orientaux » → pavé du POIDS ouvert (pas de +1)
Étape 2 · Poids au pavé décimal : 0,5 kg — Sablé orientaux
Cliente : « Pour les cornes, mettez-m’en 30 pièces plutôt. » — la ligne n’a qu’un champ « Poids » (pavé décimal, « kg ») : aucun moyen de saisir des pièces. « Alors laissez un kilo et demi. Et ajoutez un kilo de halwa. »
Étape 2 · Recherche « halwa » → 1 produit(s) : Halwa arbia (25,00 €/kg)
Étape 2 · Toucher carte « Halwa arbia » → pavé du POIDS ouvert (pas de +1)
Étape 2 · Poids au pavé décimal : 1 kg — Halwa arbia
« Continuer : le paiement »
Étape 3 · Acompte au pavé : 40,00 €
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (47,25 €) : 40,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 47,25 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 94,50 €, acompte 40,00 €, reste 54,50 €.
```

### Total annoncé contre l’attente du client

- Total : **94,50 €** annoncés, **94,50 €** attendus → écart **0,00 €**.
- Commande 2026-0928 : acompte enregistré 40,00 € (espèces), reste dû 54,50 €.
- Attente rédigée : Corne de gazelle 1,5 kg × 28,00 € = 42,00 € ; Sellou 0,75 kg × 22,00 € = 16,50 € ; Sablé orientaux 0,5 kg × 22,00 € = 11,00 € ; Halwa arbia 1 kg × 25,00 € = 25,00 €. Total 94,50 €. Refuser la saisie à la pièce. Acompte 40,00 € < 47,25 € : avertissement.

### Bons sortis

`bons/C28-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- rien (tout ce que j’ai saisi se retrouve sur au moins un exemplaire).

### Remarques du vendeur

- Au kilo : le pavé du poids s’ouvre, pas de « +1 ». « 30 pièces » est impossible à saisir : très bien.
- Le message de confirmation préparé pour WhatsApp écrit « 1500 × Corne de gazelle », « 750 × Sellou » (les grammes pris pour une quantité). Exécuté : voir le rapport.

---

## C29 — Kevin Dubois (telephone)

> **Le client dit :** Salut, pour un tournoi samedi il me faut 25 sandwichs : 10 thon piquant, 10 poulet andalouse, 5 clubs. Et à boire : 24 canettes de Coca Zéro, 6 grandes bouteilles de Coca et 12 petites eaux.
> **Retrait souhaité :** samedi à 11h30 · **Paiement :** Je passe ce soir avant la fermeture avec 80 €.
> **Rebondissements :** Si on lui dit qu'il n'y a que « Canette classic » : « C'est quoi classic ? Peu importe, des canettes, mélangez. » / « L'eau, la moins chère. » / « Vous mettez un œuf dans les thons piquants. »

**Résultat : validée** — commande n° 2026-0929 · **47 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Kevin Dubois »
Étape 1 · Téléphone (pavé) : 0470 82 49 03
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : samedi 21 novembre
Étape 1 · Heure de retrait : 11:30
« Continuer : les produits »
Étape 2 · Recherche « thon piquant » → 2 produit(s) : Salade thon piquant (3,30 €) · THON PIQUANT (4,50 €)
Étape 2 · Toucher carte « THON PIQUANT » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 10 — THON PIQUANT
Étape 2 · « Précision… » de la ligne THON PIQUANT : « avec un œuf dans chacun »
Étape 2 · Recherche « poulet andalouse » → 2 produit(s) : Salade poulet andalouse (3,30 €) · POULET ANDALOUSE (4,50 €)
Étape 2 · Toucher carte « POULET ANDALOUSE » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 10 — POULET ANDALOUSE
Étape 2 · Recherche « club » → 1 produit(s) : CLUB SANDWICH (4,90 €)
Étape 2 · Toucher carte « CLUB SANDWICH » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 5 — CLUB SANDWICH
Étape 2 · Recherche « oeuf » → 2 produit(s) : Salami boeuf (2,30 €) · Supplément (oeuf) (0,60 €)
Étape 2 · Toucher carte « Supplément (oeuf) » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 10 — Supplément (oeuf)
Étape 2 · Recherche « coca zero » → RIEN (aucune tuile, aucun produit)
Étape 2 · Recherche « canette » → 3 produit(s) : Canette (33cl) classic (1,30 €) · Cécémel (Canette) (1,80 €) · Canette Fristi (Canette) (1,80 €)
Client : « C’est quoi classic ? Peu importe, des canettes, mélangez. »
Étape 2 · Toucher carte « Canette (33cl) classic » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 24 — Canette (33cl) classic
Étape 2 · « Précision… » de la ligne Canette (33cl) classic : « Coca Zéro demandé — à défaut, mélangées »
Étape 2 · Recherche « coca » → 1 produit(s) : Grande Bouteille (1,5L) Coca (2,80 €)
Étape 2 · Toucher carte « Grande Bouteille (1,5L) Coca » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 6 — Grande Bouteille (1,5L) Coca
Étape 2 · Recherche « eau » → 71 produit(s) : Grande Bouteille d’eau SPA 1,5L (1,50 €) · Quiche (morceau) Saumon/poulet (3,50 €) · Supplément Photo (15,00 €) · Supplément Ecriture (2,00 €) · Croûte Fruits 6P (27,00 €) · Croûte Fraises 6P (27,00 €) · Croûte framboises 6P (27,00 €) · Croûte Fruits 8P (32,00 €) …
Étape 2 · Recherche « cristaline » → 1 produit(s) : Cristaline (0,50 €)
Étape 2 · Toucher carte « Cristaline » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 12 — Cristaline
« Continuer : le paiement »
Étape 3 · Remarques : « Passe ce soir avant la fermeture avec 80 € d’acompte. »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (87,25 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 87,25 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 174,50 €, acompte 0,00 €, reste 174,50 €.
```

### Total annoncé contre l’attente du client

- Total : **174,50 €** annoncés, **174,50 €** attendus → écart **0,00 €**.
- Commande 2026-0929 : acompte enregistré 0,00 € (espèces), reste dû 174,50 €.
- Écart d’ACOMPTE : le client annonce 80,00 € à venir (plus tard, en espèces ou par carte) ; rien n’étant reçu, j’ai enregistré 0,00 € et noté la promesse en remarque (aucun champ « acompte promis »).
- Attente rédigée : 10 THON PIQUANT + 10 POULET ANDALOUSE × 4,50 € = 90,00 € ; 5 CLUB SANDWICH × 4,90 € = 24,50 € ; 10 Supplément (oeuf) × 0,60 € = 6,00 € ; 24 Canette (33cl) classic × 1,30 € = 31,20 € ; 6 Grande Bouteille (1,5L) Coca × 2,80 € = 16,80 € ; 12 Cristaline × 0,50 € = 6,00 €. Total 174,50 €. Acompte 80,00 € < 87,25 € : avertissement.

### Bons sortis

`bons/C29-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- « Coca zéro » : rien. « Canette » : une seule « Canette (33cl) classic ». Le choix du client part en précision.
- « Eau » : 71 résultats (la recherche trouve « eau » dans « Gâteaux et tartes ») dont la Spa 1,5 L en premier ; la petite eau, c’est « Cristaline », qu’il faut connaître.
- L’œuf : une ligne « Supplément (oeuf) » × 10, séparée des sandwichs ; j’ai aussi écrit « avec un œuf » sur la ligne THON PIQUANT, sinon l’atelier ne sait pas dans lesquels.
- 80 € ce soir : remarque libre.

---

## C30 — Abdelkader Messaoudi (comptoir)

> **Le client dit :** Un bavarois fruits de la passion pour 20 personnes. Mais vous me faites un prix, hein : 70 € tout rond, je prends souvent chez vous.
> **Retrait souhaité :** dimanche 29 novembre à 15h · **Paiement :** Si vous me le faites à 70, je paie tout maintenant en cash.
> **Rebondissements :** Devant le refus : « 4 € par personne, allez, 80 €. » / « Sinon je vais en face. » / Finalement : « Bon. Faites-le pour 15 alors, ça fera moins cher. »

**Résultat : validée** — commande n° 2026-0930 · **19 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Abdelkader Messaoudi »
Étape 1 · Téléphone (pavé) : 0484 60 13 77
Étape 1 · Jour de retrait : dimanche 29 novembre
Étape 1 · Heure de retrait : 15:00
« Continuer : les produits »
Étape 2 · Recherche « passion » → tuiles : Bavarois fruits de la passion — 7 produit(s) : Bavarois fruits de la passion 4P (20,00 €) · Bavarois fruits de la passion 6P (31,00 €) · Bavarois fruits de la passion 8P (36,00 €) · Entremet 8P Passion (48,00 €) · Tartelette fruits de la passion (4,70 €) · Bavarois fruits de la passion (4,80 €) · Trompe l'oeil Passion (8,90 €)
Étape 2 · Toucher la tuile « Bavarois fruits de la passion » → gâteau au bon, goût « Fruits de la passion » déjà posé, boutons de taille ouverts
Étape 2 · Bouton de taille « 20 » → ligne : Bavarois
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Bavarois] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Total annoncé : 90,00 €. Client : « 70 € tout rond. » — 70 / 20 = 3,50 € : j’essaie de baisser le prix par personne.
Étape 2 · « Prix / pers. » au pavé : 3,50 €
   ↳ APP : ERR_SOUS_PLANCHER [ligne 1 : Bavarois] — « Le prix par personne de « Bavarois » commence à 4,50 €. Remettez 4,50 €, ou demandez l’accord du manager. » — sortie(s) : [Remettre 4,50 € par personne] [Saisir le code du manager]
Client : « 4 € par personne, allez, 80 €. » — même refus (4,00 € < 4,50 €). Le manager n’est pas là : pas de code. « Bon. Faites-le pour 15 alors. »
   → Vendeur touche la sortie [Remettre 4,50 € par personne]
Étape 2 · Bouton de taille « 15 » → ligne : Bavarois
Étape 2 · Bloc « Sur ce gâteau » : « Pas d’écriture » coché
« Continuer : le paiement »
Étape 3 · Acompte au pavé : 67,50 €
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 67,50 €, acompte 67,50 €, reste 0,00 €.
```

### Total annoncé contre l’attente du client

- Total : **67,50 €** annoncés, **67,50 €** attendus → écart **0,00 €**.
- Commande 2026-0930 : acompte enregistré 67,50 € (espèces), reste dû 0,00 €.
- Attente rédigée : 20 parts × 4,50 € = 90,00 € ; ni 70 € ni 80 € (4,00 €/pers) ne sont acceptables sans le gérant. Sortie honnête : 15 parts × 4,50 € = 67,50 € (carré). Choix final 67,50 €, payé en entier. Retrait dimanche 29/11 à 15h00.

### Bons sortis

`bons/C30-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- rien (tout ce que j’ai saisi se retrouve sur au moins un exemplaire).

### Remarques du vendeur

- Prix négocié : refus net sous 4,50 €, avec « Remettre 4,50 € par personne » et « Saisir le code du manager ». Je n’ai pas cédé, et je n’ai rien eu à calculer.

---

## C31 — Josiane Lefèvre (comptoir)

> **Le client dit :** Une croûte aux fraises pour dimanche, s'il vous plaît. Vous la faites pour 10 ? Tenez, voilà 50 €, comme ça c'est payé.
> **Retrait souhaité :** dimanche à 10h30 · **Paiement :** Elle tend un billet de 50 € comme acompte, sans connaître le prix.
> **Rebondissements :** Quand on lui dit que la croûte existe en 6 et 8 : « Alors la 8. » / « Gardez les 50, vous me rendrez dimanche. » / Si on refuse : « Bon, rendez-moi la monnaie alors. »

**Résultat : validée** — commande n° 2026-0931 · **14 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Josiane Lefèvre »
Étape 1 · Téléphone (pavé) : 0476 55 08 29
Étape 1 · Jour de retrait : dimanche 22 novembre
Étape 1 · Heure de retrait : 10:30
« Continuer : les produits »
Étape 2 · Recherche « croute fraises » → tuiles : Croûte Fraises — 2 produit(s) : Croûte Fraises 6P (27,00 €) · Croûte Fraises 8P (32,00 €)
Étape 2 · Tuile « Croûte Fraises » : boutons proposés [6P] [8P] — pas de « 10P ».
Cliente : « Alors la 8. »
Étape 2 · Toucher le bouton « 8P » de la tuile « Croûte Fraises » : « Croûte Fraises 8P » → 1 gâteau au bon (sa ligne)
« Continuer : le paiement »
Étape 3 · Acompte au pavé : 50,00 €
   ↳ APP : ERR_ACOMPTE_SUPERIEUR_TOTAL — « L’acompte (50,00 €) dépasse le total de la commande (32,00 €). Ramenez l’acompte à 32,00 € au maximum. » — sortie(s) : [Ramener l’acompte à 32,00 €]
Cliente : « Gardez les 50, vous me rendrez dimanche. » — refusé par l’écran. « Bon, rendez-moi la monnaie alors. » (18,00 € à rendre, calculé de tête)
   → Vendeur touche la sortie [Ramener l’acompte à 32,00 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 32,00 €, acompte 32,00 €, reste 0,00 €.
```

### Total annoncé contre l’attente du client

- Total : **32,00 €** annoncés, **32,00 €** attendus → écart **0,00 €**.
- Commande 2026-0931 : acompte enregistré 32,00 € (espèces), reste dû 0,00 €.
- Attente rédigée : Croûte en 10 : pas au tarif, à voir avec le gérant ; proposer Croûte Fraises 8P = 32,00 €. Acompte 50,00 € > 32,00 € : refusé, encaisser au maximum 32,00 € (payé en entier) et rendre 18,00 €. Retrait dimanche 22/11 à 10h30.

### Bons sortis

`bons/C31-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- rien (tout ce que j’ai saisi se retrouve sur au moins un exemplaire).

### Remarques du vendeur

- Croûte en 10 : la tuile ne propose que 6P et 8P, pas de message. Clair.
- Billet de 50 € : « L’acompte dépasse le total », bouton « Ramener l’acompte à 32,00 € ». La monnaie à rendre (18,00 €) n’est pas affichée.

---

## C32 — Nadia Belkacem (whatsapp)

> **Le client dit :** Bonjour, je voudrais une mousse au chocolat pour 6 avec la photo de mon fils imprimée dessus, je vous l'envoie ici. Et écrit « 5 ans Ilyès ».
> **Retrait souhaité :** samedi à 15h · **Paiement :** Je vous fais un Payconiq de 25 €.
> **Rebondissements :** « La photo est un peu floue, ça ira ? » / « Vous pouvez mettre deux photos ? Une de lui bébé aussi. » / Si deux photos ne vont pas : « Laissez, une seule. »

**Résultat : validée** — commande n° 2026-0932 · **22 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Nadia Belkacem »
Étape 1 · Téléphone (pavé) : 0488 91 27 50
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : samedi 21 novembre
Étape 1 · Heure de retrait : 15:00
« Continuer : les produits »
Étape 2 · Recherche « mousse chocolat » → tuiles : Mousse chocolat — 4 produit(s) : Mousse chocolat 4P (20,00 €) · Mousse chocolat 6P (31,00 €) · Mousse chocolat 8P (36,00 €) · Mousse chocolat (4,80 €)
Étape 2 · Toucher la tuile « Mousse chocolat » → gâteau au bon, goût « Mousse chocolat » déjà posé, boutons de taille ouverts
Étape 2 · Bouton de taille « 6 » (affiché avec 31,00 €, prix du comptoir) → ligne : Mousse chocolat 6P
   ↳ APP : ERR_FORME_MANQUANTE [ligne 1 : Mousse chocolat 6P] — « Choisissez la forme de « Mousse chocolat 6P » : carré ou rond. » — sortie(s) : [(champ vide : « À remplir : forme (carré ou rond) »)]
Étape 2 · Forme : Rond
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Mousse chocolat 6P] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Bloc « Sur ce gâteau » : écriture « 5 ans Ilyès »
Étape 2 · Bloc « Sur ce gâteau » : « Photo à imprimer sur ce gâteau » coché
Cliente : « Deux photos, une de lui bébé aussi ? » — une seule case « Photo à imprimer sur ce gâteau » par gâteau, pas de quantité. « Laissez, une seule. »
Étape 2 · « Précision… » de la ligne Mousse chocolat 6P : « Photo à imprimer reçue sur WhatsApp (un peu floue : vérifier la qualité) »
Paiement : « un Payconiq de 25 € » — l’écran ne connaît que Espèces / Virement (et « Téléphone » a mis Virement d’office). L’argent arrive tout de suite : je mets Espèces, faute de mieux.
« Continuer : le paiement »
Étape 3 · Case « Photo d’exemple envoyée sur WhatsApp » cochée
Étape 3 · Paiement : Espèces
Étape 3 · Acompte au pavé : 25,00 €
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 48,00 €, acompte 25,00 €, reste 23,00 €.
```

### Total annoncé contre l’attente du client

- Total : **48,00 €** annoncés, **48,00 €** attendus → écart **0,00 €**.
- Commande 2026-0932 : acompte enregistré 25,00 € (espèces), reste dû 23,00 €.
- Attente rédigée : Mousse chocolat 6P 31,00 € + Photo 15,00 € + Écriture 2,00 € = 48,00 €. Une seule photo par gâteau ; noter que la photo arrive par WhatsApp et vérifier sa qualité. Retrait samedi 21/11 à 15h00. Acompte 25,00 € ≥ 24,00 €.

### Bons sortis

`bons/C32-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- Photo à imprimer : une case, le supplément 15,00 € s’ajoute seul. Deux photos : impossible, une seule case.
- La photo elle-même reste sur WhatsApp : le bon dit « PHOTO À IMPRIMER SUR CE GÂTEAU » et « Photo d’exemple sur WhatsApp — à réclamer au manager ». Deux mentions, zéro fichier.
- Payconiq : ni Espèces ni Virement. J’ai mis Espèces pour que l’acompte compte comme reçu.

---

## C33 — Laura Jacobs (whatsapp)

> **Le client dit :** Hello ! Je vous envoie une photo d'un gâteau licorne trouvé sur Pinterest, tout en pâte à sucre avec la corne dorée et les fleurs. Vous savez faire ça pour 25 personnes ? Chocolat blanc framboise à l'intérieur.
> **Retrait souhaité :** samedi 5 décembre à 13h · **Paiement :** Dites-moi le prix d'abord, je verse l'acompte après.
> **Rebondissements :** « Il faut écrire « Zoé 7 ans » sur le socle. » / Si on parle de prix : « Ouh, c'est cher la pâte à sucre. Et sans pâte à sucre, juste la corne et les oreilles ? » / « Bon, je prends avec pâte à sucre, c'est pour ses 7 ans. »

**Résultat : validée** — commande n° 2026-0933 · **28 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Laura Jacobs »
Étape 1 · Téléphone (pavé) : 0495 13 86 44
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : samedi 5 décembre
Étape 1 · Heure de retrait : 13:00
« Continuer : les produits »
Étape 2 · Recherche « licorne » → RIEN (aucune tuile, aucun produit)
Étape 2 · Recherche « pate a sucre » → 1 produit(s) : Pâte à sucre (6,00 €/pers., sur commande)
Rien pour « licorne ». Tout en pâte à sucre = Layer Cake + Pâte à sucre : je passe par la famille « Gâteau ».
Étape 2 · Famille « Gâteau » → tuiles : Fraisier, Matadi chocolat, Mousse chocolat, Forêt noire, Bavarois framboise, Bavarois fruits de la passion, Bavarois mangue, Bavarois fraise, Bavarois chocolat au lait praliné, Fleur caramel chocolat, Croûte Fraises, Croûte framboises, Croûte Fruits, Tarte 6P, Entremet 8P, Trompe l'oeil XXL 4P — 14 produit(s) : Cake nature (2,90 €/pers., sur commande) · Crème fraîche (4,20 €/pers., sur commande) · Bavarois (4,50 €/pers., sur commande) · Layer Cake (5,00 €/pers., sur commande) · Number Cake (5,00 €/pers., sur commande) · Pièce montée 2 étages (5,60 €/pers., sur commande) · Pièce montée 3 étages (5,60 €/pers., sur commande) · Entremet (6,90 €/pers., sur commande) …
Étape 2 · Toucher carte « Layer Cake » → boutons de taille ouverts
Étape 2 · Bouton de taille « 25 » → ligne : Layer Cake
   ↳ APP : ERR_GOUT_MANQUANT [ligne 1 : Layer Cake] — « Choisissez le goût pour « Layer Cake ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goût : « Chocolat blanc framboise » (tapé dans « Autre… ») → ligne : Layer Cake
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Layer Cake] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Case « Pâte à sucre (6,00 €/pers.) » cochée (affichée sous le gâteau n° 1 du bon)
Étape 2 · Bloc « Sur ce gâteau » : écriture « Zoé 7 ans »
Étape 2 · « Précision… » de la ligne Layer Cake : « Licorne (modèle Pinterest) : corne dorée, oreilles, fleurs en pâte à sucre. Écriture sur le socle. »
Total annoncé : 277,00 €. Cliente : « Ouh, c’est cher. Et sans pâte à sucre, juste la corne et les oreilles ? » — je décoche pour lui dire le prix…
Étape 2 · Case « Pâte à sucre (6,00 €/pers.) » décochée (affichée sous le gâteau n° 1 du bon)
… 127,00 €. « Bon, je prends avec pâte à sucre. »
Étape 2 · Case « Pâte à sucre (6,00 €/pers.) » cochée (affichée sous le gâteau n° 1 du bon)
« Continuer : le paiement »
Étape 3 · Remarques : « Corne et modelages hors tarif : prix à confirmer par le responsable AVANT de confirmer à la cliente. Acompte après accord sur le prix. »
Étape 3 · Case « Photo d’exemple envoyée sur WhatsApp » cochée
Étape 3 · Case « Demande inhabituelle (ingrédient particulier, moule spécial…) » cochée
   ↳ APP : AVERT_COMMANDE_INHABITUELLE — « Commande inhabituelle : demandez d’abord l’accord du manager avant de confirmer au client. Le client peut aussi commander par WhatsApp. » — sortie(s) : [(Appeler le manager ou proposer WhatsApp)]
Étape 3 · Case « Zone pour dessiner sur le bon » cochée
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (138,50 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 138,50 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 277,00 €, acompte 0,00 €, reste 277,00 €.
```

### Total annoncé contre l’attente du client

- Total : **277,00 €** annoncés, **277,00 €** attendus → écart **0,00 €**.
- Commande 2026-0933 : acompte enregistré 0,00 € (virement), reste dû 277,00 €.
- Attente rédigée : Base calculable : Layer Cake 25 parts × 5,00 € = 125,00 € + Pâte à sucre 25 × 6,00 € = 150,00 € + Écriture 2,00 € = 277,00 €. Corne et modelages : hors tarif, appeler le responsable avant de confirmer (à voir). Goût : Framboise (chocolat blanc en remarque). Acompte conseillé 138,50 €.

### Bons sortis

`bons/C33-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- Hors catalogue : je m’en sors avec Layer Cake + Pâte à sucre + précision libre + « Demande inhabituelle » + « Zone pour dessiner ». Le prix de la corne et des modelages n’existe nulle part : 277,00 € est un total que je sais faux (trop bas).
- La case Pâte à sucre se coche et se décoche pour comparer les prix : pratique.
- Goût composé « chocolat blanc framboise » : tapé dans « Autre… ».
- « Écriture sur le socle » : l’écriture est « sur ce gâteau » ; précisé à la main.

---

## C34 — Soufiane Kabbaj (whatsapp)

> **Le client dit :** Bjr un bavarois framboise 6 pers pour dimanche. Vous écrivez exactement ça svp : « Joyeu aniversaire a notre maman cheri Khadija, 60 ans de boneur, on t'aime fort fort fort ».
> **Retrait souhaité :** dimanche à 14h · **Paiement :** Je paye en venant le chercher.
> **Rebondissements :** Si on lui signale les fautes : « Non non, laissez comme ça, c'est ma petite sœur qui a écrit le texte, c'est fait exprès. » / Si on lui dit que c'est long : « Écrivez plus petit. »

**Résultat : validée** — commande n° 2026-0934 · **20 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Soufiane Kabbaj »
Étape 1 · Téléphone (pavé) : 0467 30 72 18
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : dimanche 22 novembre
Étape 1 · Heure de retrait : 14:00
« Continuer : les produits »
Étape 2 · Recherche « bavarois framboise » → tuiles : Bavarois framboise — 4 produit(s) : Bavarois framboise 4P (20,00 €) · Bavarois framboise 6P (31,00 €) · Bavarois framboise 8P (36,00 €) · Bavarois framboise (4,80 €)
Étape 2 · Toucher la tuile « Bavarois framboise » → gâteau au bon, goût « Framboise » déjà posé, boutons de taille ouverts
Étape 2 · Bouton de taille « 6 » (affiché avec 31,00 €, prix du comptoir) → ligne : Bavarois framboise 6P
   ↳ APP : ERR_FORME_MANQUANTE [ligne 1 : Bavarois framboise 6P] — « Choisissez la forme de « Bavarois framboise 6P » : carré ou rond. » — sortie(s) : [(champ vide : « À remplir : forme (carré ou rond) »)]
Étape 2 · Forme : Rond
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Bavarois framboise 6P] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Bloc « Sur ce gâteau » : écriture « Joyeu aniversaire a notre maman cheri Khadija, 60 ans de boneur, on t'aime fort fort fort »
Étape 2 · « Précision… » de la ligne Bavarois framboise 6P : « Texte à recopier TEL QUEL (fautes voulues par le client), écrire petit »
« Continuer : le paiement »
Étape 3 · Remarques : « Paie au retrait. »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (16,50 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 16,50 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 33,00 €, acompte 0,00 €, reste 33,00 €.
```

### Total annoncé contre l’attente du client

- Total : **33,00 €** annoncés, **33,00 €** attendus → écart **0,00 €**.
- Commande 2026-0934 : acompte enregistré 0,00 € (espèces), reste dû 33,00 €.
- Attente rédigée : Bavarois framboise 6P 31,00 € + Écriture 2,00 € = 33,00 €. Recopier le texte à la lettre, fautes comprises ; prévenir que 17 mots sur un 6 parts est beaucoup (« écriture simple » : à voir avec le pâtissier). Retrait dimanche 22/11 à 14h00. Acompte 0 € : avertissement (viser 16,50 €).

### Bons sortis

`bons/C34-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- Le texte est pris tel quel, fautes comprises, et imprimé tel quel. Bien.
- Aucune alerte sur la longueur (près de 90 caractères sur un 6 parts). La limite est de 200 caractères côté serveur, coupée sans prévenir (lu dans le code : `texte(l.texteGateau, 200)`, non exécuté contre le serveur).
- La consigne « tel quel, écrire petit » est en précision, imprimée APRÈS l’écriture.

---

## C35 — Valérie Simon (comptoir)

> **Le client dit :** J'ai des jumeaux qui fêtent leurs 10 ans, donc deux gâteaux pareils : deux bavarois à la fraise pour 8. Sur l'un « Bon anniversaire Adam », sur l'autre « Bon anniversaire Inès ».
> **Retrait souhaité :** samedi 28 novembre à 10h · **Paiement :** Je mets 40 € aujourd'hui.
> **Rebondissements :** « Un rond et un carré, pour qu'ils ne se disputent pas. » / « Fraise hein, pas fraisier, Inès n'aime pas la génoise. »

**Résultat : validée** — commande n° 2026-0935 · **20 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Valérie Simon »
Étape 1 · Téléphone (pavé) : 0474 76 41 09
Étape 1 · Jour de retrait : samedi 28 novembre
Étape 1 · Heure de retrait : 10:00
« Continuer : les produits »
Étape 2 · Recherche « bavarois fraise » → tuiles : Bavarois fraise
Étape 2 · Toucher la tuile « Bavarois fraise » → gâteau au bon, goût « Fraise » déjà posé, boutons de taille ouverts
Étape 2 · Bouton de taille « 8 » (affiché avec 36,00 €, prix du comptoir) → ligne : Bavarois fraise 8P
   ↳ APP : ERR_FORME_MANQUANTE [ligne 1 : Bavarois fraise 8P] — « Choisissez la forme de « Bavarois 8P » : carré ou rond. » — sortie(s) : [(champ vide : « À remplir : forme (carré ou rond) »)]
Étape 2 · Forme : Rond
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Bavarois fraise 8P] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Bloc « Sur ce gâteau » : écriture « Bon anniversaire Adam »
Étape 2 · Toucher la tuile « Bavarois fraise » → gâteau au bon, goût « Fraise » déjà posé, boutons de taille ouverts
Étape 2 · Bouton de taille « 8 » (affiché avec 36,00 €, prix du comptoir) → ligne : Bavarois fraise 8P
   ↳ APP : ERR_FORME_MANQUANTE [ligne 3 : Bavarois fraise 8P] — « Choisissez la forme de « Bavarois 8P » : carré ou rond. » — sortie(s) : [(champ vide : « À remplir : forme (carré ou rond) »)]
Étape 2 · Forme : Carré
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 3 : Bavarois fraise 8P] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Bloc « Sur ce gâteau » : écriture « Bon anniversaire Inès »
« Continuer : le paiement »
Étape 3 · Acompte au pavé : 40,00 €
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 76,00 €, acompte 40,00 €, reste 36,00 €.
```

### Total annoncé contre l’attente du client

- Total : **76,00 €** annoncés, **76,00 €** attendus → écart **0,00 €**.
- Commande 2026-0935 : acompte enregistré 40,00 € (espèces), reste dû 36,00 €.
- Attente rédigée : 2 × Bavarois goût Fraise 8P à 36,00 € = 72,00 € + 2 × Écriture 2,00 € = 4,00 € → 76,00 €. Deux lignes distinctes (une écriture et une forme chacune). Retrait samedi 28/11 à 10h00. Acompte 40,00 € ≥ 38,00 €.

### Bons sortis

`bons/C35-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- rien (tout ce que j’ai saisi se retrouve sur au moins un exemplaire).

### Remarques du vendeur

- Deux gâteaux = deux touchers de la tuile, chacun sa forme et son écriture ; le supplément Écriture passe à 2 tout seul. C’est exactement ce qu’il faut.
- Sur le bon, la ligne « 2 × Supplément Écriture simple » est imprimée ENTRE les deux gâteaux.
- Le message de forme dit « Bavarois 8P » alors que la ligne s’appelle « Bavarois fraise 8P ».

---

## C36 — Béatrice Renard (telephone)

> **Le client dit :** Bonjour, je cherche une tarte au citron meringuée pour 8 personnes, et un beau plateau de fruits frais découpés. Vous faites ça ?
> **Retrait souhaité :** samedi vers 17h · **Paiement :** Je règle à l'enlèvement.
> **Rebondissements :** Si on lui propose les tartelettes citron : « Non, je veux une grande tarte à partager. » / « Bon, qu'est-ce que vous avez comme grandes tartes ? ... Une aux pommes et un moelleux au chocolat alors. » / « Et pour les fruits, tant pis. »

**Résultat : contournement (demande d’origine en remarque libre, repli sur 2 tartes du tarif)** — commande n° 2026-0936 · **31 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Béatrice Renard »
Étape 1 · Téléphone (pavé) : 0472 18 53 66
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : samedi 21 novembre
Étape 1 · Heure de retrait : 17:00
« Continuer : les produits »
Étape 2 · Recherche « tarte citron » → 1 produit(s) : Tartelette citron (4,70 €)
Étape 2 · Recherche « citron » → 2 produit(s) : Tartelette citron (4,70 €) · Trompe l'oeil Citron (8,90 €)
Pas de grande tarte au citron. J’essaie « Autre demande » pour ne pas perdre la vente.
Étape 2 · « Autre demande » → description : « Tarte citron meringuée 8 personnes »
Étape 2 · « C’est un gâteau ? » : Oui
Étape 2 · Quantité au pavé : 8
   ↳ APP : ERR_GOUT_MANQUANT [ligne 1 : Tarte citron meringuée 8 personnes] — « Choisissez le goût pour « Tarte citron meringuée 8 personnes ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
   → Vendeur touche la sortie [Au choix du pâtissier]
   ↳ APP : ERR_MONTANT_NUL [ligne 1 : Tarte citron meringuée 8 personnes] — « Le prix de la ligne « Tarte citron meringuée 8 personnes » est nul. Indiquez le prix, s’il vous plaît. Pour un geste commercial, demandez d’abord au manager. » — sortie(s) : [Indiquer le prix]
Il faut maintenant un PRIX par part, puis le code du manager : je n’ai ni l’un ni l’autre. Impossible de laisser la ligne « à voir ».
« Continuer : le paiement »
Étape 3 · Bouton « Pas d’acompte »
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → fenêtre « Il manque : » • Prix — Tarte citron meringuée 8 personnes — Le prix de la ligne « Tarte citron meringuée 8 personnes » est nul. Indiquez le prix, s’il vous plaît. Pour un geste commercial, demandez d’abord au manager.
« Continuer : les produits »
Étape 2 · × retirer la ligne « Tarte citron meringuée 8 personnes »
   ↳ APP : ERR_COMMANDE_VIDE — « La commande est vide. Ajoutez au moins un produit, s’il vous plaît. » — sortie(s) : [(champ vide : « À remplir : produits »)]
Étape 2 · Recherche « fruits » → tuiles : Bavarois fruits de la passion, Croûte Fruits — 14 produit(s) : Bastella Fruits de mer (3,90 €) · Cigare Fruits de mer (2,60 €) · Croûte Fruits 6P (27,00 €) · Croûte Fruits 8P (32,00 €) · Bavarois fruits de la passion 4P (20,00 €) · Bavarois fruits de la passion 6P (31,00 €) · Bavarois fruits de la passion 8P (36,00 €) · Tartelette fruits de la passion (4,70 €) …
Plateau de fruits frais : rien non plus. Cliente : « Qu’est-ce que vous avez comme grandes tartes ? … Une aux pommes et un moelleux au chocolat alors. Et pour les fruits, tant pis. »
Étape 2 · Recherche « tarte » → tuiles : Tarte 6P — 58 produit(s) : Supplément Photo (15,00 €) · Supplément Ecriture (2,00 €) · Croûte Fruits 6P (27,00 €) · Croûte Fraises 6P (27,00 €) · Croûte framboises 6P (27,00 €) · Croûte Fruits 8P (32,00 €) · Croûte Fraises 8P (32,00 €) · Croûte framboises 8P (32,00 €) …
Étape 2 · Toucher le bouton « pommes » de la tuile « Tarte 6P » : « Tarte pommes 6P » → 1 gâteau au bon (sa ligne)
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (9,00 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 9,00 €]
Étape 2 · Toucher le bouton « Moelleux » de la tuile « Tarte 6P » : « Tarte Moelleux 6P » → 1 gâteau au bon (sa ligne)
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (21,00 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 21,00 €]
« Continuer : le paiement »
Étape 3 · Remarques : « A demandé une tarte citron meringuée 8 pers. et un plateau de fruits frais : pas au tarif, à voir avec le gérant si on peut la rappeler. »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 42,00 €, acompte 0,00 €, reste 42,00 €.
```

### Total annoncé contre l’attente du client

- Total : **42,00 €** annoncés, **42,00 €** attendus → écart **0,00 €**.
- Commande 2026-0936 : acompte enregistré 0,00 € (espèces), reste dû 42,00 €.
- Attente rédigée : Tarte citron meringuée et plateau de fruits : pas au tarif → « à voir » avec le gérant (ligne libre), ne pas inventer de prix. Alternatives : 8 Tartelette citron × 4,70 € = 37,60 € ; Croûte Fruits 8P 32,00 €. Choix final : Tarte pommes 6P 18,00 € + Tarte Moelleux 6P 24,00 € = 42,00 €. Retrait samedi 21/11 à 17h00.

### Bons sortis

`bons/C36-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- IMPOSSIBLE de noter « à voir avec le gérant » comme une ligne : « Autre demande » exige « C’est un gâteau ? », un goût, un PRIX, puis le code du manager. Sans manager, la ligne bloque toute la commande (« Il manque : Prix »).
- J’ai dû retirer la ligne et écrire la demande en remarque : le bon ne dit « tarte citron meringuée » que dans le cadre Remarques, sans prix ni suite prévue.
- Après ce premier « Valider » manqué, retirer la ligne affiche « La commande est vide » pendant que je cherche le produit suivant.
- « Tarte » à la recherche : 58 produits (tout le rayon « Gâteaux et tartes »), la tuile « Tarte 6P » est en tête, heureusement.

---

## C37 — François Collignon (comptoir)

> **Le client dit :** Vos sablés bretons à la framboise sont délicieux. Vous pouvez m'en faire un grand, format gâteau, pour 8 ? Et il me faut aussi un bavarois pistache pour 12.
> **Retrait souhaité :** vendredi 27 novembre à 17h · **Paiement :** Je donne ce qu'il faut, dites-moi.
> **Rebondissements :** Pour le sablé : « Si ce n'est pas possible en grand, mettez-m'en 8 petits. » / Pour le bavarois : « 12 ça n'existe pas ? 10 alors, on fera de petites parts. » / « Pistache, vous êtes sûr que le pâtissier le fait ? Sinon mangue. »

**Résultat : validée** — commande n° 2026-0937 · **27 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « François Collignon »
Étape 1 · Téléphone (pavé) : 0478 44 92 30
Étape 1 · Jour de retrait : vendredi 27 novembre
Étape 1 · Heure de retrait : 17:00
« Continuer : les produits »
Étape 2 · Recherche « sable breton » → 4 produit(s) : Sablé breton pistache (3,30 €) · Sablé breton praliné (3,30 €) · Sablé breton framboise (3,30 €) · Sablé breton café caramel (3,30 €)
Sablé breton en grand, format gâteau : pas au tarif (mêmes obstacles que toute « Autre demande » : prix + code du manager). Client : « Mettez-m’en 8 petits. »
Étape 2 · Toucher carte « Sablé breton framboise » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 8 — Sablé breton framboise
Étape 2 · Recherche « bavarois pistache » → RIEN (aucune tuile, aucun produit)
Étape 2 · Recherche « bavarois » → tuiles : Bavarois framboise, Bavarois fruits de la passion, Bavarois mangue, Bavarois fraise, Bavarois chocolat au lait praliné — 17 produit(s) : Bavarois (4,50 €/pers., sur commande) · Bavarois 10P (45,00 €) · Bavarois 4P (20,00 €) · Bavarois 6P (31,00 €) · Bavarois 8P (36,00 €) · Bavarois framboise 4P (20,00 €) · Bavarois framboise 6P (31,00 €) · Bavarois framboise 8P (36,00 €) …
Étape 2 · Toucher carte « Bavarois » → boutons de taille ouverts
Étape 2 · Pas de bouton « 12 » (boutons : 4, 6, 8, 10, 15, 20, 25, 30) → « Autre », 12 au pavé
   ↳ APP : ERR_TAILLE_NON_STANDARD [ligne 2 : Bavarois] — « Ce gâteau se fait en 10 ou 15 parts, pas en 12. Choisissez une de ces tailles, ou demandez l’accord du manager. » — sortie(s) : [Passer à 10 parts] [Passer à 15 parts] [Saisir le code du manager]
Client : « 10 alors, on fera de petites parts. »
   → Vendeur touche la sortie [Passer à 10 parts]
   ↳ APP : ERR_GOUT_MANQUANT [ligne 2 : Bavarois] — « Choisissez le goût pour « Bavarois ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Goût « pistache » : pas dans les goûts en tête du Bavarois ; je le tape dans « Autre… » (rien ne me dit si le pâtissier le fait). Client : « Sinon mangue. »
Étape 2 · Goût : « Pistache » (tapé dans « Autre… ») → ligne : Bavarois
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 2 : Bavarois] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Bloc « Sur ce gâteau » : « Pas d’écriture » coché
Étape 2 · « Précision… » de la ligne Bavarois : « Pistache si le pâtissier le fait, SINON MANGUE »
« Continuer : le paiement »
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (35,70 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 35,70 €]
Client : « Je donne ce qu’il faut, dites-moi. » — le pavé d’acompte dit seulement « au moins 50 % du total », sans le montant : j’ai touché « Pas d’acompte » pour faire apparaître l’avertissement et son bouton.
   → Vendeur touche la sortie [Mettre l’acompte à 35,70 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 71,40 €, acompte 35,70 €, reste 35,70 €.
```

### Total annoncé contre l’attente du client

- Total : **71,40 €** annoncés, **71,40 €** attendus → écart **0,00 €**.
- Commande 2026-0937 : acompte enregistré 35,70 € (espèces), reste dû 35,70 €.
- Attente rédigée : Sablé breton grand format : pas au tarif (à voir) ; repli 8 Sablé breton framboise × 3,30 € = 26,40 €. Bavarois 12 refusé → 10 parts × 4,50 € = 45,00 € (carré). Goût pistache : seulement s'il est dans la liste du manager, sinon Mangue. Total 71,40 € ; acompte conseillé 35,70 €.

### Bons sortis

`bons/C37-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- rien (tout ce que j’ai saisi se retrouve sur au moins un exemplaire).

### Remarques du vendeur

- Bavarois pistache : la recherche « bavarois pistache » ne trouve rien ; il faut prendre « Bavarois » et taper le goût. Rien ne me dit si la pistache se fait.
- Le montant de l’acompte conseillé n’apparaît qu’APRÈS avoir saisi un acompte trop bas. Pour le connaître j’ai touché « Pas d’acompte », lu 35,70 €, puis le bouton.

---

## C38 — Sarah Cohen (comptoir)

> **Le client dit :** J'ai des invités ce soir, c'est la panique. Il me faut un petit gâteau chocolat praliné pour 4 et une croûte aux framboises pour 6, pour tout à l'heure, 17h. C'est jouable ?
> **Retrait souhaité :** aujourd'hui à 17h · **Paiement :** Je paie tout maintenant par carte.
> **Rebondissements :** « C'est quoi le gros trompe-l'œil dans la vitrine ? Il est pour 4 ? Ah, je prends ça à la place du chocolat praliné. » / « Il est à quoi, le trompe-l'œil ? » / « Finalement gardez aussi le praliné, on sera peut-être plus. »

**Résultat : validée** — commande n° 2026-0938 · **27 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Sarah Cohen »
Étape 1 · Téléphone (pavé) : 0479 51 07 83
Étape 1 · Jour de retrait : jeudi 19 novembre
   ↳ APP : INFO_COMMANDE_JOUR_MEME — « Commande pour aujourd’hui : prévenez l’atelier tout de suite. » — aucune sortie proposée
Étape 1 · Heure de retrait : 17:00
« Continuer : les produits »
Étape 2 · Recherche « chocolat praline » → tuiles : Bavarois chocolat au lait praliné
Étape 2 · Toucher la tuile « Bavarois chocolat au lait praliné » → gâteau au bon, goût « Chocolat au lait praliné » déjà posé, boutons de taille ouverts
Étape 2 · Bouton de taille « 4 » (affiché avec 20,00 €, prix du comptoir) → ligne : Bavarois chocolat au lait praliné 4P
   ↳ APP : ERR_FORME_MANQUANTE [ligne 1 : Bavarois chocolat au lait praliné 4P] — « Choisissez la forme de « Bavarois 4P » : carré ou rond. » — sortie(s) : [(champ vide : « À remplir : forme (carré ou rond) »)]
Étape 2 · Forme : Rond
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Bavarois chocolat au lait praliné 4P] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Bloc « Sur ce gâteau » : « Pas d’écriture » coché
Étape 2 · Recherche « croute framboises » → tuiles : Croûte framboises — 2 produit(s) : Croûte framboises 6P (27,00 €) · Croûte framboises 8P (32,00 €)
Étape 2 · Toucher le bouton « 6P » de la tuile « Croûte framboises » : « Croûte framboises 6P » → 1 gâteau au bon (sa ligne)
Cliente : « C’est quoi le gros trompe-l’œil dans la vitrine ? Il est pour 4 ? Je prends ça à la place du chocolat praliné. »
Étape 2 · Toucher l’onglet « Bavarois chocolat au lait praliné 4P » du bon pour rouvrir ses réglages
Étape 2 · × retirer la ligne « Bavarois chocolat au lait praliné 4P »
Étape 2 · Recherche « trompe » → tuiles : Trompe l'oeil XXL 4P — 16 produit(s) : Trompe l'oeil XXL 4P (35,00 €) · Trompe l'oeil Pistache (8,90 €) · Trompe l'oeil Citron (8,90 €) · Trompe l'oeil Cabosse (8,90 €) · Trompe l'oeil Amande (8,90 €) · Trompe l'oeil Passion (8,90 €) · Trompe l'oeil Mangue (8,90 €) · Trompe l'oeil Noisette (8,90 €) …
Étape 2 · Toucher le bouton « 4P » de la tuile « Trompe l'oeil XXL 4P » : « Trompe l'oeil XXL 4P » → 1 gâteau au bon (sa ligne)
Cliente : « Il est à quoi, le trompe-l’œil ? » — la carte dit « Trompe l’oeil XXL 4P », sans parfum : je ne sais pas. « Finalement gardez aussi le praliné. » — tout est à refaire pour ce gâteau (tuile, taille, forme, écriture).
Étape 2 · Toucher la tuile « Bavarois chocolat au lait praliné » → gâteau au bon, goût « Chocolat au lait praliné » déjà posé, boutons de taille ouverts
Étape 2 · Bouton de taille « 4 » (affiché avec 20,00 €, prix du comptoir) → ligne : Bavarois chocolat au lait praliné 4P
   ↳ APP : ERR_FORME_MANQUANTE [ligne 3 : Bavarois chocolat au lait praliné 4P] — « Choisissez la forme de « Bavarois 4P » : carré ou rond. » — sortie(s) : [(champ vide : « À remplir : forme (carré ou rond) »)]
Étape 2 · Forme : Rond
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 3 : Bavarois chocolat au lait praliné 4P] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Bloc « Sur ce gâteau » : « Pas d’écriture » coché
« Continuer : le paiement »
Étape 3 · Remarques : « POUR AUJOURD’HUI 17h — vérifier avec l’atelier / la vitrine. Parfum du trompe-l’œil XXL demandé par la cliente. »
Étape 3 · Acompte au pavé : 82,00 €
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 82,00 €, acompte 82,00 €, reste 0,00 €.
```

### Total annoncé contre l’attente du client

- Total : **82,00 €** annoncés, **82,00 €** attendus → écart **0,00 €**.
- Commande 2026-0938 : acompte enregistré 82,00 € (espèces), reste dû 0,00 €.
- Attente rédigée : Bavarois chocolat au lait praliné 4P 20,00 € + Trompe l'oeil XXL 4P 35,00 € + Croûte framboises 6P 27,00 € = 82,00 €, payé en entier. Retrait jeudi 19/11 à 17h00 : vérifier avec l'atelier ou la vitrine ce qui est faisable aujourd'hui. Parfum du Trompe l'oeil XXL : pas au tarif, à demander.

### Bons sortis

`bons/C38-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- rien (tout ce que j’ai saisi se retrouve sur au moins un exemplaire).

### Remarques du vendeur

- Jour même : accepté, « prévenez l’atelier tout de suite ». L’écran ne sait pas ce qu’il reste en vitrine.
- Parfum du Trompe l’oeil XXL : rien sur la carte, rien à choisir. Je ne peux pas répondre à la cliente.
- Retirer un gâteau puis le remettre : tout est à refaire (tuile, taille, forme, écriture), 4 gestes.

---

## C39 — Loubna Idrissi (comptoir)

> **Le client dit :** C'est pour le baptême de mon fils, le samedi 5 décembre. Il me faut : une pièce montée deux étages pour 60 avec « Bienvenue Rayan », 40 mini burgers, 40 mini pizzas, 30 mini wraps, 50 mini briwates au poulet, deux grandes bestellas au poulet, deux pains surprise, 45 mini tartelettes, 45 mini éclairs, 2 kilos de cornes de gazelle, 1 kilo de sablés, 10 grandes bouteilles de Coca et 24 petites eaux.
> **Retrait souhaité :** samedi 5 décembre à 14h · **Paiement :** Je laisse 500 € aujourd'hui, le reste le jour même.
> **Rebondissements :** Goûts de la pièce montée : « Vanille-framboise en bas, chocolat en haut. » / « Les pains surprise : 20 sandwichs chacun, mélangés. » / « L'eau, des Cristaline. » / « Je peux avoir le détail imprimé pour mon mari ? »

**Résultat : validée** — commande n° 2026-0939 · **70 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Loubna Idrissi »
Étape 1 · Téléphone (pavé) : 0486 29 74 51
Étape 1 · Jour de retrait : samedi 5 décembre
Étape 1 · Heure de retrait : 14:00
« Continuer : les produits »
Étape 2 · Recherche « piece montee » → 2 produit(s) : Pièce montée 2 étages (5,60 €/pers., sur commande) · Pièce montée 3 étages (5,60 €/pers., sur commande)
Étape 2 · Toucher carte « Pièce montée 2 étages » → boutons de taille ouverts
Étape 2 · Bouton de taille « 60 » → ligne : Pièce montée 2 étages
   ↳ APP : ERR_GOUT_MANQUANT [ligne 1 : Pièce montée 2 étages] — « Choisissez le goût de l’étage 1 pour « Pièce montée 2 étages ». Si le client hésite : « au choix du pâtissier ». » — sortie(s) : [Au choix du pâtissier]
Étape 2 · Goûts par étage : étage 1 « Vanille-framboise », étage 2 « Chocolat » (tapé dans « Autre… ») → ligne : Pièce montée 2 étages
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Pièce montée 2 étages] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Bloc « Sur ce gâteau » : écriture « Bienvenue Rayan »
Étape 2 · Famille « Salé » → 13 produit(s) : Bestella poulet, 10 personnes (75,00 €, sur commande) · Bestella fruits de mer, 10 personnes (90,00 €, sur commande) · Quiche poulet/saumon, 6 personnes (27,00 €, sur commande) · Bestella poulet / fruits de mer, individuelle (3,90 €, sur commande) · Mini cêpe farcie classique (3,20 €, sur commande) · Mini pizza / quiche (2,80 €, sur commande) · Mini wrap (3,90 €, sur commande) · Mini burger (3,50 €, sur commande) …
Étape 2 · Toucher carte « Mini burger » → 1 au bon, pavé de quantité ouvert
   ↳ APP : ERR_QUANTITE_MIN [ligne 3 : Mini burger] — « Minimum 10 pièces pour « Mini burger ». » — sortie(s) : [Passer à 10 pièces]
Étape 2 · Quantité au pavé : 40 — Mini burger
Étape 2 · Toucher carte « Mini pizza / quiche » → 1 au bon, pavé de quantité ouvert
   ↳ APP : ERR_QUANTITE_MIN [ligne 4 : Mini pizza / quiche] — « Minimum 10 pièces pour « Mini pizza / quiche ». » — sortie(s) : [Passer à 10 pièces]
Étape 2 · Quantité au pavé : 40 — Mini pizza / quiche
Étape 2 · Toucher carte « Mini wrap » → 1 au bon, pavé de quantité ouvert
   ↳ APP : ERR_QUANTITE_MIN [ligne 5 : Mini wrap] — « Minimum 10 pièces pour « Mini wrap ». » — sortie(s) : [Passer à 10 pièces]
Étape 2 · Quantité au pavé : 30 — Mini wrap
Étape 2 · Toucher carte « Mini briwate poulet / cigare fruits de mer » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 50 — Mini briwate poulet / cigare fruits de mer
Étape 2 · « Précision… » de la ligne Mini briwate poulet / cigare fruits de mer : « briwates au poulet »
Étape 2 · Toucher carte « Bestella poulet, 10 personnes » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 2 — Bestella poulet, 10 personnes
Étape 2 · Toucher carte « Grand pain surprise » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 2 — Grand pain surprise
Étape 2 · « Nombre de sandwichs » au pavé : 40
Étape 2 · « Précision… » de la ligne Grand pain surprise : « 20 sandwichs par pain, mélangés »
Étape 2 · Famille « Gâteau » → tuiles : Fraisier, Matadi chocolat, Mousse chocolat, Forêt noire, Bavarois framboise, Bavarois fruits de la passion, Bavarois mangue, Bavarois fraise, Bavarois chocolat au lait praliné, Fleur caramel chocolat, Croûte Fraises, Croûte framboises, Croûte Fruits, Tarte 6P, Entremet 8P, Trompe l'oeil XXL 4P — 14 produit(s) : Cake nature (2,90 €/pers., sur commande) · Crème fraîche (4,20 €/pers., sur commande) · Bavarois (4,50 €/pers., sur commande) · Layer Cake (5,00 €/pers., sur commande) · Number Cake (5,00 €/pers., sur commande) · Pièce montée 2 étages (5,60 €/pers., sur commande) · Pièce montée 3 étages (5,60 €/pers., sur commande) · Entremet (6,90 €/pers., sur commande) …
Étape 2 · Toucher carte « Mini tartelette » → 1 au bon, pavé de quantité ouvert
   ↳ APP : ERR_QUANTITE_MIN [ligne 9 : Mini tartelette] — « Minimum 15 pièces pour « Mini tartelette ». » — sortie(s) : [Passer à 15 pièces]
Étape 2 · Quantité au pavé : 45 — Mini tartelette
Étape 2 · Toucher carte « Mini éclair / mille-feuille » → 1 au bon, pavé de quantité ouvert
   ↳ APP : ERR_QUANTITE_MIN [ligne 10 : Mini éclair / mille-feuille] — « Minimum 15 pièces pour « Mini éclair / mille-feuille ». » — sortie(s) : [Passer à 15 pièces]
Étape 2 · Quantité au pavé : 45 — Mini éclair / mille-feuille
Étape 2 · « Précision… » de la ligne Mini éclair / mille-feuille : « éclairs »
Étape 2 · Recherche « corne » → 1 produit(s) : Corne de gazelle (28,00 €/kg)
Étape 2 · Toucher carte « Corne de gazelle » → pavé du POIDS ouvert (pas de +1)
Étape 2 · Poids au pavé décimal : 2 kg — Corne de gazelle
Étape 2 · Recherche « sable » → 7 produit(s) : Sablé orientaux (22,00 €/kg) · Sablé poire frangipane (3,30 €) · Sablé frangipane (3,30 €) · Sablé breton pistache (3,30 €) · Sablé breton praliné (3,30 €) · Sablé breton framboise (3,30 €) · Sablé breton café caramel (3,30 €)
Étape 2 · Toucher carte « Sablé orientaux » → pavé du POIDS ouvert (pas de +1)
Étape 2 · Poids au pavé décimal : 1 kg — Sablé orientaux
Étape 2 · Recherche « coca » → 1 produit(s) : Grande Bouteille (1,5L) Coca (2,80 €)
Étape 2 · Toucher carte « Grande Bouteille (1,5L) Coca » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 10 — Grande Bouteille (1,5L) Coca
Étape 2 · Recherche « cristaline » → 1 produit(s) : Cristaline (0,50 €)
Étape 2 · Toucher carte « Cristaline » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 24 — Cristaline
« Continuer : le paiement »
Étape 3 · Remarques : « Baptême. La cliente veut le détail imprimé pour son mari (exemplaire CLIENT). »
Étape 3 · Acompte au pavé : 500,00 €
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (636,50 €) : 500,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 636,50 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 1 273,00 €, acompte 500,00 €, reste 773,00 €.
```

### Total annoncé contre l’attente du client

- Total : **1 273,00 €** annoncés, **1 273,00 €** attendus → écart **0,00 €**.
- Commande 2026-0939 : acompte enregistré 500,00 € (espèces), reste dû 773,00 €.
- Attente rédigée : Pièce montée 2 étages 60 × 5,60 € = 336,00 € + Écriture 2,00 € ; 40 Mini burger 140,00 € ; 40 Mini pizza / quiche 112,00 € ; 30 Mini wrap 117,00 € ; 50 Mini briwate poulet × 2,10 € = 105,00 € ; 2 Bestella poulet 10 personnes 150,00 € ; 2 Grand pain surprise 40,00 € ; 45 Mini tartelette 85,50 € ; 45 Mini éclair 67,50 € ; Corne de gazelle 2 kg 56,00 € ; Sablé orientaux 1 kg 22,00 € ; 10 Grande Bouteille Coca 28,00 € ; 24 Cristaline 12,00 €. Total 1 273,00 €. Acompte 500,00 € < 636,50 € : avertissement.

### Bons sortis

`bons/C39-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- ligne 8 « Grand pain surprise » : nombre de sandwichs (40) — enregistré, imprimé nulle part

### Remarques du vendeur

- 14 lignes saisies sans blocage, total 1 273,00 € juste. La famille « Salé » et la famille « Gâteau » évitent les recherches.
- Chaque produit à minimum s’allume en rouge au premier toucher (« Minimum 10 pièces ») jusqu’à ce que je tape la vraie quantité : sur 5 lignes de minis à minimum, ça fait 5 faux refus.
- Briwates poulet / cigares : même carte, précision libre.
- Nombre de sandwichs des pains surprise (40) : saisi, absent du bon.
- « Vanille-framboise » pour l’étage 1 : tapé dans « Autre… ».

---

## C40 — Stéphanie Verhaegen (telephone)

> **Le client dit :** Bonjour, c'est pour le pot de fin d'année de notre société, le vendredi 18 décembre. Je vous dicte : un Matadi pour 20 avec « Bonne fin d'année à toute l'équipe », un gâteau fleur caramel chocolat pour 15, deux croûtes aux fruits pour 8, 30 mini burgers, 30 mini batbouts farcis, 40 mini-sandwichs, 30 mini bestellas au poulet, 30 mini cigares aux fruits de mer, 30 mini bavarois, 30 mini mille-feuilles, 20 mini croissants, 20 mini pains au chocolat, 6 Coca et 6 Fanta en grandes bouteilles et 12 grandes eaux.
> **Retrait souhaité :** vendredi 18 décembre à 11h30 · **Paiement :** On paie sur facture normalement... Un acompte de 50 % ? Je dois demander à la compta, je peux vous faire 200 € par virement en attendant.
> **Rebondissements :** « Les mini-sandwichs : 20 poulet curry, 20 crabe. » / « L'eau, c'est de la Spa en 1,5 litre. » / LE LENDEMAIN (vendredi 20/11), elle rappelle : « On sera 5 de plus, passez le Matadi à 25 parts. Et retirez les mini cigares, il y a des allergiques aux fruits de mer. » / « Et finalement livré à 11h plutôt que 11h30 — enfin, on vient le chercher à 11h. »

**Résultat : validée** — commande n° 2026-0940 · **87 gestes** environ · code du manager : non utilisé

### Jour 1 (jeudi 19/11) — prise de commande

```
Étape 1 · Nom du client : « Stéphanie Verhaegen »
Étape 1 · Téléphone (pavé) : 0477 03 68 25
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : vendredi 18 décembre
Étape 1 · Heure de retrait : 11:30
« Continuer : les produits »
Étape 2 · Recherche « matadi » → tuiles : Matadi chocolat — 3 produit(s) : Matadi chocolat 4P (20,00 €) · Matadi chocolat 6P (31,00 €) · Matadi chocolat 8P (36,00 €)
Étape 2 · Toucher la tuile « Matadi chocolat » → gâteau au bon, goût « Matadi chocolat » déjà posé, boutons de taille ouverts
Étape 2 · Bouton de taille « 20 » → ligne : Matadi chocolat
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 1 : Matadi chocolat] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Bloc « Sur ce gâteau » : écriture « Bonne fin d'année à toute l'équipe »
Étape 2 · Recherche « fleur caramel » → tuiles : Fleur caramel chocolat — 1 produit(s) : Fleur caramel chocolat (4,80 €)
Étape 2 · Toucher la tuile « Fleur caramel chocolat » → gâteau au bon, goût « Fleur caramel chocolat » déjà posé, boutons de taille ouverts
Étape 2 · Bouton de taille « 15 » → ligne : Fleur caramel chocolat
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 3 : Fleur caramel chocolat] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Bloc « Sur ce gâteau » : « Pas d’écriture » coché
Étape 2 · Recherche « croute fruits » → tuiles : Croûte Fruits — 2 produit(s) : Croûte Fruits 6P (27,00 €) · Croûte Fruits 8P (32,00 €)
Étape 2 · Toucher le bouton « 8P » de la tuile « Croûte Fruits » : « Croûte Fruits 8P » → 1 gâteau au bon (sa ligne)
Étape 2 · Toucher le bouton « 8P » de la tuile « Croûte Fruits » : « Croûte Fruits 8P » → 1 gâteau au bon (sa ligne)
Étape 2 · Famille « Salé » → 13 produit(s) : Bestella poulet, 10 personnes (75,00 €, sur commande) · Bestella fruits de mer, 10 personnes (90,00 €, sur commande) · Quiche poulet/saumon, 6 personnes (27,00 €, sur commande) · Bestella poulet / fruits de mer, individuelle (3,90 €, sur commande) · Mini cêpe farcie classique (3,20 €, sur commande) · Mini pizza / quiche (2,80 €, sur commande) · Mini wrap (3,90 €, sur commande) · Mini burger (3,50 €, sur commande) …
Étape 2 · Toucher carte « Mini burger » → 1 au bon, pavé de quantité ouvert
   ↳ APP : ERR_QUANTITE_MIN [ligne 6 : Mini burger] — « Minimum 10 pièces pour « Mini burger ». » — sortie(s) : [Passer à 10 pièces]
Étape 2 · Quantité au pavé : 30 — Mini burger
Étape 2 · Toucher carte « Mini batbout farci » → 1 au bon, pavé de quantité ouvert
   ↳ APP : ERR_QUANTITE_MIN [ligne 7 : Mini batbout farci] — « Minimum 10 pièces pour « Mini batbout farci ». » — sortie(s) : [Passer à 10 pièces]
Étape 2 · Quantité au pavé : 30 — Mini batbout farci
Étape 2 · Toucher carte « Mini-sandwichs garnis » → 1 au bon, pavé de quantité ouvert
   ↳ APP : ERR_QUANTITE_MIN [ligne 8 : Mini-sandwichs garnis] — « Minimum 10 pièces pour « Mini-sandwichs garnis ». » — sortie(s) : [Passer à 10 pièces]
Étape 2 · Quantité au pavé : 40 — Mini-sandwichs garnis
Étape 2 · « Précision… » de la ligne Mini-sandwichs garnis : « 20 Poulet curry, 20 Crabe/surimi »
Étape 2 · Toucher carte « Mini bestella poulet / fruits de mer » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 30 — Mini bestella poulet / fruits de mer
Étape 2 · « Précision… » de la ligne Mini bestella poulet / fruits de mer : « au poulet »
Étape 2 · Toucher carte « Mini briwate poulet / cigare fruits de mer » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 30 — Mini briwate poulet / cigare fruits de mer
Étape 2 · « Précision… » de la ligne Mini briwate poulet / cigare fruits de mer : « CIGARES aux fruits de mer »
Étape 2 · Famille « Gâteau » → tuiles : Fraisier, Matadi chocolat, Mousse chocolat, Forêt noire, Bavarois framboise, Bavarois fruits de la passion, Bavarois mangue, Bavarois fraise, Bavarois chocolat au lait praliné, Fleur caramel chocolat, Croûte Fraises, Croûte framboises, Croûte Fruits, Tarte 6P, Entremet 8P, Trompe l'oeil XXL 4P — 14 produit(s) : Cake nature (2,90 €/pers., sur commande) · Crème fraîche (4,20 €/pers., sur commande) · Bavarois (4,50 €/pers., sur commande) · Layer Cake (5,00 €/pers., sur commande) · Number Cake (5,00 €/pers., sur commande) · Pièce montée 2 étages (5,60 €/pers., sur commande) · Pièce montée 3 étages (5,60 €/pers., sur commande) · Entremet (6,90 €/pers., sur commande) …
Étape 2 · Toucher carte « Mini bavarois » → 1 au bon, pavé de quantité ouvert
   ↳ APP : ERR_QUANTITE_MIN [ligne 11 : Mini bavarois] — « Minimum 15 pièces pour « Mini bavarois ». » — sortie(s) : [Passer à 15 pièces]
Étape 2 · Quantité au pavé : 30 — Mini bavarois
Étape 2 · Toucher carte « Mini éclair / mille-feuille » → 1 au bon, pavé de quantité ouvert
   ↳ APP : ERR_QUANTITE_MIN [ligne 12 : Mini éclair / mille-feuille] — « Minimum 15 pièces pour « Mini éclair / mille-feuille ». » — sortie(s) : [Passer à 15 pièces]
Étape 2 · Quantité au pavé : 30 — Mini éclair / mille-feuille
Étape 2 · « Précision… » de la ligne Mini éclair / mille-feuille : « mille-feuilles »
Étape 2 · Recherche « mini croissant » → 1 produit(s) : Mini Croissant (1,30 €)
Étape 2 · Toucher carte « Mini Croissant » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 20 — Mini Croissant
Étape 2 · Recherche « mini pain chocolat » → 1 produit(s) : Mini Pain chocolat (1,30 €)
Étape 2 · Toucher carte « Mini Pain chocolat » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 20 — Mini Pain chocolat
Étape 2 · Recherche « coca » → 1 produit(s) : Grande Bouteille (1,5L) Coca (2,80 €)
Étape 2 · Toucher carte « Grande Bouteille (1,5L) Coca » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 6 — Grande Bouteille (1,5L) Coca
Étape 2 · Recherche « fanta » → 1 produit(s) : Grande Bouteille (1,5L) Fanta (2,80 €)
Étape 2 · Toucher carte « Grande Bouteille (1,5L) Fanta » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 6 — Grande Bouteille (1,5L) Fanta
Étape 2 · Recherche « spa » → 4 produit(s) : Petite Bouteille spa rouge (1,40 €) · Petite Bouteille Spa (1,20 €) · Grande Bouteille d’eau SPA 1,5L (1,50 €) · Pain Espagnol (1,80 €)
Étape 2 · Toucher carte « Grande Bouteille d’eau SPA 1,5L » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 12 — Grande Bouteille d’eau SPA 1,5L
« Continuer : le paiement »
Étape 3 · Remarques : « Société : paie sur facture — voir le gérant. Acompte 200 € par virement en attendant l’accord de la compta pour 50 %. »
Étape 3 · Acompte au pavé : 200,00 €
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (438,55 €) : 200,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 438,55 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 877,10 €, acompte 200,00 €, reste 677,10 €.
```

### Jour 2 (vendredi 20/11) — modification

```
VENDREDI 20/11 — elle rappelle. Liste des commandes → sa commande → « Modifier » (étape 2, 17 onglets au bon).
Étape 2 · Toucher l’onglet « Matadi chocolat » du bon pour rouvrir ses réglages
Étape 2 · Bouton de taille « 25 » → ligne : Matadi chocolat
   ↳ APP : AVERT_COMMANDE_DEJA_IMPRIMEE — « Cette commande est déjà imprimée : réimprimez les bons après la modification. » — sortie(s) : [Réimprimer]
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (449,80 €) : 200,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 449,80 €]
Étape 2 · Toucher l’onglet « Mini briwate poulet / cigare fruits de mer » du bon pour rouvrir ses réglages
Étape 2 · × retirer la ligne « Mini briwate poulet / cigare fruits de mer »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (418,30 €) : 200,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 418,30 €]
Retour à l’étape 1 (barre d’étapes)
Étape 1 · Heure de retrait : 11:00
« Continuer : le paiement »
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 836,60 €, acompte 200,00 €, reste 636,60 €.
   ↳ Historique enregistré : « à réimprimer — heure : 11h30 → 11h00, produits — avant : 20 × Bavarois (carré) [goût Matadi chocolat ; écriture « Bonne fin d'année à toute l'équipe »] à 4,50 € ; 1 × Supplément Écriture simple à 2,00 € ; 15 × Bavarois (carré) [goût Fleur caramel chocolat] à 4,50 € ; 1 × Croûte Fruits 8P à 32,00 € ; 1 × Croûte Fruits 8P à 32,00 € ; 30 × Mini burger à 3,50 € ; 30 × Mini batbout farci à 2,50 € ; 40 × Mini-sandwichs garnis [précision « 20 Poulet curry, 20 Crabe/surimi »] à 2,50 € ; 30 × Mini bestella poulet / fruits de mer [précision « au poulet »] à 2,90 € ; 30 × Mini briwate poulet / cigare fruits de mer [précision « CIGARES aux fruits de mer »] à 2,10 € ; 30 × Mini bavarois à 2,50 € ; 30 × Mini éclair / mille-feuille [précision « mille-feuilles »] à 1,50 € ; 20 × Mini Croissant à 1,30 € ; 20 × Mini Pain chocolat à 1,30 € ; 6 × Grande Bouteille (1,5L) Coca à 2,80 € ; 6 × Grande Bouteille (1,5L) Fanta à 2,80 € ; 12 × Grande Bouteille d’eau SPA 1,5L à 1,50 €, total : 877,10 € → 836,60 € »
```

### Total annoncé contre l’attente du client

- Première version : **877,10 €** annoncés, **877,10 €** attendus → écart 0,00 €.
- Après modification : **836,60 €** annoncés, **836,60 €** attendus → écart **0,00 €**.
- Commande 2026-0940 : acompte enregistré 200,00 € (virement), reste dû 636,60 €.
- Attente rédigée : Jour 1 : Matadi 20 × 4,50 € = 90,00 € + Écriture 2,00 € ; Fleur caramel chocolat 15 × 4,50 € = 67,50 € ; 2 Croûte Fruits 8P 64,00 € ; 30 Mini burger 105,00 € ; 30 Mini batbout farci 75,00 € ; 40 Mini-sandwichs garnis 100,00 € ; 30 Mini bestella poulet × 2,90 € = 87,00 € ; 30 Mini cigare fruits de mer × 2,10 € = 63,00 € ; 30 Mini bavarois 75,00 € ; 30 Mini mille-feuille 45,00 € ; 20 Mini Croissant 26,00 € ; 20 Mini Pain chocolat 26,00 € ; 6 Coca + 6 Fanta 1,5L 33,60 € ; 12 Grande Bouteille d'eau SPA 1,5L 18,00 €. Total 877,10 € ; acompte 200,00 € < 438,55 € : avertissement. Lendemain : Matadi 25 × 4,50 € = 112,50 € (+22,50 €), cigares retirés (−63,00 €) → 836,60 € ; retrait 18/12 à 11h00.

### Bons sortis

`bons/C40-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt` · `bons/C40-modifiee-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt` — la version « -modifiee » remplace la première (bandeau « MODIFIÉE … Jetez l’ancien bon »).

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon
- acompte PAR VIREMENT pas encore reçu : les bons internes impriment « ACOMPTE 200,00 € » comme un acompte versé ; seul l’exemplaire CLIENT porte « Communication du virement »

### Remarques du vendeur

- 15 produits, 17 lignes au bon, total 877,10 € juste ; modification du lendemain juste aussi (836,60 €).
- Mini éclair / mille-feuille, briwate / cigare, bestella poulet / fruits de mer : le choix du client n’est qu’une précision libre. Retirer « les cigares », c’est retirer la ligne entière : s’il y avait eu briwates ET cigares sur la même ligne, il aurait fallu recalculer à la main.
- Acompte 200 € par virement, pas encore reçu : imprimé « ACOMPTE 200,00 € ».
- Facture : remarque libre.
- À l’ouverture en modification, retrouver « Matadi » parmi 17 onglets demande de lire ; l’historique enregistre l’ancienne version complète.

---

## C41 — Guy Lemaire (comptoir)

> **Le client dit :** Pour demain matin à l'ouverture, vous me mettez de côté 6 croissants et 4 couques au chocolat ? Sinon à 6h il n'y a pas encore tout.
> **Retrait souhaité :** demain à 6h · **Paiement :** Je paie maintenant, comme ça c'est fait.
> **Rebondissements :** Si on lui demande « pain au chocolat ou croissant au chocolat ? » : « La couque au chocolat normale, rectangulaire, avec les deux barres. » / « Dans deux sachets séparés, s'il vous plaît. »

**Résultat : validée** — commande n° 2026-0941 · **22 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Guy Lemaire »
Étape 1 · Téléphone (pavé) : 0475 61 28 94
Étape 1 · Jour de retrait : vendredi 20 novembre
   ↳ APP : INFO_COMMANDE_LENDEMAIN — « Commande pour demain : prévenez l’atelier. » — aucune sortie proposée
Étape 1 · Heure de retrait : 06:00
« Continuer : les produits »
Étape 2 · Recherche « croissant » → 6 produit(s) : Croissant (1,60 €) · Croissant au chocolat (1,90 €) · Croissant aux amandes (2,30 €) · Croissant à la pâte d'amande (2,30 €) · Mini Croissant (1,30 €) · Croissant et couque a la crème (2,50 €)
Étape 2 · Toucher carte « Croissant » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 6 — Croissant
Étape 2 · Recherche « couque chocolat » → RIEN (aucune tuile, aucun produit)
Étape 2 · Recherche « couque » → 5 produit(s) : Couque au beurre (1,60 €) · Couque aux raisins (1,60 €) · Couque suisse longue (1,90 €) · Couque suisse ronde (1,90 €) · Croissant et couque a la crème (2,50 €)
Aucune « couque au chocolat » : « Croissant au chocolat » ou « Pain chocolat » ? Client : « La normale, rectangulaire, avec les deux barres. » → Pain chocolat.
Étape 2 · Recherche « pain chocolat » → 2 produit(s) : Pain chocolat (1,60 €) · Mini Pain chocolat (1,30 €)
Étape 2 · Toucher carte « Pain chocolat » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 4 — Pain chocolat
« Continuer : le paiement »
Étape 3 · Remarques : « Dans deux sachets séparés (croissants / couques au chocolat). À mettre de côté pour 6h. »
Étape 3 · Acompte au pavé : 16,00 €
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 16,00 €, acompte 16,00 €, reste 0,00 €.
```

### Total annoncé contre l’attente du client

- Total : **16,00 €** annoncés, **16,00 €** attendus → écart **0,00 €**.
- Commande 2026-0941 : acompte enregistré 16,00 € (espèces), reste dû 0,00 €.
- Attente rédigée : 6 Croissant × 1,60 € = 9,60 € ; 4 Pain chocolat × 1,60 € = 6,40 €. Total 16,00 €, payé en entier. Retrait vendredi 20/11 à 6h00 (accepté, borne d'ouverture incluse). Précision libre : deux sachets séparés. Prévenir le fournil.

### Bons sortis

`bons/C41-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- rien (tout ce que j’ai saisi se retrouve sur au moins un exemplaire).

### Remarques du vendeur

- JE NE TROUVE PAS « couque chocolat ». C’est le « Pain chocolat » ; il y a aussi « Croissant au chocolat » juste à côté.
- « Deux sachets séparés » : remarque de commande.

---

## C42 — Caroline Thys (telephone)

> **Le client dit :** Bonjour, c'est pour un petit-déjeuner au bureau lundi : 60 pièces, moitié croissants moitié couques. Vous pouvez les emballer par 6 ? On les répartit par étage.
> **Retrait souhaité :** lundi à 7h30 · **Paiement :** Je peux payer par carte lundi en venant ? Sinon je passe samedi pour l'acompte.
> **Rebondissements :** Quand on lui demande quelles couques : « Au chocolat. Enfin... 20 au chocolat et 10 aux raisins, tiens. » / « Donc 10 paquets de 6, c'est bon ? »

**Résultat : validée** — commande n° 2026-0942 · **25 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Caroline Thys »
Étape 1 · Téléphone (pavé) : 0478 37 15 60
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : lundi 23 novembre
Étape 1 · Heure de retrait : 07:30
« Continuer : les produits »
Étape 2 · Recherche « croissant » → 6 produit(s) : Croissant (1,60 €) · Croissant au chocolat (1,90 €) · Croissant aux amandes (2,30 €) · Croissant à la pâte d'amande (2,30 €) · Mini Croissant (1,30 €) · Croissant et couque a la crème (2,50 €)
Étape 2 · Toucher carte « Croissant » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 30 — Croissant
« Couques » : lesquelles ? Cliente : « Au chocolat. Enfin… 20 au chocolat et 10 aux raisins. »
Étape 2 · Recherche « pain chocolat » → 2 produit(s) : Pain chocolat (1,60 €) · Mini Pain chocolat (1,30 €)
Étape 2 · Toucher carte « Pain chocolat » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 20 — Pain chocolat
Étape 2 · Recherche « raisin » → 2 produit(s) : Couque aux raisins (1,60 €) · Pain aux raisins (1,90 €)
Étape 2 · Toucher carte « Couque aux raisins » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 10 — Couque aux raisins
« Continuer : le paiement »
Étape 3 · Remarques : « Emballer par 6 : 10 paquets (répartis par étage). Paie par carte lundi, ou passe samedi pour l’acompte. »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (48,00 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 48,00 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 96,00 €, acompte 0,00 €, reste 96,00 €.
```

### Total annoncé contre l’attente du client

- Total : **96,00 €** annoncés, **96,00 €** attendus → écart **0,00 €**.
- Commande 2026-0942 : acompte enregistré 0,00 € (espèces), reste dû 96,00 €.
- Écart d’ACOMPTE : le client annonce un acompte à venir (plus tard, en espèces ou par carte) ; rien n’étant reçu, j’ai enregistré 0,00 € et noté la promesse en remarque (aucun champ « acompte promis »).
- Attente rédigée : 30 Croissant × 1,60 € = 48,00 € ; 20 Pain chocolat × 1,60 € = 32,00 € ; 10 Couque aux raisins × 1,60 € = 16,00 €. Total 96,00 €. Retrait lundi 23/11 à 7h30. Précision : emballé par 6 (10 paquets). Acompte 0 € pour l'instant : avertissement (viser 48,00 €).

### Bons sortis

`bons/C42-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- « Couques » tout court : cinq cartes. L’écran ne peut pas m’aider, il faut demander.
- Emballage par 6 : remarque libre.

---

## C43 — Julien Marchal (whatsapp)

> **Le client dit :** Bonjour, pour une formation mercredi il nous faut 120 viennoiseries assorties : croissants, pains au chocolat, couques aux raisins et torsades. Vous répartissez comme vous voulez.
> **Retrait souhaité :** mercredi à 6h30 · **Paiement :** Virement de la moitié dès que j'ai le montant.
> **Rebondissements :** Si on lui demande de trancher : « Alors 40 croissants, 40 pains au chocolat, 20 raisins, 20 torsades. » / DEUX JOURS PLUS TARD (samedi 21/11), il réécrit : « Il y a des désistements, on descend à 90 : enlevez 20 croissants et 10 pains au chocolat. » / « Je récupère la différence sur l'acompte ? »

**Résultat : validée** — commande n° 2026-0943 · **40 gestes** environ · code du manager : non utilisé

### Jour 1 (jeudi 19/11) — prise de commande

```
Étape 1 · Nom du client : « Julien Marchal »
Étape 1 · Téléphone (pavé) : 0491 74 03 58
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : mercredi 25 novembre
Étape 1 · Heure de retrait : 06:30
« Continuer : les produits »
« Répartissez comme vous voulez » : l’écran veut une quantité par produit. Client : « 40 croissants, 40 pains au chocolat, 20 raisins, 20 torsades. »
Étape 2 · Recherche « croissant » → 6 produit(s) : Croissant (1,60 €) · Croissant au chocolat (1,90 €) · Croissant aux amandes (2,30 €) · Croissant à la pâte d'amande (2,30 €) · Mini Croissant (1,30 €) · Croissant et couque a la crème (2,50 €)
Étape 2 · Toucher carte « Croissant » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 40 — Croissant
Étape 2 · Recherche « pain chocolat » → 2 produit(s) : Pain chocolat (1,60 €) · Mini Pain chocolat (1,30 €)
Étape 2 · Toucher carte « Pain chocolat » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 40 — Pain chocolat
Étape 2 · Recherche « raisin » → 2 produit(s) : Couque aux raisins (1,60 €) · Pain aux raisins (1,90 €)
Étape 2 · Toucher carte « Couque aux raisins » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 20 — Couque aux raisins
Étape 2 · Recherche « torsade » → 1 produit(s) : Torsade (1,90 €)
Étape 2 · Toucher carte « Torsade » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 20 — Torsade
« Continuer : le paiement »
Étape 3 · Acompte au pavé : 99,00 €
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 198,00 €, acompte 99,00 €, reste 99,00 €.
```

### Jour 3 (samedi 21/11) — modification

```
SAMEDI 21/11 — il réécrit : 90 au lieu de 120. Liste des commandes → « Modifier ».
Étape 2 · Toucher l’onglet « Croissant » du bon pour rouvrir ses réglages
Étape 2 · Quantité au pavé : 20 — Croissant
   ↳ APP : AVERT_COMMANDE_DEJA_IMPRIMEE — « Cette commande est déjà imprimée : réimprimez les bons après la modification. » — sortie(s) : [Réimprimer]
Étape 2 · Toucher l’onglet « Pain chocolat » du bon pour rouvrir ses réglages
Étape 2 · Quantité au pavé : 30 — Pain chocolat
« Continuer : le paiement »
Client : « Je récupère la différence sur l’acompte ? » — l’écran : total 150,00 €, acompte 99,00 €, reste 51,00 €. Rien à rembourser ; aucun message sur l’acompte (il dépasse 50 %).
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 150,00 €, acompte 99,00 €, reste 51,00 €.
   ↳ Historique enregistré : « à réimprimer — produits — avant : 40 × Croissant à 1,60 € ; 40 × Pain chocolat à 1,60 € ; 20 × Couque aux raisins à 1,60 € ; 20 × Torsade à 1,90 €, total : 198,00 € → 150,00 € »
```

### Total annoncé contre l’attente du client

- Première version : **198,00 €** annoncés, **198,00 €** attendus → écart 0,00 €.
- Après modification : **150,00 €** annoncés, **150,00 €** attendus → écart **0,00 €**.
- Commande 2026-0943 : acompte enregistré 99,00 € (virement), reste dû 51,00 €.
- Attente rédigée : 40 Croissant × 1,60 € = 64,00 € ; 40 Pain chocolat × 1,60 € = 64,00 € ; 20 Couque aux raisins × 1,60 € = 32,00 € ; 20 Torsade × 1,90 € = 38,00 €. Total 198,00 €, acompte 99,00 €. Après modification : 20 Croissant 32,00 € + 30 Pain chocolat 48,00 € + 32,00 € + 38,00 € = 150,00 € ; l'acompte de 99,00 € reste inférieur au total, reste dû 51,00 € (pas de remboursement à faire). Retrait mercredi 25/11 à 6h30.

### Bons sortis

`bons/C43-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt` · `bons/C43-modifiee-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt` — la version « -modifiee » remplace la première (bandeau « MODIFIÉE … Jetez l’ancien bon »).

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon
- acompte PAR VIREMENT pas encore reçu : les bons internes impriment « ACOMPTE 99,00 € » comme un acompte versé ; seul l’exemplaire CLIENT porte « Communication du virement »

### Remarques du vendeur

- Baisse de quantité simple ; l’acompte de 99,00 € reste, reste dû 51,00 €, aucun message parasite.
- Le bandeau « MODIFIÉE » sort bien. L’historique garde l’ancienne répartition.
- L’acompte est toujours « par virement » : l’écran de commande ne me dit pas s’il est arrivé.

---

## C44 — Patricia Van Damme (telephone)

> **Le client dit :** Bonjour, j'organise un séminaire jeudi prochain, 120 participants. Il me faudrait 250 mini viennoiseries : 100 mini croissants, 100 mini pains au chocolat et 50 mini suisses. C'est possible pour 7h ?
> **Retrait souhaité :** jeudi prochain à 7h · **Paiement :** On paie l'acompte par virement, envoyez-moi le montant exact.
> **Rebondissements :** « Dans des boîtes de 25, si possible, pour les poser sur les tables. » / « Et vous livrez ? Non ? Bon, on enverra quelqu'un avec une camionnette. » / « Si 250 c'est trop pour le fournil, dites-le-moi maintenant. »

**Résultat : validée** — commande n° 2026-0944 · **26 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Patricia Van Damme »
Étape 1 · Téléphone (pavé) : 0476 92 40 17
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : jeudi 26 novembre
Étape 1 · Heure de retrait : 07:00
« Continuer : les produits »
Étape 2 · Recherche « mini croissant » → 1 produit(s) : Mini Croissant (1,30 €)
Étape 2 · Toucher carte « Mini Croissant » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 100 — Mini Croissant
Étape 2 · Recherche « mini pain chocolat » → 1 produit(s) : Mini Pain chocolat (1,30 €)
Étape 2 · Toucher carte « Mini Pain chocolat » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 100 — Mini Pain chocolat
Étape 2 · Recherche « mini suisse » → 1 produit(s) : Mini Suisse (1,60 €)
Étape 2 · Toucher carte « Mini Suisse » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 50 — Mini Suisse
250 pièces : aucun message de l’écran sur la capacité du fournil. Je coche « Demande inhabituelle » pour que le bon dise « à confirmer », même si le libellé de la case parle d’ingrédient ou de moule.
« Continuer : le paiement »
Étape 3 · Remarques : « Séminaire 120 personnes. Boîtes de 25 si possible. PAS de livraison : ils envoient une camionnette. Capacité du fournil à confirmer AVANT de dire oui. »
Étape 3 · Case « Demande inhabituelle (ingrédient particulier, moule spécial…) » cochée
   ↳ APP : AVERT_COMMANDE_INHABITUELLE — « Commande inhabituelle : demandez d’abord l’accord du manager avant de confirmer au client. Le client peut aussi commander par WhatsApp. » — sortie(s) : [(Appeler le manager ou proposer WhatsApp)]
Étape 3 · Acompte au pavé : 170,00 €
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 340,00 €, acompte 170,00 €, reste 170,00 €.
```

### Total annoncé contre l’attente du client

- Total : **340,00 €** annoncés, **340,00 €** attendus → écart **0,00 €**.
- Commande 2026-0944 : acompte enregistré 170,00 € (virement), reste dû 170,00 €.
- Attente rédigée : 100 Mini Croissant × 1,30 € = 130,00 € ; 100 Mini Pain chocolat × 1,30 € = 130,00 € ; 50 Mini Suisse × 1,60 € = 80,00 €. Total 340,00 €. Acompte 170,00 €. Retrait jeudi 26/11 à 7h00. Vérifier avec le responsable du fournil avant de confirmer ; boîtes de 25 en remarque ; pas de livraison au tarif.

### Bons sortis

`bons/C44-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon
- acompte PAR VIREMENT pas encore reçu : les bons internes impriment « ACOMPTE 170,00 € » comme un acompte versé ; seul l’exemplaire CLIENT porte « Communication du virement »

### Remarques du vendeur

- 250 pièces pour 7h : l’écran accepte sans un mot. La case « Demande inhabituelle (ingrédient particulier, moule spécial…) » est le seul moyen de faire imprimer « À CONFIRMER », mais son libellé ne parle pas de quantité.
- Boîtes de 25, pas de livraison : remarques.

---

## C45 — Hassan Ben Ali (comptoir)

> **Le client dit :** Pour samedi matin, il me faut deux plateaux de croissants et un plateau de couques au chocolat, c'est pour la mosquée après la prière.
> **Retrait souhaité :** samedi à 8h · **Paiement :** Je donne 40 € maintenant.
> **Rebondissements :** « Un plateau c'est combien de pièces chez vous ? 16 ? Ah, je pensais 20. Alors ça fait 32 et 16, c'est bon. » / « Et un demi-plateau de couques au beurre. » / « Vous me les laissez sur les plateaux ? Je les ramène lundi. »

**Résultat : validée** — commande n° 2026-0945 · **30 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Hassan Ben Ali »
Étape 1 · Téléphone (pavé) : 0485 08 63 72
Étape 1 · Jour de retrait : samedi 21 novembre
Étape 1 · Heure de retrait : 08:00
« Continuer : les produits »
Le client parle en plateaux ; la ligne « Croissant » ne connaît que des pièces (aucun bouton « plateau », aucune mention « 16 par plateau »). Je sais que c’est 16 : 2 × 16 = 32, 1 × 16 = 16, de tête.
Étape 2 · Recherche « croissant » → 6 produit(s) : Croissant (1,60 €) · Croissant au chocolat (1,90 €) · Croissant aux amandes (2,30 €) · Croissant à la pâte d'amande (2,30 €) · Mini Croissant (1,30 €) · Croissant et couque a la crème (2,50 €)
Étape 2 · Toucher carte « Croissant » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 32 — Croissant
Étape 2 · « Précision… » de la ligne Croissant : « 2 plateaux »
Étape 2 · Recherche « pain chocolat » → 2 produit(s) : Pain chocolat (1,60 €) · Mini Pain chocolat (1,30 €)
Étape 2 · Toucher carte « Pain chocolat » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 16 — Pain chocolat
Étape 2 · « Précision… » de la ligne Pain chocolat : « 1 plateau »
Client : « Et un demi-plateau de couques au beurre. » — combien de pièces par plateau pour la couque au beurre ? Je ne sais pas ; je compte 8 comme pour les croissants, à confirmer.
Étape 2 · Recherche « couque beurre » → 1 produit(s) : Couque au beurre (1,60 €)
Étape 2 · Toucher carte « Couque au beurre » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 8 — Couque au beurre
Étape 2 · « Précision… » de la ligne Couque au beurre : « demi-plateau (8 ? à confirmer) »
« Continuer : le paiement »
Étape 3 · Remarques : « À laisser SUR LES PLATEAUX : le client les ramène lundi. »
Étape 3 · Acompte au pavé : 40,00 €
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (44,80 €) : 40,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 44,80 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 89,60 €, acompte 40,00 €, reste 49,60 €.
```

### Total annoncé contre l’attente du client

- Total : **89,60 €** annoncés, **89,60 €** attendus → écart **0,00 €**.
- Commande 2026-0945 : acompte enregistré 40,00 € (espèces), reste dû 49,60 €.
- Attente rédigée : 2 plateaux = 32 Croissant × 1,60 € = 51,20 € ; 1 plateau = 16 Pain chocolat × 1,60 € = 25,60 € ; demi-plateau = 8 Couque au beurre × 1,60 € = 12,80 € (à confirmer en pièces avec le client). Total 89,60 €. Retrait samedi 21/11 à 8h00. Acompte 40,00 € < 44,80 € : avertissement.

### Bons sortis

`bons/C45-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- rien (tout ce que j’ai saisi se retrouve sur au moins un exemplaire).

### Remarques du vendeur

- Aucune notion de plateau à la commande : ni bouton, ni « 16 par plateau » affiché. Multiplication de tête, et pour la couque au beurre je ne connais pas la contenance.
- Le bon dit « 32 × Croissant / 2 plateaux » parce que je l’ai écrit.

---

## C46 — Martine Baudoux (telephone)

> **Le client dit :** Bonjour, pour le petit-déjeuner des pensionnaires dimanche : 17 croissants, pas un de plus, et 33 pistolets, 17 blancs et 16 gris.
> **Retrait souhaité :** dimanche à 7h15 · **Paiement :** C'est la maison de repos qui paie, je règle dimanche par carte.
> **Rebondissements :** Si on propose d'arrondir : « Non non, 17 et 33, on est 17 et je compte au plus juste. » / « Ah, et 3 baguettes au levain. »

**Résultat : validée** — commande n° 2026-0946 · **28 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Martine Baudoux »
Étape 1 · Téléphone (pavé) : 0473 15 97 46
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : dimanche 22 novembre
Étape 1 · Heure de retrait : 07:15
« Continuer : les produits »
Étape 2 · Recherche « croissant » → 6 produit(s) : Croissant (1,60 €) · Croissant au chocolat (1,90 €) · Croissant aux amandes (2,30 €) · Croissant à la pâte d'amande (2,30 €) · Mini Croissant (1,30 €) · Croissant et couque a la crème (2,50 €)
Étape 2 · Toucher carte « Croissant » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 17 — Croissant
Étape 2 · Recherche « pistolet » → 2 produit(s) : Pistolet blanc (0,70 €) · Pistolet gris (0,70 €)
Étape 2 · Toucher carte « Pistolet blanc » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 17 — Pistolet blanc
Étape 2 · Toucher carte « Pistolet gris » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 16 — Pistolet gris
Cliente : « Ah, et 3 baguettes au levain. »
Étape 2 · Recherche « baguette levain » → 1 produit(s) : Baguette au levain (2,10 €)
Étape 2 · Toucher carte « Baguette au levain » × 3 → 3 au bon, pavé de quantité ouvert
« Continuer : le paiement »
Étape 3 · Remarques : « Maison de repos : paie dimanche par carte. 17 et 33, au plus juste. »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (28,30 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 28,30 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 56,60 €, acompte 0,00 €, reste 56,60 €.
```

### Total annoncé contre l’attente du client

- Total : **56,60 €** annoncés, **56,60 €** attendus → écart **0,00 €**.
- Commande 2026-0946 : acompte enregistré 0,00 € (espèces), reste dû 56,60 €.
- Attente rédigée : 17 Croissant × 1,60 € = 27,20 € ; 17 Pistolet blanc × 0,70 € = 11,90 € ; 16 Pistolet gris × 0,70 € = 11,20 € ; 3 Baguette au levain × 2,10 € = 6,30 €. Total 56,60 €. Retrait dimanche 22/11 à 7h15. Acompte 0 € : avertissement (viser 28,30 €).

### Bons sortis

`bons/C46-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- 17, 17, 16, 3 : acceptés tels quels, aucun arrondi ni proposition de plateau. (Le remplacement du « 1 » posé par le toucher par le premier chiffre tapé est une règle du pavé : lue, non exécutée ici.)
- Paiement par carte au retrait : pas de mode.

---

## C47 — Dylan Michiels (whatsapp)

> **Le client dit :** (message envoyé à 5h40) Bonjour, je passe à l'ouverture tout à l'heure à 6h, vous pouvez me préparer une douzaine de croissants et une vingtaine de pistolets ? Merci
> **Retrait souhaité :** aujourd'hui à 6h, à l'ouverture · **Paiement :** Je paie en passant.
> **Rebondissements :** « Une vingtaine, ben 20. Blancs. » / « Si les croissants ne sont pas tous sortis à 6h, je prends ce qu'il y a et le reste en pains au chocolat. »

**Résultat : validée** — commande n° 2026-0947 · **21 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Dylan Michiels »
Étape 1 · Téléphone (pavé) : 0468 42 70 31
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : jeudi 19 novembre
   ↳ APP : INFO_COMMANDE_JOUR_MEME — « Commande pour aujourd’hui : prévenez l’atelier tout de suite. » — aucune sortie proposée
Étape 1 · Heure de retrait : 06:00
« Continuer : les produits »
Étape 2 · Recherche « croissant » → 6 produit(s) : Croissant (1,60 €) · Croissant au chocolat (1,90 €) · Croissant aux amandes (2,30 €) · Croissant à la pâte d'amande (2,30 €) · Mini Croissant (1,30 €) · Croissant et couque a la crème (2,50 €)
Étape 2 · Toucher carte « Croissant » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 12 — Croissant
« Une vingtaine de pistolets » : je fais préciser. « 20. Blancs. »
Étape 2 · Recherche « pistolet » → 2 produit(s) : Pistolet blanc (0,70 €) · Pistolet gris (0,70 €)
Étape 2 · Toucher carte « Pistolet blanc » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 20 — Pistolet blanc
« Continuer : le paiement »
Étape 3 · Remarques : « Si les croissants ne sont pas tous sortis à 6h : il prend ce qu’il y a, le reste en pains au chocolat. »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (16,60 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 16,60 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 33,20 €, acompte 0,00 €, reste 33,20 €.
```

### Essai à part

```
ESSAI À PART (non enregistré) : le même message lu à 10h15, donc APRÈS l’heure demandée.
Étape 1 · Nom du client : « Dylan Michiels »
Étape 1 · Téléphone (pavé) : 0468 42 70 31
Étape 1 · Jour de retrait : jeudi 19 novembre
   ↳ APP : INFO_COMMANDE_JOUR_MEME — « Commande pour aujourd’hui : prévenez l’atelier tout de suite. » — aucune sortie proposée
Étape 1 · Heure de retrait : 06:00
« Continuer : les produits »
Étape 2 · Toucher carte « Croissant » × 12 → 12 au bon, pavé de quantité ouvert
« Continuer : le paiement »
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (9,60 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 9,60 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 19,20 €, acompte 0,00 €, reste 19,20 €.
→ ACCEPTÉE : retrait « aujourd’hui 6h00 » alors qu’il est 10h15. Aucun message ne dit que l’heure est passée.
```

### Total annoncé contre l’attente du client

- Total : **33,20 €** annoncés, **33,20 €** attendus → écart **0,00 €**.
- Commande 2026-0947 : acompte enregistré 0,00 € (espèces), reste dû 33,20 €.
- Attente rédigée : 12 Croissant × 1,60 € = 19,20 € ; 20 Pistolet blanc × 0,70 € = 14,00 €. Total 33,20 €. Retrait jeudi 19/11 à 6h00. Substitution éventuelle en Pain chocolat (même prix 1,60 €) notée en remarque. Si le message est lu après 6h : heure passée, à voir avec le client.

### Bons sortis

`bons/C47-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- Lu à 5h45 pour 6h00 : accepté, information « prévenez l’atelier tout de suite ».
- ESSAI : la même commande saisie à 10h15 pour « aujourd’hui 6h00 » est ACCEPTÉE sans un mot. L’heure de retrait déjà passée n’est pas vue.
- Substitution conditionnelle : remarque libre.

---

## C48 — Nicolas Pirard (telephone)

> **Le client dit :** Bonjour, pour lundi 6h : 20 croissants, 10 croissants aux amandes et 10 baguettes blanches. Et la même chose pour vendredi, tant qu'on y est.
> **Retrait souhaité :** lundi à 6h, et vendredi à 6h · **Paiement :** Je paie lundi pour les deux.
> **Rebondissements :** « Vendredi de la semaine prochaine, le 27, pas demain. » / « Croissants aux amandes, pas à la pâte d'amande, c'est pas le même ? Ceux avec les amandes effilées dessus. » / « Pour vendredi mettez 15 baguettes plutôt que 10. »

**Résultat : validée (2 commandes)** — commandes n° 2026-0949, 2026-0950 · **48 gestes** environ · code du manager : non utilisé

### Commande 1 — lundi 23/11 à 6h

```
Étape 1 · Nom du client : « Nicolas Pirard »
Étape 1 · Téléphone (pavé) : 0479 26 84 05
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : lundi 23 novembre
Étape 1 · Heure de retrait : 06:00
« Continuer : les produits »
Étape 2 · Recherche « croissant » → 6 produit(s) : Croissant (1,60 €) · Croissant au chocolat (1,90 €) · Croissant aux amandes (2,30 €) · Croissant à la pâte d'amande (2,30 €) · Mini Croissant (1,30 €) · Croissant et couque a la crème (2,50 €)
Étape 2 · Toucher carte « Croissant » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 20 — Croissant
Deux cartes proches : « Croissant aux amandes » et « Croissant à la pâte d’amande » (même prix). Client : « Ceux avec les amandes effilées dessus. » → Croissant aux amandes.
Étape 2 · Toucher carte « Croissant aux amandes » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 10 — Croissant aux amandes
Étape 2 · Recherche « baguette » → 5 produit(s) : Baguette grise (1,40 €) · Baguette blanche (1,40 €) · Baguette Sésames (1,60 €) · Baguette Céréales (1,80 €) · Baguette au levain (2,10 €)
Étape 2 · Toucher carte « Baguette blanche » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 10 — Baguette blanche
« Continuer : le paiement »
Étape 3 · Remarques : « Paie lundi pour les deux commandes (lundi 23 et vendredi 27). »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (34,50 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 34,50 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 69,00 €, acompte 0,00 €, reste 69,00 €.
```

### Commande 2 — vendredi 27/11 à 6h

```
Étape 1 · Nom du client : « Nicolas Pirard »
Étape 1 · Téléphone (pavé) : 0479 26 84 05
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait : vendredi 27 novembre
Étape 1 · Heure de retrait : 06:00
« Continuer : les produits »
« La même chose pour vendredi » (le 27, pas demain) : aucun bouton pour recopier une commande — je ressaisis tout, client compris.
Étape 2 · Recherche « croissant » → 6 produit(s) : Croissant (1,60 €) · Croissant au chocolat (1,90 €) · Croissant aux amandes (2,30 €) · Croissant à la pâte d'amande (2,30 €) · Mini Croissant (1,30 €) · Croissant et couque a la crème (2,50 €)
Étape 2 · Toucher carte « Croissant » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 20 — Croissant
Étape 2 · Toucher carte « Croissant aux amandes » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 10 — Croissant aux amandes
Étape 2 · Recherche « baguette » → 5 produit(s) : Baguette grise (1,40 €) · Baguette blanche (1,40 €) · Baguette Sésames (1,60 €) · Baguette Céréales (1,80 €) · Baguette au levain (2,10 €)
Étape 2 · Toucher carte « Baguette blanche » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 15 — Baguette blanche
« Continuer : le paiement »
Étape 3 · Remarques : « Paie lundi 23/11 pour les deux commandes. »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (38,00 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 38,00 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 76,00 €, acompte 0,00 €, reste 76,00 €.
```

### Total annoncé contre l’attente du client

- Total : **145,00 €** annoncés, **145,00 €** attendus → écart **0,00 €**.
- Commande 2026-0949 : acompte enregistré 0,00 € (espèces), reste dû 69,00 €.
- Commande 2026-0950 : acompte enregistré 0,00 € (espèces), reste dû 76,00 €.
- Attente rédigée : Commande 1, lundi 23/11 à 6h00 : 20 Croissant × 1,60 € = 32,00 € ; 10 Croissant aux amandes × 2,30 € = 23,00 € ; 10 Baguette blanche × 1,40 € = 14,00 € → 69,00 €. Commande 2, vendredi 27/11 à 6h00 : 32,00 € + 23,00 € + 15 Baguette blanche × 1,40 € = 21,00 € → 76,00 €. Deux bons, 145,00 € au total. Acompte 0 € sur chacun : avertissement.

### Bons sortis

`bons/C48-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt` · `bons/C48-b-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- « La même chose pour vendredi » : il n’y a pas de bouton « recopier la commande ». J’ai tout ressaisi (nom, téléphone, 3 produits) : 24 gestes de plus, et une chance de me tromper.
- Croissant aux amandes / à la pâte d’amande : deux cartes voisines au même prix.
- Deux bons, deux numéros : aucun lien entre les deux commandes (« paie lundi pour les deux » n’est qu’une remarque).

---

## C49 — Amina Ouazzani (whatsapp)

> **Le client dit :** Bonjour, pour une réunion de parents mardi matin je voudrais 25 croissants, 25 pains au chocolat et 10 de vos couques rondes aux raisins. Je passe mardi vers 8h.
> **Retrait souhaité :** mardi 24 novembre à 8h · **Paiement :** Je vous dépose 50 € demain.
> **Rebondissements :** Quand on lui dit fermé le mardi : « Ah oui c'est vrai... Lundi soir juste avant la fermeture alors, 19h45. Elles seront encore bonnes mardi ? » / Pour les couques rondes : « Celles en escargot, avec la crème et les raisins. » (Couque suisse ronde, pas Couque aux raisins) / « Emballez bien, dans des boîtes fermées. »

**Résultat : validée** — commande n° 2026-0951 · **27 gestes** environ · code du manager : non utilisé

### Prise de commande

```
Étape 1 · Nom du client : « Amina Ouazzani »
Étape 1 · Téléphone (pavé) : 0487 19 35 62
Étape 1 · « Commande prise » : Téléphone (le paiement passe d’office sur Virement)
Étape 1 · Jour de retrait mardi 24 novembre (mardi demandé) : la case est grisée dans la bande (jour fermé), impossible à toucher.
   ↳ DOMAINE (ce que dirait le serveur si la date arrivait quand même) : ERR_JOUR_FERME — « Fermé le mardi — choisissez un autre jour de retrait. » — valeur proposée : "2026-11-25"
Cliente : « Ah oui c’est vrai… Lundi soir juste avant la fermeture alors, 19h45. »
Étape 1 · Jour de retrait : lundi 23 novembre
Étape 1 · Heure de retrait : 19:45
« Continuer : les produits »
Étape 2 · Recherche « croissant » → 6 produit(s) : Croissant (1,60 €) · Croissant au chocolat (1,90 €) · Croissant aux amandes (2,30 €) · Croissant à la pâte d'amande (2,30 €) · Mini Croissant (1,30 €) · Croissant et couque a la crème (2,50 €)
Étape 2 · Toucher carte « Croissant » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 25 — Croissant
Étape 2 · Recherche « pain chocolat » → 2 produit(s) : Pain chocolat (1,60 €) · Mini Pain chocolat (1,30 €)
Étape 2 · Toucher carte « Pain chocolat » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 25 — Pain chocolat
Étape 2 · Recherche « couque ronde raisins » → RIEN (aucune tuile, aucun produit)
Étape 2 · Recherche « raisin » → 2 produit(s) : Couque aux raisins (1,60 €) · Pain aux raisins (1,90 €)
« Couques rondes aux raisins » : Couque aux raisins (1,60 €) ? Cliente : « Celles en escargot, avec la crème et les raisins. » → c’est la Couque suisse ronde (1,90 €). Rien à l’écran ne décrit les produits : je le sais parce que je connais la vitrine.
Étape 2 · Recherche « suisse » → 3 produit(s) : Couque suisse longue (1,90 €) · Couque suisse ronde (1,90 €) · Mini Suisse (1,60 €)
Étape 2 · Toucher carte « Couque suisse ronde » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 10 — Couque suisse ronde
« Continuer : le paiement »
Étape 3 · Remarques : « Dépose 50 € d’acompte demain. Emballer en boîtes FERMÉES (c’est pour mardi matin). »
Étape 3 · Paiement : Espèces
Étape 3 · Bouton « Pas d’acompte »
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (49,50 €) : 0,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 49,50 €]
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 99,00 €, acompte 0,00 €, reste 99,00 €.
```

### Total annoncé contre l’attente du client

- Total : **99,00 €** annoncés, **99,00 €** attendus → écart **0,00 €**.
- Commande 2026-0951 : acompte enregistré 0,00 € (espèces), reste dû 99,00 €.
- Écart d’ACOMPTE : le client annonce 50,00 € à venir (plus tard, en espèces ou par carte) ; rien n’étant reçu, j’ai enregistré 0,00 € et noté la promesse en remarque (aucun champ « acompte promis »).
- Attente rédigée : Mardi 24/11 refusé ; retrait lundi 23/11 à 19h45. 25 Croissant × 1,60 € = 40,00 € ; 25 Pain chocolat × 1,60 € = 40,00 € ; 10 Couque suisse ronde × 1,90 € = 19,00 €. Total 99,00 € (95,00 € si c'était Couque aux raisins). Acompte 50,00 € ≥ 49,50 €. Précision : boîtes fermées.

### Bons sortis

`bons/C49-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt`

**Saisi mais imprimé sur AUCUN bon :**

- origine « Téléphone » (et le canal WhatsApp, qui n’existe pas à l’écran) : enregistrée dans l’historique, imprimée sur aucun bon

### Remarques du vendeur

- Mardi grisé. 19h45 existe bien (créneaux au quart d’heure, dernier 20:00).
- « Couque ronde aux raisins » : la bonne réponse (Couque suisse ronde, 1,90 €) ne vient d’aucun mot tapé : « raisin » ne la montre pas. 3,00 € d’écart si on se trompe de carte.
- 50 € déposés demain : remarque libre.

---

## C50 — Brigitte Delvaux (comptoir)

> **Le client dit :** Pour samedi matin, j'ai toute la famille : 12 croissants emballés par 6, 6 couques aux raisins, deux fois le pain gris coupé, un grand pain au levain, un pain aux olives, un cramique, et un fraisier pour 6 pour le dessert.
> **Retrait souhaité :** samedi à 8h30 · **Paiement :** Je vous laisse 40 €.
> **Rebondissements :** Pour le pain gris : « Le grand, pas le petit. Coupé en tranches fines. Le levain, pas coupé. » / « Sur le fraisier, rien d'écrit. Rond. » / UNE HEURE PLUS TARD, elle revient au comptoir : « Mon frère vient aussi avec ses enfants, mettez 18 croissants au lieu de 12. Toujours par 6. »

**Résultat : validée** — commande n° 2026-0952 · **48 gestes** environ · code du manager : non utilisé

### Prise de commande (jeudi 19/11, 10h15)

```
Étape 1 · Nom du client : « Brigitte Delvaux »
Étape 1 · Téléphone (pavé) : 0474 58 02 91
Étape 1 · Jour de retrait : samedi 21 novembre
Étape 1 · Heure de retrait : 08:30
« Continuer : les produits »
Étape 2 · Recherche « croissant » → 6 produit(s) : Croissant (1,60 €) · Croissant au chocolat (1,90 €) · Croissant aux amandes (2,30 €) · Croissant à la pâte d'amande (2,30 €) · Mini Croissant (1,30 €) · Croissant et couque a la crème (2,50 €)
Étape 2 · Toucher carte « Croissant » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 12 — Croissant
Étape 2 · « Précision… » de la ligne Croissant : « emballés par 6 »
Étape 2 · Recherche « raisin » → 2 produit(s) : Couque aux raisins (1,60 €) · Pain aux raisins (1,90 €)
Étape 2 · Toucher carte « Couque aux raisins » → 1 au bon, pavé de quantité ouvert
Étape 2 · Quantité au pavé : 6 — Couque aux raisins
Étape 2 · Recherche « pain gris » → 10 produit(s) : Pain Marocain gris (1,40 €) · Pain Shawarma - bagnat gris (0,60 €) · Grand pain gris (2,90 €) · Grand pain demi gris (2,90 €) · Grand pain campagne Demi Gris (2,90 €) · Grand pain campagne Gris (2,90 €) · Petit pain gris (1,90 €) · Petit pain demi gris (1,90 €) …
« Le pain gris coupé » : Grand pain gris ou Petit pain gris ? Cliente : « Le grand. Coupé en tranches fines. Le levain, pas coupé. »
Étape 2 · Toucher carte « Grand pain gris » × 2 → 2 au bon, pavé de quantité ouvert
Étape 2 · « Précision… » de la ligne Grand pain gris : « coupés en tranches FINES »
Étape 2 · Recherche « levain » → 4 produit(s) : Baguette au levain (2,10 €) · Grand pain au levain (4,50 €) · Petit Pain au levain au seigle (3,90 €) · Grand Pain au levain au seigle (4,90 €)
Étape 2 · Toucher carte « Grand pain au levain » → 1 au bon, pavé de quantité ouvert
Étape 2 · « Précision… » de la ligne Grand pain au levain : « PAS coupé »
Étape 2 · Recherche « olive » → 3 produit(s) : Salami volaille olive (2,30 €) · Pain aux olives (1,90 €) · Ciabatta Aux olives (2,10 €)
Étape 2 · Toucher carte « Pain aux olives » → 1 au bon, pavé de quantité ouvert
Étape 2 · Recherche « cramique » → 1 produit(s) : Cramique (3,50 €)
Étape 2 · Toucher carte « Cramique » → 1 au bon, pavé de quantité ouvert
Étape 2 · Recherche « fraisier » → tuiles : Fraisier — 3 produit(s) : Fraisier 4P (20,00 €) · Fraisier 6P (31,00 €) · Fraisier 8P (36,00 €)
Étape 2 · Toucher la tuile « Fraisier » → gâteau au bon, goût « Fraisier » déjà posé, boutons de taille ouverts
Étape 2 · Bouton de taille « 6 » (affiché avec 31,00 €, prix du comptoir) → ligne : Fraisier 6P
   ↳ APP : ERR_FORME_MANQUANTE [ligne 7 : Fraisier 6P] — « Choisissez la forme de « Fraisier 6P » : carré ou rond. » — sortie(s) : [(champ vide : « À remplir : forme (carré ou rond) »)]
Étape 2 · Forme : Rond
   ↳ APP : AVERT_ECRITURE_NON_PRECISEE [ligne 7 : Fraisier 6P] — « Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ». » — aucune sortie proposée
Étape 2 · Bloc « Sur ce gâteau » : « Pas d’écriture » coché
« Continuer : le paiement »
Étape 3 · Acompte au pavé : 40,00 €
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 75,50 €, acompte 40,00 €, reste 35,50 €.
```

### Modification (jeudi 19/11, 11h20)

```
UNE HEURE PLUS TARD — elle revient : 18 croissants au lieu de 12. Liste des commandes → « Modifier ».
Étape 2 · Toucher l’onglet « Croissant » du bon pour rouvrir ses réglages
Étape 2 · Quantité au pavé : 18 — Croissant
   ↳ APP : AVERT_COMMANDE_DEJA_IMPRIMEE — « Cette commande est déjà imprimée : réimprimez les bons après la modification. » — sortie(s) : [Réimprimer]
   ↳ APP : AVERT_ACOMPTE_INSUFFISANT — « Essayez d’obtenir au moins 50 % d’acompte (42,55 €) : 40,00 € saisi. La commande reste acceptée. » — sortie(s) : [Mettre l’acompte à 42,55 €]
« Continuer : le paiement »
Étape 3 · « Qui prend la commande ? » : Nadia
Étape 3 · « Valider la commande » → ENREGISTRÉE. Total 85,10 €, acompte 40,00 €, reste 45,10 €.
   ↳ Historique enregistré : « à réimprimer — produits — avant : 12 × Croissant [précision « emballés par 6 »] à 1,60 € ; 6 × Couque aux raisins à 1,60 € ; 2 × Grand pain gris [précision « coupés en tranches FINES »] à 2,90 € ; 1 × Grand pain au levain [précision « PAS coupé »] à 4,50 € ; 1 × Pain aux olives à 1,90 € ; 1 × Cramique à 3,50 € ; 1 × Fraisier 6P (rond) [goût Fraisier] à 31,00 €, total : 75,50 € → 85,10 € »
```

### Total annoncé contre l’attente du client

- Première version : **75,50 €** annoncés, **75,50 €** attendus → écart 0,00 €.
- Après modification : **85,10 €** annoncés, **85,10 €** attendus → écart **0,00 €**.
- Commande 2026-0952 : acompte enregistré 40,00 € (espèces), reste dû 45,10 €.
- Attente rédigée : 12 Croissant × 1,60 € = 19,20 € ; 6 Couque aux raisins × 1,60 € = 9,60 € ; 2 Grand pain gris × 2,90 € = 5,80 € ; 1 Grand pain au levain 4,50 € ; 1 Pain aux olives 1,90 € ; 1 Cramique 3,50 € ; Fraisier 6P 31,00 €. Total 75,50 € ; acompte 40,00 € ≥ 37,75 €. Après modification : 18 Croissant = 28,80 € → total 85,10 € ; acompte 40,00 € < 42,55 € : avertissement. Retrait samedi 21/11 à 8h30.

### Bons sortis

`bons/C50-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt` · `bons/C50-modifiee-{CLIENT,BUREAU,MAGASIN,ATELIER}.txt` — la version « -modifiee » remplace la première (bandeau « MODIFIÉE … Jetez l’ancien bon »).

**Saisi mais imprimé sur AUCUN bon :**

- rien (tout ce que j’ai saisi se retrouve sur au moins un exemplaire).

### Remarques du vendeur

- Commande mixte pains + gâteau sans difficulté ; précisions par ligne imprimées sous chaque ligne.
- Modification une heure après : la quantité se change, « déjà imprimée : réimprimez », avertissement d’acompte (40,00 € < 42,55 €) avec son bouton.
- Le Fraisier 6P commandé avec des pains : même écran, rien de spécial. Bien.

---
