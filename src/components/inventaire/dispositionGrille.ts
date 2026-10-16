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
//   - une colonne ne descend pas sous LARGEUR_MIN_COLONNE (nom + « 0 » + champ),
//     ni sous la largeur qui affiche le nom le plus long de la page EN ENTIER
//     sur deux lignes au plus (LOI 5 : jamais d'ellipse) ;
//   - on prend la ligne la PLUS HAUTE possible ; à hauteur égale, le moins de
//     colonnes (noms moins tronqués) ;
//   - si même au plus serré la page ne tient pas, elle est découpée en
//     sous-pages équilibrées (« Page 1 · 1/2 ») : jamais de défilement.
//
// Aucune dépendance (ni React, ni DOM) : testé par `dispositionGrille.test.ts`.
// Propriétaire : `inventaire-scan`. Ce sont des pixels, pas des montants.

/** Cible tactile minimale : toute la ligne se touche. */
export const HAUTEUR_LIGNE_MIN = 48;
/** Au-delà, la ligne ne gagne plus en lisibilité (texte 18 px, cibles de 56 px dès 64 px). */
export const HAUTEUR_LIGNE_MAX = 80;
/** Nom (≈ 7 caractères visibles au pire) + bouton « 0 » + champ quantité, marges comprises. */
export const LARGEUR_MIN_COLONNE = 240;
/** Écart horizontal entre deux colonnes (classe `gap-x-2`). */
export const ECART_COLONNES = 8;
/** Largeur moyenne d'un caractère du nom (texte de 18 px, estimation prudente). */
export const LARGEUR_CARACTERE = 10;
/** Tout ce qui n'est pas le nom : marges, bouton « 0 » et champ (grandes cibles). */
export const LARGEUR_HORS_NOM = 164;

/** Largeur minimale d'une colonne pour lire un nom de `caracteres` caractères sur deux lignes. */
export function largeurColonnePourNom(caracteres: number): number {
  return Math.max(LARGEUR_MIN_COLONNE, Math.ceil(caracteres / 2) * LARGEUR_CARACTERE + LARGEUR_HORS_NOM);
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
};

/** Colonnes qui tiennent dans la largeur (au moins 1). */
export function colonnesMax(largeur: number, largeurColonne: number = LARGEUR_MIN_COLONNE): number {
  return Math.max(1, Math.floor((largeur + ECART_COLONNES) / (largeurColonne + ECART_COLONNES)));
}

/**
 * Meilleure disposition pour `nb` produits dans `largeur` × `hauteur` px.
 * `nomLePlusLong` : nombre de caractères du nom le plus long de la page.
 * Toujours un résultat : au pire, autant de sous-pages que nécessaire.
 */
export function calculerDisposition(nb: number, largeur: number, hauteur: number, nomLePlusLong = 0): Disposition {
  const maxCol = colonnesMax(largeur, largeurColonnePourNom(nomLePlusLong));
  // Rangées qui tiennent au plus serré (au moins une, même sur un écran minuscule).
  const rangeesMax = Math.max(1, Math.floor(hauteur / HAUTEUR_LIGNE_MIN));
  if (nb <= 0) {
    return { colonnes: 1, rangees: 0, hauteurLigne: HAUTEUR_LIGNE_MAX, sousPages: 1, parSousPage: 0 };
  }

  const sousPages = Math.max(1, Math.ceil(nb / (maxCol * rangeesMax)));
  const parSousPage = Math.ceil(nb / sousPages);

  let meilleure: Disposition | null = null;
  for (let colonnes = 1; colonnes <= maxCol; colonnes += 1) {
    const rangees = Math.ceil(parSousPage / colonnes);
    if (rangees > rangeesMax) continue;
    const hauteurLigne = Math.min(HAUTEUR_LIGNE_MAX, Math.floor(hauteur / rangees));
    // À hauteur égale, on garde la première trouvée : la moins de colonnes.
    if (meilleure === null || hauteurLigne > meilleure.hauteurLigne) {
      meilleure = { colonnes, rangees, hauteurLigne, sousPages, parSousPage };
    }
  }
  // Toujours trouvée : `sousPages` garantit parSousPage ≤ maxCol × rangeesMax.
  return (
    meilleure ?? {
      colonnes: maxCol,
      rangees: rangeesMax,
      hauteurLigne: HAUTEUR_LIGNE_MIN,
      sousPages,
      parSousPage,
    }
  );
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
