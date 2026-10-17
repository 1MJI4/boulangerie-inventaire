// src/components/commande/accords.ts
//
// Conservation d'un accord du gérant DÉJÀ enregistré, lors de la modification
// d'une commande sans que le gérant soit présent (propriétaire :
// `commandes-traiteur`, appelé par la route PATCH /api/commandes).
//
// Principe (réserves qa-metier, règle de doute) : un accord porte sur ce que le
// gérant a vu au moment où il l'a donné. Il n'est conservé que si ce qu'il
// couvre n'a pas bougé dans le sens défavorable au commerce ; sinon le code
// gérant est redemandé (ERR_DROIT_INSUFFISANT, décidé par la route).
// Le retrait le lendemain ne demande plus d'accord (LOI 11, 15/10/2026).
// Fonctions pures, sans base ni écran.
//
// Imports relatifs avec extension : module exécuté tel quel par `node --test`.

/** Accord enregistré avec la commande, et ce qu'il couvrait. */
export type AccordEnregistre =
  | {
      type: 'ligne';
      /** « clé produit|prix » (ou « libre:libellé|prix ») de la ligne. */
      cle: string;
      par: string;
      le: Date;
      /** Quantité de la ligne au moment de l'accord. */
      quantite: number;
    }
  | {
      type: 'remise';
      par: string;
      le: Date;
      /** Total convenu avec le client au moment de l'accord (centimes). */
      totalCentimes: number;
      /** Total au tarif au moment de l'accord (centimes) ; null si inconnu (commande ancienne). */
      totalTarifCentimes: number | null;
    }
  | {
      /**
       * Taille de gâteau hors standard (LOI 11), tracée sur la ligne
       * (`tailleAutoriseePar` / `tailleAutoriseeLe`). Distincte de l'accord de
       * prix : autoriser un prix n'autorise pas une taille.
       */
      type: 'taille';
      /** Clé catalogue du produit. */
      cle: string;
      par: string;
      le: Date;
      /** Nombre de parts autorisé. */
      quantite: number;
    };

/** Accord renvoyé par la tablette : nom et horodatage lus tels qu'enregistrés. */
export type AccordRecu = { par: string; le: string };

/** La tablette renvoie bien CET accord (même nom, même heure), pas un autre. */
export function memeAccord(a: AccordEnregistre, recu: AccordRecu): boolean {
  return a.par === recu.par && a.le.toISOString() === recu.le;
}

/**
 * Ligne (prix sous plancher, ligne libre) : même produit, même prix.
 * HYPOTHÈSE À VALIDER (réserve 3) : quantité identique ou INFÉRIEURE seulement ;
 * 20 parts autorisées ne deviennent jamais 30 sans le gérant.
 */
export function ligneCouverte(a: AccordEnregistre, ligne: { cle: string; quantite: number | null }): boolean {
  if (a.type !== 'ligne' || a.cle !== ligne.cle) return false;
  const q = ligne.quantite;
  return q !== null && Number.isSafeInteger(q) && q <= a.quantite;
}

/**
 * Remise sur le total.
 * HYPOTHÈSE À VALIDER (KO qa-metier) : règle la plus sûre — total convenu ET
 * total au tarif IDENTIQUES à ceux de l'accord. Un total remisé abaissé, ou
 * 20 → 40 parts au même total remisé, redemande le code gérant. Accord
 * ancien sans total au tarif connu : jamais conservé.
 */
export function remiseCouverte(
  a: AccordEnregistre,
  totaux: { totalCentimes: number; totalTarifCentimes: number },
): boolean {
  return (
    a.type === 'remise' &&
    a.totalTarifCentimes !== null &&
    a.totalCentimes === totaux.totalCentimes &&
    a.totalTarifCentimes === totaux.totalTarifCentimes
  );
}

/**
 * Taille hors standard déjà acceptée (LOI 11) : même produit, quantité
 * IDENTIQUE. 7 parts autorisées ne deviennent ni 9 ni 5 sans le gérant :
 * toute autre taille non standard redemande le code.
 */
export function tailleCouverte(a: AccordEnregistre, ligne: { produitId: string | null; quantite: number | null }): boolean {
  return a.type === 'taille' && ligne.produitId !== null && a.cle === ligne.produitId && a.quantite === ligne.quantite;
}

/**
 * Accords renvoyés par la tablette que personne n'a confirmés (gérant absent,
 * pas d'accord enregistré qui les couvre) : par ligne, prix et/ou taille ;
 * pour la commande, la remise.
 */
export type AccordsNonConfirmes = {
  lignes: { prix: boolean; taille: boolean }[];
  remise: boolean;
};

/** Ce que le domaine a réellement utilisé (autorisations tracées). */
export type AccordsUtilises = {
  lignes: { autorisation?: unknown; autorisationTaille?: unknown }[];
  remise?: unknown;
};

export type AccordManquant =
  | { type: 'prix' | 'taille'; ligne: number }
  | { type: 'remise' };

/**
 * Réserve m3 (qa-metier) : un accord devenu INUTILE (taille redevenue
 * standard, prix revenu au plancher ou au-dessus, total redevenu égal au
 * tarif) est ignoré, jamais refusé — et jamais enregistré. Seul un accord non
 * confirmé que le domaine a effectivement dû utiliser redemande le code
 * gérant. Le domaine ne trace une autorisation que si elle sert ; c'est donc
 * lui qui dit si l'accord était nécessaire.
 */
export function accordManquant(attente: AccordsNonConfirmes, utilises: AccordsUtilises): AccordManquant | null {
  for (const [i, l] of utilises.lignes.entries()) {
    const a = attente.lignes[i];
    if (!a) continue;
    if (a.prix && l.autorisation) return { type: 'prix', ligne: i };
    if (a.taille && l.autorisationTaille) return { type: 'taille', ligne: i };
  }
  if (attente.remise && utilises.remise) return { type: 'remise' };
  return null;
}
