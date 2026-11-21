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
// 2. Plateaux (Croissant, Couque au chocolat) — SIMPLIFIÉ le 21/11/2026 : les pièces
//    commandées PRÉREMPLISSENT les champs du manager, qui les modifie ensuite à sa
//    guise : 6 commandées → « + 6 » ; 7 → « + 7 » ; 16 → 1 plateau. On GARDE la
//    tolérance de 4 : jusqu'à 4 pièces on ne remplit rien (prises sur la vente
//    normale), mais l'écran dit « 4 en commande » et propose de les ajouter
//    (preremplirCommandes).
// 3. Une commande annulée ne compte plus.
//
// LOI 2 : tout reste en PIÈCES. Fonctions pures, aucun accès base.

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

/** Pièces en trop tolérées sans rien ajouter (« jusqu'à 4 on prend sur la vente normale »). */
export const TOLERANCE_SANS_PLATEAU = 4;

/**
 * Préremplissage des champs du manager pour un produit à plateaux (21/11/2026) :
 * chaque tranche entière de `piecesParPlateau` pièces commandées = 1 plateau, le
 * reste va dans le « + » (en pièces) — SAUF un reste de 4 pièces ou moins (tolérance) :
 * il n'est pas ajouté, il est seulement SIGNALÉ (`facultatif`) pour que le manager
 * l'ajoute d'un geste s'il le veut.
 *   3 → rien, 3 en commande   ·   6 → + 6   ·   10 → + 10   ·   16 → 1 plateau
 *   20 → 1 plateau, 4 en commande   ·   21 → 1 plateau, + 5
 * Ce n'est qu'un PRÉREMPLISSAGE : le manager corrige ensuite les deux champs.
 */
export function preremplirCommandes(
  piecesCommandees: number,
  piecesParPlateau: number,
  tolerance: number = TOLERANCE_SANS_PLATEAU,
): { plateaux: number; plus: number; facultatif: number } {
  const n = Number.isSafeInteger(piecesCommandees) && piecesCommandees > 0 ? piecesCommandees : 0;
  const valide = Number.isSafeInteger(piecesParPlateau) && piecesParPlateau > 0;
  const reste = valide ? n % piecesParPlateau : n;
  const plateaux = valide ? (n - reste) / piecesParPlateau : 0;
  return reste <= tolerance ? { plateaux, plus: 0, facultatif: reste } : { plateaux, plus: reste, facultatif: 0 };
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
