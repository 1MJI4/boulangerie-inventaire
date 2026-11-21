// src/domaine/commandesFournil.ts
//
// R72 — Ce que les commandes clients ajoutent à la feuille du fournil
// (décision du propriétaire, 19/11/2026). Propriétaire : agent `regles-metier`.
//
// 1. Un produit commandé peut reposer sur un produit du fournil : le
//    « Croissant à la pâte d'amande » est un Croissant garni après cuisson, la
//    « Couque au chocolat double » une Couque au chocolat nappée. Il n'a pas de
//    ligne au fournil : il AUGMENTE sa base, 1 pour 1.
//    Le lien est une DONNÉE (src/catalogue/basesFournil.ts), jamais déduit du
//    nom (LOI 6) : c'est la seule passerelle entre le catalogue de commande et
//    la liste d'inventaire, qui restent deux listes séparées (LOI 10).
// 2. Un plateau tient N pièces, PEU IMPORTE LA SORTE : on additionne les pièces
//    commandées de toutes les sortes qui partagent les plateaux. Chaque tranche
//    de N = un plateau en plus. Pour le reste : jusqu'à la tolérance (4), pas
//    de plateau, on prend sur la vente normale ; au-delà (5 et plus), un
//    plateau en plus.
// 3. Une commande annulée ne compte plus.
//
// LOI 2 : tout reste en PIÈCES. Fonctions pures, aucun accès base.

/** Pièces en trop tolérées sans sortir de plateau (« si on dépasse de 5 on ajoute »). */
export const TOLERANCE_SANS_PLATEAU = 4;

/** Statut d'une commande qui ne compte plus pour le fournil. */
const STATUT_ANNULEE = 'annulee';

/** Une ligne de la table catalogue de commande → produit du fournil. */
export interface LienFournil {
  /** Clé du catalogue de commande (`ProduitCatalogue.cleCatalogue`). */
  commande: string;
  /** Nom du produit dans la liste d'inventaire (`Produit.nom`, unique). */
  fournil: string;
  /** true = produit dérivé (fini après cuisson) : à signaler au pâtissier. */
  derive: boolean;
  /**
   * Sorte choisie sur la ligne (21/11/2026) : un même produit commandé peut aller à
   * plusieurs produits du fournil — Beignet « Sucré » → Beignet sucré, « Nature » →
   * Beignet nature. Absent : valable pour toute la commande de ce produit.
   */
  gout?: string;
  /** true = pas encore au tarif : l'entrée est gardée mais ne sert pas. */
  aVenir?: boolean;
}

/** Ce que le calcul a besoin de savoir d'une ligne de commande. */
export interface LigneCommandee {
  cleCatalogue: string | null;
  /** Libellé du catalogue, à la lettre (LOI 5). */
  libelle: string;
  /** Pièces. Une ligne au kilo n'est jamais comptée ici. */
  quantite: number;
  unite: 'piece' | 'kg';
  statutCommande: string;
  /** Goûts / sorte choisis sur la ligne (la sorte d'un beignet). */
  gouts?: readonly string[];
}

export interface DetailCommande {
  libelle: string;
  pieces: number;
  derive: boolean;
}

export interface PartCommandee {
  fournil: string;
  /** Pièces commandées pour cette base, dérivés compris. */
  pieces: number;
  /** Par produit commandé, dans l'ordre de la table. */
  detail: DetailCommande[];
}

/**
 * Additionne les pièces commandées par produit du fournil. Ignore : commandes
 * annulées, lignes hors table, lignes au kilo, quantités non entières ou ≤ 0,
 * entrées « à venir ».
 */
export function partCommandeeParBase(
  lignes: readonly LigneCommandee[],
  liens: readonly LienFournil[],
): PartCommandee[] {
  const actifs = liens.filter((l) => !l.aVenir);
  const cle = (commande: string, gout?: string) => `${commande}|${(gout ?? '').trim().toLocaleLowerCase('fr')}`;
  const parCle = new Map(actifs.map((l) => [cle(l.commande, l.gout), l]));
  const parts = new Map<string, PartCommandee>();

  for (const ligne of lignes) {
    if (ligne.statutCommande === STATUT_ANNULEE) continue;
    if (ligne.unite !== 'piece' || ligne.cleCatalogue === null) continue;
    if (!Number.isSafeInteger(ligne.quantite) || ligne.quantite <= 0) continue;
    // La sorte choisie d'abord (Beignet Sucré), sinon le lien du produit entier.
    const lien = parCle.get(cle(ligne.cleCatalogue, ligne.gouts?.[0])) ?? parCle.get(cle(ligne.cleCatalogue));
    if (!lien) continue;

    const part = parts.get(lien.fournil) ?? { fournil: lien.fournil, pieces: 0, detail: [] };
    part.pieces += ligne.quantite;
    const dejaLa = part.detail.find((d) => d.libelle === ligne.libelle);
    if (dejaLa) dejaLa.pieces += ligne.quantite;
    else part.detail.push({ libelle: ligne.libelle, pieces: ligne.quantite, derive: lien.derive });
    parts.set(lien.fournil, part);
  }

  // Ordre stable : celui de la table (première apparition de chaque base).
  const ordre = [...new Set(actifs.map((l) => l.fournil))];
  return ordre.flatMap((nom) => {
    const part = parts.get(nom);
    return part ? [part] : [];
  });
}

export interface PartPlateau {
  fournil: string;
  /** Pièces commandées pour cette sorte. */
  commandees: number;
  /** Pièces à SORTIR EN PLUS pour cette sorte (0 si prises sur la vente normale). */
  aSortir: number;
}

export interface PlateauxEnPlus {
  /** Pièces commandées, toutes sortes confondues. */
  totalCommandees: number;
  /** Plateaux entiers à sortir en plus de ceux du manager. */
  plateaux: number;
  /** Pièces commandées servies sur les plateaux de la vente normale (0 à tolérance). */
  prisesSurVente: number;
  /** Places du dernier plateau complétées pour la vente (0 si le compte tombe juste). */
  complement: number;
  /** Sorte qui complète le plateau, null s'il n'y a rien à compléter. */
  sorteDuComplement: string | null;
  repartition: PartPlateau[];
}

/**
 * Plateaux à sortir en plus pour des sortes qui PARTAGENT leurs plateaux.
 * `parts` : pièces commandées par sorte, dans l'ordre d'affichage.
 *
 *   3 pièces  → 0 plateau, 3 prises sur la vente normale
 *   5 pièces  → 1 plateau, 11 places complétées
 *   20 pièces → 1 plateau, 4 prises sur la vente normale
 *   21 pièces → 2 plateaux, 11 places complétées
 *
 * HYPOTHÈSE À VALIDER (docs/QUESTIONS-GERANT.md) : le plateau ajouté part
 * PLEIN, complété par la sorte la plus commandée (égalité : la première de la
 * liste) ; les pièces « prises sur la vente » sont retirées de cette même sorte.
 */
export function plateauxEnPlus(
  parts: readonly { fournil: string; pieces: number }[],
  piecesParPlateau: number,
  tolerance: number = TOLERANCE_SANS_PLATEAU,
): PlateauxEnPlus {
  const propres = parts
    .map((p) => ({ fournil: p.fournil, pieces: Number.isSafeInteger(p.pieces) && p.pieces > 0 ? p.pieces : 0 }));
  const total = propres.reduce((s, p) => s + p.pieces, 0);
  const reste = total % piecesParPlateau;
  const pleins = (total - reste) / piecesParPlateau;
  const plateaux = pleins + (reste > tolerance ? 1 : 0);
  const capacite = plateaux * piecesParPlateau;

  const repartition: PartPlateau[] = propres.map((p) => ({
    fournil: p.fournil,
    commandees: p.pieces,
    aSortir: p.pieces,
  }));

  // Sorte la plus commandée ; à égalité, la première de la liste.
  let majoritaire: PartPlateau | null = null;
  for (const r of repartition) {
    if (r.commandees > 0 && (majoritaire === null || r.commandees > majoritaire.commandees)) majoritaire = r;
  }

  let prisesSurVente = 0;
  let complement = 0;
  if (capacite >= total) {
    complement = capacite - total;
    if (majoritaire && complement > 0) majoritaire.aSortir += complement;
  } else {
    // Le reste (≤ tolérance) est servi sur la vente normale : on le retire
    // de la sorte la plus commandée d'abord, puis des suivantes.
    prisesSurVente = total - capacite;
    let aRetirer = prisesSurVente;
    const ordre = [...repartition].sort((a, b) => b.commandees - a.commandees);
    for (const r of ordre) {
      const retire = Math.min(r.aSortir, aRetirer);
      r.aSortir -= retire;
      aRetirer -= retire;
      if (aRetirer === 0) break;
    }
  }

  return {
    totalCommandees: total,
    plateaux,
    prisesSurVente,
    complement,
    sorteDuComplement: complement > 0 && majoritaire ? majoritaire.fournil : null,
    repartition,
  };
}

/**
 * Prévisions (propriétaire, 19/11/2026) : les plateaux sortis pour les
 * commandes sont DÉJÀ dans le champ du manager, qui peut ensuite le modifier.
 * Rend, par sorte, le nombre de plateaux ENTIERS à y afficher. Le total est
 * celui de `plateauxEnPlus` ; chaque sorte reçoit d'abord ses plateaux pleins,
 * et un plateau partagé s'affiche une seule fois, sur la sorte qui en occupe
 * le plus (à égalité, la première de la liste).
 */
export function plateauxParSorte(
  parts: readonly { fournil: string; pieces: number }[],
  piecesParPlateau: number,
  tolerance: number = TOLERANCE_SANS_PLATEAU,
): Map<string, number> {
  const total = plateauxEnPlus(parts, piecesParPlateau, tolerance).plateaux;
  const sortes = parts.map((p) => {
    const pieces = Number.isSafeInteger(p.pieces) && p.pieces > 0 ? p.pieces : 0;
    const reste = pieces % piecesParPlateau;
    return { fournil: p.fournil, plateaux: (pieces - reste) / piecesParPlateau, reste };
  });
  let aPlacer = total - sortes.reduce((s, x) => s + x.plateaux, 0);
  const parReste = [...sortes].sort((a, b) => b.reste - a.reste);
  for (const s of parReste) {
    if (aPlacer <= 0) break;
    if (s.reste === 0) continue;
    s.plateaux += 1;
    aPlacer -= 1;
  }
  return new Map(sortes.map((s) => [s.fournil, s.plateaux]));
}

/**
 * Le champ des prévisions montre le TOTAL (plateaux du manager + plateaux des
 * commandes). Ce que le manager demande en propre = total tapé − plateaux des
 * commandes, jamais négatif : les commandes prises ne se retirent pas d'ici.
 */
export function partDuManager(plateauxTapes: number, plateauxDesCommandes: number): number {
  const tapes = Number.isSafeInteger(plateauxTapes) && plateauxTapes > 0 ? plateauxTapes : 0;
  const commandes = Number.isSafeInteger(plateauxDesCommandes) && plateauxDesCommandes > 0 ? plateauxDesCommandes : 0;
  return Math.max(0, tapes - commandes);
}

/** « 14 Croissant + 2 Couque au chocolat » — contenu des plateaux en plus (noms à la lettre). */
export function formaterContenuPlateaux(repartition: readonly PartPlateau[]): string {
  return repartition
    .filter((r) => r.aSortir > 0)
    .map((r) => `${r.aSortir} ${r.fournil}`)
    .join(' + ');
}

/**
 * Phrase du résumé, pour le manager et le pâtissier.
 *   « 9 pièces commandées → 1 plateau en plus : 14 Croissant + 2 Couque au chocolat »
 *   « 3 pièces commandées — à prendre sur les plateaux prévus, pas de plateau en plus »
 *   « 20 pièces commandées → 1 plateau en plus : … · 4 à prendre sur les plateaux prévus »
 * Chaîne vide s'il n'y a aucune commande.
 */
export function formaterResumePlateaux(p: PlateauxEnPlus): string {
  if (p.totalCommandees === 0) return '';
  const commandees = `${p.totalCommandees} pièce${p.totalCommandees > 1 ? 's' : ''} commandée${p.totalCommandees > 1 ? 's' : ''}`;
  if (p.plateaux === 0) return `${commandees} — à prendre sur les plateaux prévus, pas de plateau en plus`;
  const plateaux = `${p.plateaux} plateau${p.plateaux > 1 ? 'x' : ''} en plus : ${formaterContenuPlateaux(p.repartition)}`;
  const surVente = p.prisesSurVente > 0 ? ` · ${p.prisesSurVente} à prendre sur les plateaux prévus` : '';
  return `${commandees} → ${plateaux}${surVente}`;
}

/**
 * Ce que le fournil doit sortir en tout : la demande du manager (qui contient
 * déjà son « + » tapé à la main) + les pièces sorties pour les commandes de
 * l'application. « Prévu 48 + 16 commandés » → 64.
 */
export function totalAProduire(
  quantitePrevue: number | null | undefined,
  plateauCommandes: number | null | undefined,
): number {
  return Math.max(0, quantitePrevue ?? 0) + Math.max(0, plateauCommandes ?? 0);
}

/** « dont 7 Croissant à la pâte d'amande, 2 … » — les dérivés seulement ; vide s'il n'y en a pas. */
export function formaterDerives(detail: readonly DetailCommande[]): string {
  const derives = detail.filter((d) => d.derive && d.pieces > 0);
  if (derives.length === 0) return '';
  return `dont ${derives.map((d) => `${d.pieces} ${d.libelle}`).join(', ')}`;
}

/** Contrôle de la table : erreurs en français (vide = valide). `existe(cle)` : la clé est-elle un produit à la pièce du catalogue ? */
export function controlerLiensFournil(
  liens: readonly LienFournil[],
  existe: (cleCatalogue: string) => boolean,
): string[] {
  const erreurs: string[] = [];
  const vues = new Set<string>();
  for (const l of liens) {
    if (l.commande.trim() === '' || l.fournil.trim() === '') erreurs.push('Entrée incomplète (clé ou produit du fournil vide).');
    const id = `${l.commande}|${l.gout ?? ''}`;
    if (vues.has(id)) erreurs.push(`« ${l.commande} »${l.gout ? ` (${l.gout})` : ''} est cité deux fois : un produit commandé n'a qu'une base.`);
    vues.add(id);
    if (!l.aVenir && !existe(l.commande)) erreurs.push(`« ${l.commande} » n'est pas un produit à la pièce du catalogue de commande.`);
  }
  return erreurs;
}
