// src/lib/gateaux.ts
//
// Un gâteau sur mesure ne se cherche pas dans une liste : il se compose. Le
// vendeur choisit une famille de prix, un ou deux parfums, une décoration et un
// nombre de parts — l'application calcule. C'est le seul moyen d'arrêter les
// erreurs de prix sur les formats qui ne sont pas au comptoir.
//
// Deux régimes cohabitent, et c'est le format qui décide lequel s'applique :
//   • un format vendu au comptoir (4P, 6P, 8P, 10P) a un prix fixe, et le prix
//     par personne y baisse volontairement quand le gâteau grandit ;
//   • tout autre format se calcule au prix par personne de la famille.
//
// Familles, parfums et décorations viennent de la base : le manager les
// modifie depuis l'écran de réglages, sans attendre une mise à jour.

/**
 * Un tarif par personne qui s'applique à partir d'un certain nombre de parts.
 * Le prix à la part baisse quand le gâteau grandit : un massepain pour douze
 * ne coûte pas le même prix à la part qu'un massepain pour quarante.
 */
export type PalierGateau = {
  aPartirDe: number;
  centimes: number;
};

export type GenreFamille = 'gateau' | 'sale';
/** Une bestella se compte en personnes, un mini briwate en pièces. */
export type UniteFamille = 'personne' | 'piece';

export type FamilleGateau = {
  id: number;
  cle: string;
  genre: GenreFamille;
  unite: UniteFamille;
  libelle: string;
  /** Tarif de base, utilisé quand la famille n'a pas de paliers. */
  parPersonneCentimes: number;
  paliers: PalierGateau[] | null;
  minimumParts: number | null;
  /** Parts vendues au comptoir à prix fixe : parts → prix total. */
  formatsFixes: Record<number, number> | null;
  note: string | null;
  /** Renseigné seulement quand l'écran de réglages demande les inactifs. */
  actif?: boolean;
};

/** Le palier qui s'applique : le dernier dont le seuil est atteint. */
export function palierApplicable(famille: FamilleGateau, parts: number): PalierGateau {
  const paliers = (famille.paliers ?? []).slice().sort((a, b) => a.aPartirDe - b.aPartirDe);
  const retenu = paliers.filter((p) => parts >= p.aPartirDe).pop();
  return retenu ?? { aPartirDe: 1, centimes: famille.parPersonneCentimes };
}

export type OptionGateau = {
  id: number;
  nom: string;
  supplementCentimes: number;
  actif?: boolean;
};

/**
 * Un gâteau de 13 parts se coupe mal : les parts sont inégales et le pâtissier
 * y perd du temps pour un résultat moins net. Le magasin décide s'il refuse
 * ces tailles ou s'il se contente de proposer mieux.
 */
export type ReglageCoupes = {
  /** libre : rien n'est dit · avertir : on propose mieux · interdire : on refuse. */
  mode: 'libre' | 'avertir' | 'interdire';
  /** Les tailles qui se coupent proprement, proposées d'un tap au vendeur. */
  conseillees: number[];
  /** Les nombres pairs se coupent toujours en deux : ils passent. */
  tolererPairs: boolean;
  /** Impairs acceptés malgré tout — la part seule, et le 5. */
  exceptions: number[];
};

export const COUPES_PAR_DEFAUT: ReglageCoupes = {
  mode: 'avertir',
  conseillees: [4, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50],
  tolererPairs: true,
  exceptions: [1, 5],
};

export function coupeAcceptable(coupes: ReglageCoupes, parts: number): boolean {
  if (coupes.mode === 'libre') return true;
  if (coupes.exceptions.includes(parts)) return true;
  if (coupes.conseillees.includes(parts)) return true;
  if (coupes.tolererPairs && parts % 2 === 0) return true;
  // Les multiples de cinq se partagent aussi bien qu'un nombre pair.
  return parts % 5 === 0;
}

/** Les deux tailles acceptables les plus proches, de part et d'autre. */
export function coupesProches(coupes: ReglageCoupes, parts: number): number[] {
  const candidates: number[] = [];
  for (let ecart = 1; ecart <= 6 && candidates.length < 2; ecart += 1) {
    for (const essai of [parts - ecart, parts + ecart]) {
      if (essai >= 1 && coupeAcceptable(coupes, essai) && !candidates.includes(essai)) {
        candidates.push(essai);
      }
    }
  }
  return candidates.sort((a, b) => a - b).slice(0, 2);
}

export type CompositionGateau = {
  coupes: ReglageCoupes;
  familles: FamilleGateau[];
  parfums: OptionGateau[];
  garnitures: OptionGateau[];
  decorations: OptionGateau[];
};

/** Sous ce nombre de personnes, le magasin applique un supplément. */
export const PARTS_SANS_SUPPLEMENT = 6;

/** Un gâteau se fait à la pièce, ou à partir de ce nombre de parts. */
export const PARTS_MINIMUM = 4;

export type CalculGateau = {
  /** Prix total de la ligne. */
  centimes: number;
  /**
   * Prix d'une pièce. Ce qui se compte à la pièce doit entrer dans la commande
   * comme « 20 × 1,50 € » et non comme « 1 × 30,00 € » : sinon la quantité
   * réelle n'existe nulle part, et corriger la quantité sur la ligne
   * multiplierait un total au lieu d'un prix unitaire.
   */
  unitaireCentimes: number;
  /** « format » = prix du comptoir, « personne » = calcul au tarif par personne. */
  regime: 'format' | 'personne';
  explication: string;
  /**
   * Vrai pour un calcul par personne : les tarifs de l'affiche sont des prix
   * « à partir de », qui montent avec les parfums et les décors particuliers.
   * Le vendeur doit le voir, sinon il annonce un prix qu'il devra reprendre.
   */
  aPartirDe: boolean;
  /** Messages à montrer avant même de valider. */
  alertes: string[];
};

export function calculerPrixGateau(famille: FamilleGateau, parts: number): CalculGateau {
  const alertes: string[] = [];

  const unite = famille.unite === 'piece' ? 'pièces' : 'parts';

  if (famille.minimumParts && parts < famille.minimumParts) {
    alertes.push(`${famille.libelle} : minimum ${famille.minimumParts} ${unite}.`);
  }

  // Les règles de découpe d'un gâteau ne valent pas pour un plateau de minis.
  if (famille.genre === 'gateau' && famille.unite === 'personne') {
    if (parts > 1 && parts < PARTS_MINIMUM) {
      alertes.push('Un gâteau se fait à la pièce ou à partir de 4 parts.');
    }
    if (parts >= PARTS_MINIMUM && parts < PARTS_SANS_SUPPLEMENT) {
      alertes.push(`Moins de ${PARTS_SANS_SUPPLEMENT} personnes : supplément à ajouter.`);
    }
  }
  if (famille.note) alertes.push(famille.note);

  const fixe = famille.formatsFixes?.[parts];
  if (fixe !== undefined) {
    return {
      centimes: fixe,
      unitaireCentimes: Math.round(fixe / Math.max(1, parts)),
      regime: 'format',
      explication: 'Format du comptoir — prix fixe',
      aPartirDe: false,
      alertes,
    };
  }

  const palier = palierApplicable(famille, parts);
  const paliers = famille.paliers ?? [];
  if (paliers.length > 1 && palier.aPartirDe > 1) {
    alertes.push(`Tarif à partir de ${palier.aPartirDe} ${unite}.`);
  }

  return {
    centimes: parts * palier.centimes,
    unitaireCentimes: palier.centimes,
    regime: 'personne',
    explication: `${parts} × ${formaterCentimes(palier.centimes)} ${
      famille.unite === 'piece' ? 'la pièce' : 'par personne'
    }`,
    aPartirDe: true,
    alertes,
  };
}

/**
 * Deux parfums arrivent régulièrement : une couche chocolat, une couche
 * framboise. Au-delà de deux, le libellé devient illisible sur un A6.
 */
export const PARFUMS_MAXIMUM = 2;

export function libelleGateau(
  famille: FamilleGateau,
  parfums: string[],
  parts: number
): string {
  const propres = parfums.map((p) => p.trim()).filter(Boolean);
  // « Bestella poulet » avec la garniture « Poulet » ne doit pas devenir
  // « Bestella poulet poulet ».
  const nouveaux = propres.filter(
    (p) => !famille.libelle.toLowerCase().includes(p.toLowerCase())
  );
  const suffixe = nouveaux.length > 0 ? ` ${nouveaux.join(' / ').toLowerCase()}` : '';

  // Ce qui se compte à la pièce garde son nom de produit : « Mini tartelette
  // framboise ». La quantité vit dans la ligne, pas dans le libellé.
  if (famille.unite === 'piece') {
    return `${famille.libelle}${suffixe}`;
  }

  // Un plateau salé garde aussi son nom : « Bestella fruits de mer 20P ».
  if (famille.genre === 'sale') {
    return `${famille.libelle}${suffixe} ${parts}P`;
  }

  // Pour un gâteau, le parfum devient le nom : « Framboise 16P ».
  const nom = propres.length > 0 ? propres.join(' / ') : famille.libelle;
  return `${nom} ${parts}P`;
}

function formaterCentimes(centimes: number): string {
  return `${(centimes / 100).toFixed(2).replace('.', ',')} €`;
}
