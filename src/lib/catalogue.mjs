// src/lib/catalogue.mjs
// Source de vérité du catalogue produits.
// Utilisé uniquement par prisma/seed.mjs — l'application lit la base.
//
//   categorie : zone du magasin, donne l'ordre d'affichage et le découpage
//   poste     : qui fabrique l'article — patissier | boulanger | traiteur
//
// L'ordre des groupes ci-dessous est l'ordre d'affichage :
//   Pains → Salé → Makla → Viennoiserie → Pâtisserie

/** @typedef {{ nom: string, categorie: string, poste: 'patissier'|'boulanger'|'traiteur' }} ArticleCatalogue */

/** Groupe homogène : même catégorie, même poste. */
const g = (categorie, poste, noms) => noms.map((nom) => ({ nom, categorie, poste }));

/** @type {ArticleCatalogue[]} */
export const CATALOGUE = [
  // ============================== 1. PAINS ==============================
  ...g('Pains', 'boulanger', [
    'Pain marocain blanc',
    'Pain marocain gris',
    'Pain français',
    'Baguette blanche',
    'Baguette grise',
    'Baguette aux graines de sésame',
    'Baguette grise aux céréales',
    'Demi baguette grise aux céréales',
    'Pistolet blanc',
    'Pistolet gris',
    'Piccolo blanc',
    'Piccolo gris',
    'Grand pain blanc',
    'Petit pain blanc',
    'Grand pain gris',
    'Petit pain gris',
    'Grand pain demi gris',
    'Petit pain demi gris',
    'Grand pain aux 7 céréales',
    'Petit pain aux 7 céréales',
    'Grand pain au levain',
    'Petit pain au levain',
    'Grand pain seigle',
    'Petit pain seigle',
    'Grand campagne blanc',
    'Petit campagne blanc',
    'Grand campagne gris',
    'Petit campagne gris',
    'Grand campagne demi gris',
    'Petit campagne demi gris',
    'Grand campagne aux 7 céréales',
    'Petit campagne aux 7 céréales',
    'Pain artisanal blanc',
    'Pain artisanal gris',
    'Pain aux olives',
    'Ciabatta nature',
    'Ciabatta aux olives',
    'Pain italien (long, sésames)',
    'Pain espagnol',
    'Pain shawarma blanc',
    'Pain shawarma gris',
    'Bagnat blanc',
    'Bagnat gris',
    // Briochés : rangés côté pain, et c'est bien le boulanger qui les fait.
    'Craquelin',
    'Cramique',
    'Brioche',
    'Brioche sucrée sésames',
    'Brioche sucrée crème',
    'Cougnou sucre',
    'Cougnou chocolat',
    'Cougnou raisin',
  ]),

  // ============================== 2. SALÉ ===============================
  ...g('Salé', 'traiteur', [
    'Msemen fromage',
    'Msemen fromage épinards',
    'Msemen kefta',
    'Msemen poulet',
    'Msemen épinards poulet',
    'Bestella poulet',
    'Briwate poulet',
    'Bestella poisson',
    'Cigare poisson',
    'Cigare fromage',
    'Romain fromage',
    'Quiche',
    'Morceau quiche',
    'Pizza',
    'Morceau pizza',
    'Lasagne bolognaise',
    'Lasagne saumon',
    'Salade poulet',
    'Salade saumon',
    'Salade thon',
    'Tacos poulet',
    'Wrap tenders',
    'Wrap marocain',
    'Battout healthy',
    'Mou healthy',
  ]),

  // ============================= 3. MAKLA ===============================
  ...g('Makla', 'patissier', [
    'Msemen blanc',
    'Msemen gris',
    'Meloui',
    'Grand Makla blanc',
    'Grand Makla gris',
    'Petit Makla blanc',
    'Petit Makla gris',
    'Battout blanc',
    'Battout gris',
    'Harcha smida',
    'Harcha grise',
    'Harcha céréales',
    'Harcha lait',
    'Baghrir',
    'Sandwich mou',
    'Beignet sucré',
    'Beignet nature',
  ]),

  // ========================== 4. VIENNOISERIE ===========================
  ...g('Viennoiserie', 'patissier', [
    'Croissant',
    'Couque au chocolat',
    'Couque au beurre',
    'Couque aux raisins',
    'Croissant au chocolat',
    'Croissant aux amandes',
    'Torsade',
    'Couque suisse longue',
    'Couque suisse ronde',
    'Huit',
    'Noix de pécan',
    'Maton fromage',
    'Coque croquant amandes cerise',
    'Coque croquant noisettes chocolat',
    'Gosette pommes',
    'Gosette cerises',
    'Gosette abricot',
    'Feuilleté pommes',
    'Feuilleté poire',
    'Feuilleté abricot',
  ]),

  // =========================== 5. PÂTISSERIE ============================
  ...g('Pâtisserie', 'patissier', [
    'Mille feuille classique',
    'Mille feuille chocolat',
    'Mille feuille amande',
    'Éclair chocolat',
    'Éclair moka',
    'Éclair pistache',
    'Éclair framboise',
    'Éclair framboise fraise',
    'Couque à la crème',
    'Croissant à la crème',
  ]),
];
