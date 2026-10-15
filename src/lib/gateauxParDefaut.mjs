// src/lib/gateauxParDefaut.mjs
// Valeurs de départ de la composition des gâteaux sur mesure.
// Utilisé uniquement par prisma/seed-gateaux.mjs : une fois en base, c'est le
// manager qui décide, depuis l'écran de réglages.
//
// Les tarifs par personne viennent de l'affiche du magasin. Ce sont des prix
// « à partir de » : ils montent avec les parfums et les décors particuliers.
//
// Les formats fixes sont les gâteaux du comptoir : sur ces tailles, le prix par
// personne baisse volontairement, et c'est le prix du format qui s'applique.
//
// Les paliers font baisser le prix à la part quand le gâteau grandit — un
// massepain pour douze ne coûte pas le même prix à la part qu'un pour quarante.

export const FAMILLES = [
  // ------------------------------------------------------------- Gâteaux
  { cle: 'bavarois', libelle: 'Bavarois', parPersonneCentimes: 400, formatsFixes: { 4: 2000, 6: 3100, 8: 3600, 10: 3900 } },
  { cle: 'classique', libelle: 'Gâteau classique', parPersonneCentimes: 400, formatsFixes: { 4: 2000, 6: 3100, 8: 3600 }, note: 'Forêt noire, fraisier, matadi, mousse chocolat.' },
  { cle: 'creme-fraiche', libelle: 'Crème fraîche', parPersonneCentimes: 350, formatsFixes: { 6: 2600, 8: 3100 } },
  { cle: 'creme-beurre', libelle: 'Crème au beurre', parPersonneCentimes: 450 },
  { cle: 'ferrero', libelle: 'Ferrero / Raffaello', parPersonneCentimes: 550 },
  { cle: 'massepain', libelle: 'Massepain / pâte à sucre', parPersonneCentimes: 600, paliers: [{ aPartirDe: 1, centimes: 600 }, { aPartirDe: 20, centimes: 500 }] },
  { cle: 'tarte', libelle: 'Tarte', parPersonneCentimes: 250, formatsFixes: { 6: 1800 } },
  { cle: 'cake', libelle: 'Cake', parPersonneCentimes: 250 },
  { cle: 'number-cake', libelle: 'Number cake', parPersonneCentimes: 450, minimumParts: 10 },
  { cle: 'layer-cake', libelle: 'Layer cake', parPersonneCentimes: 450, minimumParts: 20 },
  { cle: 'mariage', libelle: 'Gâteau de mariage', parPersonneCentimes: 450 },
  { cle: 'piece-montee', libelle: 'Pièce montée', parPersonneCentimes: 450, minimumParts: 40, note: 'Tarif par personne à confirmer.' },

  // Les minis sucrés se comptent à la pièce mais restent du côté gâteau : ce
  // sont les parfums qui les qualifient, pas les garnitures.
  { cle: 'mini-tartelette', unite: 'piece', libelle: 'Mini tartelette', parPersonneCentimes: 150, minimumParts: 10 },
  { cle: 'mini-patisserie', unite: 'piece', libelle: 'Mini morceau pâtisserie', parPersonneCentimes: 150, minimumParts: 10 },
  { cle: 'mini-millefeuille', unite: 'piece', libelle: 'Mini mille-feuille / éclair', parPersonneCentimes: 80, minimumParts: 10 },

  // ---------------------------------------------------- Salé et réception
  // Repris de l'affiche « Sur commande ». Les bestella se commandent au
  // plateau de dix personnes ; tout le reste se compte à la pièce, par
  // quinze minimum.
  { cle: 'bestella-poulet', genre: 'sale', unite: 'personne', libelle: 'Bestella poulet', parPersonneCentimes: 650, formatsFixes: { 10: 6500 }, note: 'Plateau de 10 personnes : 65 €.' },
  { cle: 'bestella-mer', genre: 'sale', unite: 'personne', libelle: 'Bestella fruits de mer', parPersonneCentimes: 850, formatsFixes: { 10: 8500 }, note: 'Plateau de 10 personnes : 85 €.' },
  { cle: 'mini-bestella', genre: 'sale', unite: 'piece', libelle: 'Mini bestella', parPersonneCentimes: 200, minimumParts: 10 },
  { cle: 'mini-briwate', genre: 'sale', unite: 'piece', libelle: 'Mini briwate', parPersonneCentimes: 150, minimumParts: 10 },
  { cle: 'mini-cigare', genre: 'sale', unite: 'piece', libelle: 'Mini cigare', parPersonneCentimes: 150, minimumParts: 10 },
  { cle: 'mini-quiche-mer', genre: 'sale', unite: 'piece', libelle: 'Mini quiche fruits de mer / saumon', parPersonneCentimes: 150, minimumParts: 10 },
  { cle: 'mini-quiche-legumes', genre: 'sale', unite: 'piece', libelle: 'Mini quiche légumes / poulet', parPersonneCentimes: 150, minimumParts: 10 },
  { cle: 'mini-pizza', genre: 'sale', unite: 'piece', libelle: 'Mini pizza', parPersonneCentimes: 150, minimumParts: 10 },
];

/** Les garnitures jouent pour le salé le rôle que les parfums jouent pour le sucré. */
export const GARNITURES = [
  'Poulet', 'Fruits de mer', 'Saumon', 'Thon', 'Viande hachée', 'Kefta',
  'Légumes', 'Fromage', 'Épinards fromage', 'Poulet épinards', 'Crevettes',
];

/** Proposés pour toutes les familles : un bavarois moka existe, un cake framboise aussi. */
export const PARFUMS = [
  'Chocolat', 'Vanille', 'Fraise', 'Framboise', 'Fruits rouges', 'Mangue', 'Citron',
  'Fruits de la passion', 'Oreo', 'Speculoos', 'Moka', 'Javanais', 'Praliné',
  'Pistache', 'Caramel', 'Nutella', 'Ferrero Rocher', 'Raffaello', 'Forêt noire',
  'Fraisier', 'Matadi chocolat', 'Mousse chocolat', 'Pommes', 'Fromage', 'Riz',
  'Cerises', 'Abricots', 'Frangipane poires cerises',
];

/** Le style extérieur. Certaines décorations sont comprises, d'autres non. */
export const DECORATIONS = [
  { nom: 'Sans décoration', supplementCentimes: 0 },
  { nom: 'Fruits frais', supplementCentimes: 0 },
  { nom: 'Fruits rouges', supplementCentimes: 0 },
  { nom: 'Chantilly', supplementCentimes: 0 },
  { nom: 'Copeaux de chocolat', supplementCentimes: 0 },
  { nom: 'M&M’s', supplementCentimes: 500 },
  { nom: 'Kinder Bueno', supplementCentimes: 500 },
  { nom: 'Ferrero Rocher', supplementCentimes: 500 },
  { nom: 'Oreo', supplementCentimes: 500 },
  { nom: 'Macarons', supplementCentimes: 500 },
];
