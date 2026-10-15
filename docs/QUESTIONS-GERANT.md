# Questions pour le gérant

> Chaque question ci-dessous correspond à une règle que l'application applique **par
> hypothèse** en attendant votre réponse. Une réponse d'une phrase suffit.
> Dès qu'une réponse arrive : la reporter dans `CLAUDE.md` et `docs/REGLES-METIER.md`,
> jamais directement dans le code.

## Déjà tranché — 15/10/2026

- ✅ **Minimum de parts non atteint → refusé.** Pas de supplément. L'application oblige à
  atteindre le minimum, en proposant la correction en un geste.
  *→ Pensez à corriger l'affiche « Gâteaux SIMPLES », qui promet encore un supplément.*
- ✅ Capacité de production journalière : **hors périmètre** pour l'instant.
- ✅ Heure limite de commande dans la journée : **hors périmètre**.
- ✅ Arrondi espèces : **reporté** (l'application n'encaisse pas).
- ✅ Prix de revient / valorisation du stock : **hors périmètre**. Le tarif est dans
  l'application pour fiabiliser la prise de commande, pas pour la comptabilité.

## Urgent — bloque le développement

**1. Le mardi est-il bien votre jour de fermeture ?**
Y a-t-il d'autres jours fermés dans la semaine, et prenez-vous des congés annuels à dates
fixes ?

**2. Délais minimum de commande, en jours ouvrés :**
gâteau de mariage / pièce montée ? · gâteau simple ? · plateau salé ?
*En attendant : 5 jours / 48 h / 24 h.*

## Important — change le comportement de l'application

3. Le **minimum de 10 pièces** s'applique-t-il par produit, ou au total de la commande ?
   *(hypothèse : par produit)*

4. Qui a le droit de **descendre un prix par personne sous le plancher** « à partir de » —
   vous seul, le pâtissier aussi, ou personne ?

5. Les prix « à partir de » montent selon quoi (étages, décor, délai) ? Y a-t-il une grille,
   ou est-ce au cas par cas avec le pâtissier ?

6. **Acompte** : exigé à partir de quel montant, et combien ? Différent pour un mariage ?

7. **Périodes de pointe** (fin d'année, Ramadan/Aïd, communions, fête des mères) : vos délais
   s'allongent-ils ? De combien ?

8. Les produits **« Special fin d'année »** sont disponibles de quelle date à quelle date ?

## Organisation et données

9. **TVA** : 6 % à emporter / 12 % sur place — à confirmer avec votre comptable. Faut-il
   l'afficher sur le bon de commande ?

10. Vos produits ont-ils des **codes-barres** fournisseur exploitables, ou faut-il imprimer
    vos propres étiquettes ? *(Un rouleau Dymo/Brother et un code interne à 4 chiffres suffisent.)*

11. Combien de **zones/emplacements** dans le dépôt, et dans quel ordre physique les
    parcourt-on en comptant ?

12. Sur quels écarts d'inventaire voulez-vous un **motif obligatoire** (casse, invendu jeté,
    offert, consommation personnel) ? C'est ce qui transforme un écart en information utile.

13. **Dates limites de consommation sur le rayon frais.** Vos salades (thon, poulet,
    américain, crevettes) et vos boissons portent une date au-delà de laquelle elles ne se
    vendent plus. Aujourd'hui, personne ne sait combien de barquettes arrivent à échéance
    cette semaine — on s'en aperçoit le jour où il faut les jeter.
    **La proposition** : au moment de compter, l'employé saisit en plus la date la plus
    courte qu'il voit sur l'étagère. Deux jours avant, l'application prévient : « 8 salades
    crevettes à écouler avant jeudi » — vous avez encore le temps de les mettre en avant ou
    de les intégrer à un plateau, au lieu de les perdre.
    **La question** : est-ce que ça vaut le geste supplémentaire au comptage, et sur quels
    rayons ? *(Proposition : uniquement Frigo-S, pas sur le pain ni la viennoiserie.)*

14. **« Bastella »** (votre Excel) ou **« Bestella »** (votre affiche) : quelle orthographe
    affiche-t-on aux clients ?

15. À quelle **fréquence les prix changent-ils**, et qui a le droit de les modifier dans
    l'application ?

16. **Allergènes** : disposez-vous déjà des fiches par produit ? La réglementation européenne
    impose de pouvoir les communiquer, et l'application peut les porter sur les bons de
    commande.

17. Qui peut **clôturer un inventaire** ? Une fois clos, il devient non modifiable (les
    corrections passent par une écriture corrective tracée).
