// src/components/inventaire/dispositionGrille.ts
//
// « Il ne faut PAS scroller. Il faut voir TOUS les produits de la page. »
// (retour du propriétaire, tablette 1180×820)
//
// Calcul PUR de la grille du comptage en plein écran : combien de colonnes et
// quelle hauteur de ligne pour que tous les produits de la page tiennent dans
// la zone disponible (largeur × hauteur mesurées à l'écran, pavé déjà retiré).
//
//   - lignes de 48 à 80 px : la place disponible sert la lisibilité (texte et
//     case de quantité plus grands quand la ligne est haute) ;
//   - une colonne ne descend pas sous LARGEUR_MIN_COLONNE ;
//   - le nom est TOUJOURS entier (LOI 5 : jamais d'ellipse, jamais coupé). La
//     place du nom = largeur de colonne MOINS la largeur réelle de ce qui
//     l'entoure (`largeurHorsNom` : bouton « 0 », champ — plus large pour un
//     produit au kilo —, icône de niveau, marges) ;
//   - ordre de préférence :
//       1. nom à la police normale sur deux lignes au plus (le plus lisible) ;
//       2. sinon police du nom réduite, jusqu'à POLICE_NOM_MIN (13 px), pour
//          qu'il tienne dans la hauteur de la ligne ;
//       3. sinon, en dernier recours, sous-pages équilibrées (« Page 1 · 1/2 ») :
//          moins de rangées → lignes plus hautes → plus de lignes de texte ;
//     jamais de défilement, jamais de débordement sur la ligne voisine ;
//   - à niveau égal : la ligne la PLUS HAUTE ; puis le moins de colonnes.
//
// Aucune dépendance (ni React, ni DOM) : testé par `dispositionGrille.test.ts`.
// Propriétaire : `inventaire-scan`. Ce sont des pixels, pas des montants.

/** Cible tactile minimale : toute la ligne se touche. */
export const HAUTEUR_LIGNE_MIN = 48;
/** Au-delà, la ligne ne gagne plus en lisibilité (texte 18 px, cibles de 56 px dès 64 px). */
export const HAUTEUR_LIGNE_MAX = 80;
/** Dès cette hauteur, la ligne passe en « grande » (cibles de 56 px, nom en 18 px). */
export const HAUTEUR_LIGNE_GRANDE = 64;
/** Plancher de colonne : nom court + bouton « 0 » + champ, marges comprises. */
export const LARGEUR_MIN_COLONNE = 240;
/** Écart horizontal entre deux colonnes (classe `gap-x-2`). */
export const ECART_COLONNES = 8;
/** Largeur moyenne d'un caractère, en fraction de la taille de police (10 px à 18 px : prudent). */
export const RAPPORT_CARACTERE = 10 / 18;
/** Interligne du nom (classe `leading-tight`). */
export const INTERLIGNE_NOM = 1.25;
/** Police la plus petite admise pour le nom en grille plein écran. */
export const POLICE_NOM_MIN = 13;

export type UniteGrille = 'piece' | 'kg';

/** Ce que la grille doit savoir d'un produit pour réserver la place de son nom. */
export type ProduitGrille = { nom: string; unite?: UniteGrille };

/** Police normale du nom selon la hauteur de ligne (`text-lg` / `text-[15px]` de LigneSaisie). */
export function policeNomNormale(hauteurLigne: number): number {
  return hauteurLigne >= HAUTEUR_LIGNE_GRANDE ? 18 : 15;
}

/**
 * Largeur occupée par tout ce qui n'est pas le nom, dans une ligne de
 * `LigneSaisie` en grille fixe. Reflète ses classes — à tenir à jour ensemble :
 * marges `px-2` (16) · écart nom/cibles `gap-1.5` (6) · bouton « 0 »
 * (`h-14 w-14` 56 si grande, sinon 44 ; 36 sous 48 px) · `gap-2` (8) · champ
 * (pièce `w-20` 80 / `w-16` 64 ; kg `w-28` 112 / `w-24` 96) · icône de niveau
 * `h-4 w-4` + `gap-1.5` (22). L'icône est TOUJOURS réservée : un signalement
 * qui apparaît en cours de comptage ne doit pas faire sauter la grille.
 */
export function largeurHorsNom(hauteurLigne: number, unite: UniteGrille = 'piece'): number {
  const grande = hauteurLigne >= HAUTEUR_LIGNE_GRANDE;
  const bouton = grande ? 56 : hauteurLigne < HAUTEUR_LIGNE_MIN ? 36 : 44;
  const champ = unite === 'kg' ? (grande ? 112 : 96) : grande ? 80 : 64;
  const icone = 16 + 6;
  return 16 + 6 + bouton + 8 + champ + icone;
}

/**
 * Nombre de lignes de texte qu'occupe `nom` dans `largeur` px à `police` px :
 * retour à la ligne aux espaces, mot trop long coupé (`break-words`).
 */
export function lignesDuNom(nom: string, largeur: number, police: number): number {
  const parLigne = Math.floor(largeur / (police * RAPPORT_CARACTERE));
  if (parLigne < 1) return Number.POSITIVE_INFINITY;
  const mots = nom.split(/\s+/).filter((m) => m.length > 0);
  if (mots.length === 0) return 1;
  let lignes = 1;
  let occupe = 0;
  for (const mot of mots) {
    const besoin = occupe === 0 ? mot.length : occupe + 1 + mot.length;
    if (besoin <= parLigne) {
      occupe = besoin;
      continue;
    }
    if (occupe > 0) lignes += 1;
    // Mot plus long qu'une ligne : coupé sur plusieurs lignes.
    lignes += Math.ceil(mot.length / parLigne) - 1;
    occupe = mot.length % parLigne || parLigne;
  }
  return lignes;
}

/** Hauteur de texte disponible dans une ligne de `hauteurLigne` px (bordure basse retirée). */
const hauteurTexte = (hauteurLigne: number) => hauteurLigne - 1;

/**
 * Police du nom (px) pour qu'il tienne ENTIER dans la ligne : la police normale
 * si possible, sinon réduite pas à pas jusqu'à POLICE_NOM_MIN. `null` si même
 * à 13 px le nom déborderait : il faut alors une ligne plus haute (sous-pages).
 */
export function policeNom(nom: string, largeurNom: number, hauteurLigne: number): number | null {
  for (let police = policeNomNormale(hauteurLigne); police >= POLICE_NOM_MIN; police -= 1) {
    const lignes = lignesDuNom(nom, largeurNom, police);
    if (lignes * police * INTERLIGNE_NOM <= hauteurTexte(hauteurLigne)) return police;
  }
  return null;
}

/** Largeur d'une colonne quand `colonnes` se partagent `largeur` (classe `gap-x-2`). */
export function largeurColonne(largeur: number, colonnes: number): number {
  return (largeur - (colonnes - 1) * ECART_COLONNES) / colonnes;
}

export type Disposition = {
  colonnes: number;
  /** Rangées par sous-page (la plus remplie). */
  rangees: number;
  hauteurLigne: number;
  /** 1 = la page tient entière ; 2+ = découpée en sous-pages. */
  sousPages: number;
  /** Produits par sous-page (la plus remplie). */
  parSousPage: number;
  /**
   * Police du nom le plus contraint de la page (px). Inférieure à la police
   * normale quand un nom a dû être réduit pour tenir. Indicatif : chaque ligne
   * ajuste sa propre police à la mesure réelle (`LigneSaisie`).
   */
  policeNomMin: number;
};

/** Colonnes qui tiennent dans la largeur (au moins 1). */
export function colonnesMax(largeur: number, largeurCol: number = LARGEUR_MIN_COLONNE): number {
  return Math.max(1, Math.floor((largeur + ECART_COLONNES) / (largeurCol + ECART_COLONNES)));
}

/**
 * Sans la liste des produits (seulement la longueur du nom le plus long), on
 * suppose le pire : produit au kilo (champ le plus large). Prudent : la grille
 * peut être un peu moins dense, jamais déborder.
 */
function normaliser(produits: number | readonly ProduitGrille[]): Required<ProduitGrille>[] {
  if (typeof produits === 'number') return [{ nom: 'x'.repeat(Math.max(0, produits)), unite: 'kg' }];
  return produits.map((p) => ({ nom: p.nom, unite: p.unite ?? 'piece' }));
}

type Evaluation = { confort: boolean; policeMin: number } | null;

/** Les noms tiennent-ils tous, et comment, dans cette colonne à cette hauteur ? */
function evaluer(produits: readonly Required<ProduitGrille>[], largeurCol: number, hauteurLigne: number): Evaluation {
  const normale = policeNomNormale(hauteurLigne);
  let confort = true;
  let policeMin = normale;
  for (const p of produits) {
    const largeurNom = largeurCol - largeurHorsNom(hauteurLigne, p.unite);
    const police = policeNom(p.nom, largeurNom, hauteurLigne);
    if (police === null) return null;
    policeMin = Math.min(policeMin, police);
    if (police < normale || lignesDuNom(p.nom, largeurNom, normale) > 2) confort = false;
  }
  return { confort, policeMin };
}

/**
 * Meilleure disposition pour `nb` produits dans `largeur` × `hauteur` px.
 * `produits` : les produits de la page (nom + unité) ; ou, à défaut, le nombre
 * de caractères du nom le plus long (on suppose alors un produit au kilo).
 * Toujours un résultat : au pire, autant de sous-pages que de produits.
 */
export function calculerDisposition(
  nb: number,
  largeur: number,
  hauteur: number,
  produits: number | readonly ProduitGrille[] = 0
): Disposition {
  if (nb <= 0) {
    return {
      colonnes: 1,
      rangees: 0,
      hauteurLigne: HAUTEUR_LIGNE_MAX,
      sousPages: 1,
      parSousPage: 0,
      policeNomMin: policeNomNormale(HAUTEUR_LIGNE_MAX),
    };
  }
  const liste = normaliser(produits);
  const maxCol = colonnesMax(largeur);
  // Rangées qui tiennent au plus serré (au moins une, même sur un écran minuscule).
  const rangeesMax = Math.max(1, Math.floor(hauteur / HAUTEUR_LIGNE_MIN));
  const sousPagesMin = Math.max(1, Math.ceil(nb / (maxCol * rangeesMax)));

  for (let sousPages = sousPagesMin; sousPages <= nb; sousPages += 1) {
    const parSousPage = Math.ceil(nb / sousPages);
    let confortable: Disposition | null = null;
    let reduite: Disposition | null = null;
    for (let colonnes = 1; colonnes <= maxCol; colonnes += 1) {
      const rangees = Math.ceil(parSousPage / colonnes);
      if (rangees > rangeesMax) continue;
      const hauteurLigne = Math.min(HAUTEUR_LIGNE_MAX, Math.floor(hauteur / rangees));
      const ev = evaluer(liste, largeurColonne(largeur, colonnes), hauteurLigne);
      if (ev === null) continue;
      const d: Disposition = { colonnes, rangees, hauteurLigne, sousPages, parSousPage, policeNomMin: ev.policeMin };
      // À hauteur égale, on garde la première trouvée : la moins de colonnes.
      if (ev.confort) {
        if (confortable === null || hauteurLigne > confortable.hauteurLigne) confortable = d;
      } else if (
        reduite === null ||
        hauteurLigne > reduite.hauteurLigne ||
        (hauteurLigne === reduite.hauteurLigne && ev.policeMin > reduite.policeNomMin)
      ) {
        reduite = d;
      }
    }
    // 1. police normale ; 2. police réduite ; 3. sinon une sous-page de plus.
    const retenue = confortable ?? reduite;
    if (retenue) return retenue;
  }

  // Écran absurdement petit pour le nom : un produit par sous-page, en pleine
  // largeur, et la ligne prend toute la hauteur disponible pour que le nom
  // reste entier (au-delà des 80 px habituels). La ligne contient son contenu
  // (overflow masqué) et le nom complet reste accessible (title, aria-label).
  const hauteurLigne = Math.max(HAUTEUR_LIGNE_MIN, Math.floor(hauteur));
  const ev = evaluer(liste, largeur, hauteurLigne);
  return {
    colonnes: 1,
    rangees: 1,
    hauteurLigne,
    sousPages: nb,
    parSousPage: 1,
    policeNomMin: ev?.policeMin ?? POLICE_NOM_MIN,
  };
}

/** Découpe `liste` en `n` tranches consécutives équilibrées (17 en 2 → 9 + 8). */
export function scinderEnSousPages<T>(liste: readonly T[], n: number): T[][] {
  const parts = Math.max(1, Math.min(n, liste.length || 1));
  const taille = Math.ceil(liste.length / parts);
  const tranches: T[][] = [];
  for (let debut = 0; debut < liste.length; debut += taille) tranches.push(liste.slice(debut, debut + taille));
  return tranches.length > 0 ? tranches : [[]];
}

/** Libellé d'onglet : « Page 1 » ou « Page 1 · 1/2 » si la page est découpée. */
export function libelleSousPage(libellePage: string, index: number, total: number): string {
  return total > 1 ? `${libellePage} · ${index + 1}/${total}` : libellePage;
}
