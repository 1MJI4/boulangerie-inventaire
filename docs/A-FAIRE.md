# À faire — lots suivants

> Demandes du propriétaire en attente d'un lot. Le coordinateur les reprend en tête du lot suivant.

## Lot 3 — en tête

### 1. Écran « Commandes du jour » (demande du 15/10/2026)

- Liste des commandes à retirer aujourd'hui, **triée par heure de retrait prévue**, pour que le
  vendeur prépare à l'avance.
- **En rouge** : les commandes qui contiennent des petites pâtisseries, des viennoiseries ou du
  salé (ce que le vendeur doit préparer lui-même). Les familles mises en rouge = **donnée**
  (réglage), pas une liste en dur.
  **Précisé par le propriétaire (15/10/2026)** : « petites pâtisseries » = les pâtisseries
  **individuelles de la vitrine** (rayon Individuelle, minis), **pas les grands gâteaux** faits
  par le pâtissier (régime C, gâteaux entiers).
- **Case à cocher « prête »** par commande (tracée : qui, quand).
- **Alerte 30 minutes avant** l'heure de retrait si la commande n'est pas cochée prête :
  alerte visuelle forte + son. Le délai (30 min) = réglage.
- Contraintes : fonctionne sur la tablette du magasin, page ouverte ; ne ralentit pas les
  autres écrans ; une commande sans heure de retrait apparaît en tête « heure non précisée ».
- Limites à signaler au gérant : un navigateur ne joue un son qu'après un premier geste sur la
  page, et rien ne sonne si la tablette est verrouillée ou l'onglet fermé.
- Agents : `base-donnees` (statut prête + réglages), `regles-metier` (calcul des alertes),
  `design-ux` (alerte, rouge), `commandes-traiteur` (écran), `qa-metier`.

### 2. Règles proposées par le coordinateur (accord du propriétaire à confirmer)

- Case « commande personnel » : −10 % tracé, pas pour les proches (règlement 40-41).
- Heure de retrait après la fermeture refusée (fermeture = réglage).
