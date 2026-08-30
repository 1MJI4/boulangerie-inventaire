// src/lib/pagination.ts
//
// Le client veut des pages d'une vingtaine de produits. Un simple découpage
// tous les 20 tombe au milieu d'un rayon : une page se termine sur trois
// baguettes et enchaîne sur les salades. Le vendeur, lui, finit un rayon
// avant de passer au suivant.
//
// On coupe donc à peu près tous les 20, mais en calant les coupures sur les
// changements de rayon. Chaque rayon est réparti en tranches à peu près
// égales, ce qui évite aussi la page famélique de trois articles à la fin.

export const CIBLE_PAGE = 20;

/** En dessous, une tranche est rattachée à la page précédente. */
const MINIMUM_TRANCHE = 8;

type Groupable = { categorie: string };

/** Découpe une suite de produits en pages d'environ `cible` articles. */
export function decouperEnPages<T extends Groupable>(
  produits: T[],
  cible: number = CIBLE_PAGE
): T[][] {
  if (produits.length === 0) return [];
  if (produits.length <= cible) return [produits];

  // Suites d'articles consécutifs du même rayon. On raisonne sur des suites,
  // pas sur le rayon en général : dans un parcours, un rayon peut être visité
  // en plusieurs fois.
  const suites: T[][] = [];
  for (const produit of produits) {
    const derniere = suites[suites.length - 1];
    if (derniere && derniere[0].categorie === produit.categorie) derniere.push(produit);
    else suites.push([produit]);
  }

  const pages: T[][] = [];
  let enCours: T[] = [];

  const cloturer = () => {
    if (enCours.length === 0) return;
    // Une fin de page trop courte rejoint la précédente plutôt que de faire
    // une page à part.
    if (enCours.length < MINIMUM_TRANCHE && pages.length > 0) {
      pages[pages.length - 1].push(...enCours);
    } else {
      pages.push(enCours);
    }
    enCours = [];
  };

  for (const suite of suites) {
    // Suite courte : on la joint à la page en construction plutôt que de lui
    // consacrer une page presque vide.
    if (suite.length < MINIMUM_TRANCHE) {
      enCours.push(...suite);
      if (enCours.length >= cible) cloturer();
      continue;
    }

    cloturer();

    // Répartition en tranches à peu près égales : 51 produits donnent
    // trois pages de 17, pas deux de 20 et une de 11.
    const nombreTranches = Math.max(1, Math.round(suite.length / cible));
    const taille = Math.ceil(suite.length / nombreTranches);
    for (let debut = 0; debut < suite.length; debut += taille) {
      pages.push(suite.slice(debut, debut + taille));
    }
  }

  cloturer();
  return pages;
}

/** Étiquette d'une page : le rayon s'il est seul, sinon les rayons traversés. */
export function libellePage<T extends Groupable>(page: T[]): string {
  const rayons = [...new Set(page.map((p) => p.categorie))];
  return rayons.length === 1 ? rayons[0] : rayons.join(' + ');
}
