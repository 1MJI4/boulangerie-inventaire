// src/catalogue/raccourcisGateaux.ts
//
// Gâteaux du comptoir en ACCÈS DIRECT sur l'écran de commande (décision du
// propriétaire du 19/11/2026, après un essai en magasin) : « Matadi, Fraisier,
// Bavarois fruits de la passion, Croûte fraises… accessibles rapidement », sans
// passer par « Bavarois » puis le goût.
// Propriétaire de la donnée : `catalogue-prix`.
//
// Ce sont des RACCOURCIS, pas des produits : aucun identifiant nouveau, aucun
// prix ici (LOI 1). DONNÉE EXPLICITE, jamais déduite du nom (LOI 6) :
//   - `surCommande` : la tuile ouvre ce gâteau sur commande avec ce goût déjà
//     choisi. Le prix suit R60 (correspondancesComptoir.ts) : gâteau du comptoir
//     jusqu'à 8 parts, prix par personne au-dessus ;
//   - `comptoir` : le gâteau n'a pas de prix par personne (croûtes). La tuile
//     regroupe ses tailles du comptoir, rien au-dessus.
// Libellés : ceux du tarif, à la lettre (LOI 5) — « Croûte » + « framboises ».
//
// EN ATTENTE (QUESTIONS-GERANT) : prix de la Croûte en 10 parts.
// Contrôlée par src/components/commande/raccourcisGateaux.test.ts sur le vrai
// catalogue.

export type RaccourciGateau =
  | { cle: string; libelle: string; type: 'surCommande'; surCommande: string; gout: string }
  | { cle: string; libelle: string; type: 'comptoir'; tailles: readonly { parts: number; comptoir: string }[] };

const BAVAROIS = 'gateaux-sur-commande/bavarois';

export const RACCOURCIS_GATEAUX: readonly RaccourciGateau[] = [
  { cle: 'fraisier', libelle: 'Fraisier', type: 'surCommande', surCommande: BAVAROIS, gout: 'Fraisier' },
  { cle: 'matadi-chocolat', libelle: 'Matadi chocolat', type: 'surCommande', surCommande: BAVAROIS, gout: 'Matadi chocolat' },
  { cle: 'mousse-chocolat', libelle: 'Mousse chocolat', type: 'surCommande', surCommande: BAVAROIS, gout: 'Mousse chocolat' },
  { cle: 'foret-noire', libelle: 'Forêt noire', type: 'surCommande', surCommande: BAVAROIS, gout: 'Forêt noire' },
  { cle: 'bavarois-framboise', libelle: 'Bavarois framboise', type: 'surCommande', surCommande: BAVAROIS, gout: 'Framboise' },
  {
    cle: 'bavarois-fruits-de-la-passion',
    libelle: 'Bavarois fruits de la passion',
    type: 'surCommande',
    surCommande: BAVAROIS,
    gout: 'Fruits de la passion',
  },
  { cle: 'bavarois-mangue', libelle: 'Bavarois mangue', type: 'surCommande', surCommande: BAVAROIS, gout: 'Mangue' },
  {
    cle: 'croute-fraises',
    libelle: 'Croûte Fraises',
    type: 'comptoir',
    tailles: [
      { parts: 6, comptoir: 'gateaux-et-tartes/croute/fraises-6p' },
      { parts: 8, comptoir: 'gateaux-et-tartes/croute/fraises-8p' },
    ],
  },
  {
    cle: 'croute-framboises',
    libelle: 'Croûte framboises',
    type: 'comptoir',
    tailles: [
      { parts: 6, comptoir: 'gateaux-et-tartes/croute/framboises-6p' },
      { parts: 8, comptoir: 'gateaux-et-tartes/croute/framboises-8p' },
    ],
  },
  {
    cle: 'croute-fruits',
    libelle: 'Croûte Fruits',
    type: 'comptoir',
    tailles: [
      { parts: 6, comptoir: 'gateaux-et-tartes/croute/fruits-6p' },
      { parts: 8, comptoir: 'gateaux-et-tartes/croute/fruits-8p' },
    ],
  },
];
