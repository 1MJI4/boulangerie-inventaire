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
  | { type: 'lendemain'; par: string; le: Date; /** Date de retrait accordée (AAAA-MM-JJ). */ dateRetrait: string }
  | {
      type: 'remise';
      par: string;
      le: Date;
      /** Total convenu avec le client au moment de l'accord (centimes). */
      totalCentimes: number;
      /** Total au tarif au moment de l'accord (centimes) ; null si inconnu (commande ancienne). */
      totalTarifCentimes: number | null;
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

/** Retrait le lendemain : seulement si la date de retrait ne change pas. */
export function lendemainCouvert(a: AccordEnregistre, dateRetrait: string): boolean {
  return a.type === 'lendemain' && a.dateRetrait === dateRetrait;
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
