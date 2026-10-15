// src/lib/auth/matrice.ts
//
// Qui a le droit d'appeler quoi. Une seule table, déclarée ici ; chaque route
// API appelle `exigerRole` avec le rôle de cette table, et le test
// `matrice.test.ts` vérifie mécaniquement que le code des routes y correspond.
// Propriétaire : agent `securite`.

import type { Role } from './roles.ts';

export type Methode = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type EntreeMatrice = {
  /** Rôle minimal exigé, ou `cle` pour une route authentifiée autrement (imprimante). */
  role: Role | 'cle';
  /** Ce que fait l'appel, pour le message « Seul le gérant peut … ». */
  action: string;
};

export const MATRICE_ACCES: Record<string, Partial<Record<Methode, EntreeMatrice>>> = {
  'src/app/api/commandes/route.ts': {
    GET: { role: 'tablette', action: 'consulter les commandes' },
    POST: { role: 'tablette', action: 'prendre une commande' },
    PATCH: { role: 'tablette', action: 'modifier une commande' },
    // Archivage J+2 / anonymisation : déclenché à l'ouverture de l'écran des
    // commandes, idempotent. Une tablette installée suffit.
    PUT: { role: 'tablette', action: 'ranger les commandes passées' },
  },
  'src/app/api/inventaires/route.ts': {
    GET: { role: 'tablette', action: 'consulter un inventaire' },
    POST: { role: 'tablette', action: 'saisir un inventaire' },
  },
  'src/app/api/releves/route.ts': {
    GET: { role: 'tablette', action: 'consulter les relevés' },
  },
  'src/app/api/produits/route.ts': {
    GET: { role: 'tablette', action: 'consulter le catalogue' },
    POST: { role: 'gerant', action: 'ajouter un produit' },
    PUT: { role: 'gerant', action: 'modifier un produit' },
    DELETE: { role: 'gerant', action: 'retirer un produit' },
  },
  'src/app/api/produits/reorganiser/route.ts': {
    PUT: { role: 'gerant', action: 'réordonner le catalogue' },
  },
  'src/app/api/tarifs/route.ts': {
    GET: { role: 'tablette', action: 'consulter les tarifs' },
    // HYPOTHÈSE À VALIDER : la création d'un tarif au comptoir (prix libre) est
    // réservée au gérant tant qu'il n'a pas dit qu'un vendeur peut le faire seul.
    // Effet à l'écran (FormulaireCommande, « retenir ce produit ») : hors accès
    // gérant, la ligne est bien ajoutée à la commande, mais le prix n'est pas
    // mémorisé dans la grille.
    POST: { role: 'gerant', action: 'créer un tarif' },
    PATCH: { role: 'gerant', action: 'modifier un tarif' },
  },
  'src/app/api/gateaux/route.ts': {
    GET: { role: 'tablette', action: 'consulter les gâteaux' },
    POST: { role: 'gerant', action: 'ajouter une option de gâteau' },
    PATCH: { role: 'gerant', action: 'modifier les gâteaux' },
  },
  // Élévation : POST vérifie le CODE GÉRANT (limite de tentatives) et pose le
  // cookie gérant ; il ne peut donc pas lui-même exiger le rôle gérant.
  // DELETE referme l'accès gérant de la tablette.
  'src/app/api/gestion/route.ts': {
    POST: { role: 'tablette', action: 'ouvrir le profil manager' },
    DELETE: { role: 'tablette', action: 'fermer le profil manager' },
  },
  'src/app/api/impression/route.ts': {
    GET: { role: 'tablette', action: "suivre l'impression" },
    POST: { role: 'tablette', action: 'imprimer une commande' },
  },
  'src/app/api/cloudprnt/[cle]/route.ts': {
    GET: { role: 'cle', action: 'imprimante' },
    POST: { role: 'cle', action: 'imprimante' },
    DELETE: { role: 'cle', action: 'imprimante' },
  },
};
