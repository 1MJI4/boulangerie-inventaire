# Questions pour le gérant

> Chaque question ci-dessous correspond à une règle que l'application applique **par
> hypothèse** en attendant votre réponse. Une réponse d'une phrase suffit.
> Entre parenthèses : ce que l'application fait en attendant.
> Dès qu'une réponse arrive : la reporter dans `CLAUDE.md` et `docs/REGLES-METIER.md`,
> jamais directement dans le code.
>
> **À traiter en premier : « Accès et comptes » et « Prix sur commande ».**
>
> Les numéros ne changent jamais : une question ajoutée prend le numéro suivant, même si
> elle est rangée plus haut dans la liste.

## Déjà tranché — 15/10/2026

- ✅ **Minimum de parts non atteint → refusé.** Pas de supplément. L'application oblige à
  atteindre le minimum, en proposant la correction en un geste.
  *→ Pensez à corriger l'affiche « Gâteaux SIMPLES », qui promet encore un supplément.*
- ✅ Capacité de production journalière : **hors périmètre** pour l'instant.
- ✅ Heure limite de commande dans la journée : **hors périmètre**.
- ✅ Arrondi espèces : **reporté** (l'application n'encaisse pas).
- ✅ Prix de revient / valorisation du stock : **hors périmètre**. Le tarif est dans
  l'application pour fiabiliser la prise de commande, pas pour la comptabilité.
- ✅ **Pas de compte par employé.** Chaque tablette reçoit un code une seule fois, à
  l'installation, et reste connectée plusieurs mois. L'employé choisit son nom dans une
  liste, sans code personnel. Le code gérant n'est demandé que pour changer les prix ou les
  produits. *→ Les questions sur le code personnel, la déconnexion automatique et la
  coupure d'accès d'un employé qui part n'ont donc plus lieu d'être.*
- ✅ **L'inventaire a ses propres produits** : le catalogue de commande n'apparaît jamais
  dans l'inventaire.
- ✅ **Tous les chiffres de la prise de commande se tapent sur le pavé de l'application**,
  comme pour l'inventaire.
- ✅ **Acompte obligatoire : au moins 50 % du total**, pour toute commande (règlement
  intérieur). Sous 50 %, l'application refuse et propose le bon montant. Un acompte plus
  élevé que le total reste refusé. *(ancienne question 25)*
- ✅ **Commande pour le lendemain : acceptée.** Pas de code gérant. L'application affiche
  seulement « commande pour demain : prévenez l'atelier ». Une commande pour le jour même
  reste refusée. *(ancienne question 49)*
- ✅ **Heures de retrait pâtisserie réglables par vous**, jour par jour (lundi … dimanche),
  et pour une date précise (exemple : samedi 20/12 à 11h au lieu de 12h). Par défaut :
  9h du lundi au vendredi, 12h samedi et dimanche.
- ✅ **Gâteaux simples sur commande : tailles standard 4, 6, 8, 10, 15, 20, 25, 30 parts.**
  Une autre taille est refusée. L'application propose les deux tailles voisines en un
  geste (13 parts → « Passer à 10 » ou « Passer à 15 » ; 1 part → « Passer à 4 »). Le code
  gérant permet une exception, avec son nom enregistré. Vous pouvez changer cette liste.
  *(anciennes questions 12 et 55)*

## Urgent — bloque le développement

### Accès et comptes

1. Combien de tablettes, et faut-il pouvoir en retirer une à distance si elle est perdue ?
   *(en attendant, l'application fait : changer le code de tablette déconnecte toutes les
   tablettes.)*

2. Qui est « responsable » — c'est-à-dire qui peut clôturer un inventaire : vous seul, ou
   plusieurs personnes ?
   *(Une fois clos, un inventaire ne se modifie plus : une correction s'ajoute à côté, avec
   le nom de celui qui la fait.)*

3. Un vendeur peut-il créer seul, au comptoir, un produit avec un prix qu'il choisit ?
   *(en attendant, l'application fait : réservé au gérant.)*

4. Qui a le droit de modifier un prix dans l'application, et à quelle fréquence vos prix
   changent-ils ?

5. Quand on découvre après coup une erreur de prix sur une commande passée, peut-on la
   corriger, et qui ?
   *(en attendant, l'application fait : interdit, le prix passé ne se modifie pas.)*

6. Votre projet sur GitHub est-il privé, et qui y a eu accès jusqu'ici ?

7. Qui a accès aux comptes Supabase et Netlify, et des sauvegardes sont-elles prévues ?

### Prix sur commande

8. Les prix « à partir de » de vos deux affiches remplacent-ils ceux de l'ancienne
    application, qui étaient tous plus bas (par exemple Bavarois 4,00 → 4,50 €/pers,
    Bestella 10 parts 65/85 → 75/90 €) ?
    *(en attendant, l'application fait : l'affiche fait foi.)*

9. Un Bavarois 6 parts **commandé** coûte-t-il le prix du comptoir (31 €) ou 6 × 4,50 =
    27 € ? Un client paie donc 4 € de moins en commandant qu'en vitrine : est-ce voulu ?
    *(en attendant, l'application fait : 6 × 4,50 = 27 €, prix modifiable vers le haut par
    le pâtissier.)*

10. Massepain (6 €, puis 5 € dès 20 parts), Ferrero (5,50 €), crème au beurre (4,50 €),
    tarte et cake (2,50 €), décorations (+5 €) : absents de l'affiche, sont-ils toujours
    valables ?
    *(en attendant, l'application fait : ils ne sont pas repris.)*

11. Le supplément « moins de 6 personnes » existe-t-il encore ? Si oui, combien ?

13. Un prix à 0 € peut-il exister (geste commercial, offert) ?
    *(en attendant, l'application fait : refusé.)*

14. Qui peut autoriser un prix par personne **sous** le prix « à partir de » de l'affiche :
    vous seul, le pâtissier aussi, ou personne ?
    *(en attendant, l'application fait : refusé, sauf autorisation du gérant, avec son nom
    enregistré.)*
    **À savoir** : pour cette autorisation, l'application vérifie le code gérant, mais pas le
    nom tapé à côté. Quelqu'un qui connaît le code peut écrire n'importe quel nom. Est-ce
    suffisant ?

57. Un accord sous le prix « à partir de » donné pour **20 parts** vaut-il encore si la
    commande passe ensuite à **30 parts** ?
    *(en attendant, l'application fait : non, le code gérant est redemandé.)*

42. Une « autre demande » (une ligne libre, hors catalogue) : le vendeur peut-il en fixer
    le prix seul ?
    *(en attendant, l'application fait : il faut l'accord du gérant.)*

43. Un client peut-il convenir d'un prix total **au-dessus** du tarif ?
    *(en attendant, l'application fait : non. Pour monter le prix, on augmente le prix par
    personne. Exemple : 20 parts × 5,00 € = 100 € au lieu de 20 × 4,50 € = 90 €.)*

53. **Commande du personnel** : votre règlement prévoit 10 % de réduction sur les commandes
    pour soi (point 40). Aujourd'hui, l'application refuse tout prix sous le tarif sans le
    code gérant. Faut-il une case « commande personnel » qui applique les 10 % ?
    *(en attendant, l'application fait : il faut le code gérant.)*

### Jours de fermeture et délais

15. Le mardi est-il votre seul jour de fermeture dans la semaine ? Quels jours fériés et
    quels congés faut-il inscrire pour l'année ?
    *(en attendant, l'application fait : seul le mardi est fermé ; aucun férié ni congé
    n'est inscrit.)*

16. Peut-il vous arriver d'ouvrir un jour normalement fermé (par exemple le mardi avant
    Noël) ?
    *(en attendant, l'application fait : aucune ouverture exceptionnelle n'est prévue, le
    mardi est toujours refusé.)*

17. **Gâteau de mariage et pièce montée** : combien de jours ouvrés à l'avance ? Le
    lendemain est-il possible pour eux aussi ?
    *(en attendant, l'application fait : 5 jours ouvrés, le mardi ne compte pas. Exemple :
    commande prise un lundi → retrait possible au plus tôt le dimanche. Tout le reste —
    comptoir, plateau salé, gâteau simple — se commande au plus tard la veille.)*

40. Un produit du **comptoir commandé à l'avance** (par exemple 30 baguettes) : combien de
    jours à l'avance faut-il le commander ?
    *(en attendant, l'application fait : 1 jour ouvré.)*

41. Une date de retrait **déjà passée** doit-elle être refusée ?
    *(en attendant, l'application fait : refusée.)*

50. Les horaires de retrait **pâtisserie (9h en semaine / 12h le week-end)** valent-ils
    aussi pour la **viennoiserie** ? Et pour les plateaux salés ?
    *(en attendant, l'application fait : pâtisserie **et viennoiserie** — 20 croissants
    pour un samedi ne sortent qu'à partir de 12h. Les plateaux salés et le pain ne sont
    pas concernés. Un produit dont le rayon est inconnu, ou une « autre demande », suit
    l'horaire pâtisserie.)*

51. L'heure de fermeture est-elle **20h00 tous les jours ouverts**, week-end compris ?
    C'est elle qui décide quand l'inventaire peut commencer.
    *(en attendant, l'application fait : 20h00 tous les jours ; un inventaire commencé avant
    est signalé, pas refusé.)*

52. Un **jour férié où vous ouvrez** : la pâtisserie se retire-t-elle à la même heure
    que le dimanche ?
    *(en attendant, l'application fait : l'heure du dimanche, donc 12h par défaut. Pour un
    férié précis, vous pouvez régler une autre heure dans les réglages.)*

61. **Gâteau simple** : l'application range dans cette famille tout gâteau sur commande
    au prix par personne, sans minimum de parts et sans étages. Layer Cake, Number Cake,
    mariage et pièce montée gardent leurs propres minimums, sans tailles imposées. Est-ce
    juste ?
    *(en attendant, l'application fait : exactement cela. Un Layer Cake de 22 parts passe.)*

62. Si vous **videz la liste des tailles standard**, faut-il accepter toutes les tailles ?
    *(en attendant, l'application fait : oui, plus aucune taille n'est imposée.)*

63. Deux heures différentes saisies **pour la même date** (par erreur, 11h et 10h le même
    samedi) : laquelle compte ?
    *(en attendant, l'application fait : la plus tardive, 11h. On ne promet jamais une
    pâtisserie trop tôt.)*

54. **Inventaire avant 20h00** : votre règlement dit « jamais avant ». L'application, elle,
    prévient seulement. Faut-il le refuser, sauf code gérant ?
    *(en attendant, l'application fait : un message prévient, l'inventaire continue.)*

56. Une **heure de retrait après la fermeture** (par exemple 21h00) doit-elle être refusée ?
    *(en attendant, l'application fait : l'heure n'est pas contrôlée.)*

## Important — change le comportement de l'application

### Minimums

18. Le minimum de 10 pièces s'applique-t-il par produit, ou au total de la commande ?
    *(en attendant, l'application fait : par produit.)*

19. Mini cêpe farcie, mini bestella, mini briwate/cigare : l'affiche ne donne aucun minimum,
    l'ancienne application imposait 10. Lequel est le bon ?

20. « Mini morceau pâtisserie » correspond à quel produit de l'affiche : minimum 10 ou 15 ?

21. Number Cake : comment compte-t-on les symboles ? « 18+ », est-ce 3 symboles (45 parts) ?
    *(en attendant, l'application fait : chaque caractère visible compte. « 18+ » =
    3 symboles × 15 = 45 parts minimum.)*

22. Le grand pain surprise à 20 € comprend-il les sandwichs, ou se paient-ils en plus ?

60. Suppléments Photo / Écriture « une fois par gâteau » : qu'est-ce qui compte comme un
    gâteau ? *(en attendant, l'application fait : un gâteau sur commande = un gâteau, quel
    que soit le nombre de parts ; un plateau de minis sur commande = un gâteau ; au
    comptoir, chaque pièce du rayon pâtisserie = un gâteau. Plus de photos que de gâteaux,
    ou une photo sans gâteau : refusé.)*

59. **Grand pain surprise au-delà de 20 sandwichs** : faut-il seulement prévenir, ou
    refuser ?
    *(en attendant, l'application fait : elle prévient et propose d'ajouter un 2e pain,
    sans bloquer.)*

### Prix et dates

23. Les prix « à partir de » montent selon quoi (étages, décor, délai) ? Y a-t-il une
    grille, ou est-ce au cas par cas avec le pâtissier ?

24. Le tarif « 09/2026 » s'applique-t-il à partir du 01/09/2026 ? Et depuis quand vos deux
    affiches sont-elles en vigueur ?
    *(en attendant, l'application fait : affiches en vigueur depuis le 15/10/2026.)*

44. Une erreur dans un tarif découverte après coup : faut-il pouvoir corriger le tarif
    « depuis le début » ? Si oui, qui, et comment ?
    *(en attendant, l'application fait : un nouveau tarif ne compte qu'à partir
    d'aujourd'hui. Les commandes déjà prises gardent leur prix.)*

26. **Périodes de pointe** (fin d'année, Ramadan/Aïd, communions, fête des mères) : vos
    délais s'allongent-ils ? De combien ?

27. Les produits **« Special fin d'année »** sont disponibles de quelle date à quelle date ?

## Organisation et données

### Clients et impression

28. Combien de temps garder le nom et le téléphone d'un client : 30 jours après le retrait,
    ou plus longtemps (litige, comptabilité) ?
    *(en attendant, l'application fait : ils sont effacés 30 jours après le retrait.)*

29. Les exemplaires BUREAU, MAGASIN et ATELIER du ticket ont-ils besoin du téléphone du
    client ?

30. L'imprimante Star sera-t-elle branchée sur le réseau du magasin, et peut-on limiter
    son accès à ce seul réseau ?

47. Numéro de téléphone du client : l'application accepte sans remarque les numéros belges
    (02 123 45 67, 0470 12 34 56) et internationaux (+33…, +212…). Pour tout autre format,
    elle prévient mais laisse passer. Est-ce suffisant ?

### Suivi des commandes

58. Les **commandes prises avant la mise à jour** de l'application : leur modification
    doit-elle être réservée au gérant ?

45. Une commande « à imprimer » peut-elle passer directement à « remise au client », sans
    avoir été imprimée ?
    *(en attendant, l'application fait : non, il faut d'abord l'imprimer.)*

### Catalogue et libellés

31. **TVA** : faut-il deux taux par produit (6 % à emporter / 12 % sur place) ? À confirmer
    avec votre comptable. Faut-il l'afficher sur le bon de commande ?
    *(en attendant, l'application fait : aucun taux n'est appliqué.)*

32. **« Bastella »** (votre Excel) ou **« Bestella »** (votre affiche) : quelle orthographe
    affiche-t-on ?

33. **« Ecriture »** (votre Excel) ou **« Écriture simple »** (votre affiche) : quel nom
    affiche-t-on ?

34. Dans votre Excel, « Piccolo blanc » apparaît deux fois dans les favoris, et « CRABE |
    SURIMI » contient des caractères invisibles : peut-on nettoyer le fichier ?
    *(en attendant, l'application fait : les noms sont repris tels quels, à la lettre.)*

48. Les produits sur commande doivent-ils s'afficher dans un ordre à vous (les plus vendus
    en premier, par exemple) ?
    *(en attendant, l'application fait : même ordre que votre fichier Excel.)*

35. **Allergènes** : disposez-vous déjà des fiches par produit ? La réglementation
    européenne impose de pouvoir les communiquer, et l'application peut les porter sur les
    bons de commande.

### Inventaire

36. Vos produits ont-ils des **codes-barres** fournisseur exploitables, ou faut-il imprimer
    vos propres étiquettes ? *(Un rouleau Dymo/Brother et un code interne à 4 chiffres
    suffisent.)*

37. Combien de **zones/emplacements** dans le dépôt, et dans quel ordre physique les
    parcourt-on en comptant ?

38. Sur quels écarts d'inventaire voulez-vous un **motif obligatoire** (casse, invendu jeté,
    offert, consommation personnel) ? C'est ce qui transforme un écart en information utile.

39. **Dates limites de consommation sur le rayon frais.** Vos salades (thon, poulet,
    américain, crevettes) et vos boissons portent une date au-delà de laquelle elles ne se
    vendent plus. Aujourd'hui, personne ne sait combien de barquettes arrivent à échéance
    cette semaine — on s'en aperçoit le jour où il faut les jeter.
    **La proposition** : au moment de compter, l'employé saisit en plus la date la plus
    courte qu'il voit sur l'étagère. Deux jours avant, l'application prévient : « 8 salades
    crevettes à écouler avant jeudi » — vous avez encore le temps de les mettre en avant ou
    de les intégrer à un plateau, au lieu de les perdre.
    **La question** : est-ce que ça vaut le geste supplémentaire au comptage, et sur quels
    rayons ? *(Proposition : uniquement Frigo-S, pas sur le pain ni la viennoiserie.)*

46. **Quantités étonnantes au comptage.** L'application prévient (sans bloquer) quand un
    employé tape plus de 2000 pièces, ou plus de 4 fois ce qu'on compte d'habitude pour ce
    produit. Exemple : 400 croissants alors qu'on en compte 80 d'habitude → « Vérifiez ».
    Ces seuils vous conviennent-ils ?
