// src/lib/serveur/reglages.ts
//
// LOI 11 — lecture des chiffres du règlement intérieur, stockés comme DONNÉES
// dans la table "Reglage" (clés « reglement:* », migration
// 20261015140000_commandes_reglement), sous la forme attendue par le domaine :
// `ReglementCommande` de src/domaine/constantes.ts (propriétaire
// `regles-metier`) + l'heure de fermeture (verifierHeureInventaire).
// Propriétaire de ce fichier : `base-donnees`.
//
// AUCUNE règle ici et AUCUNE valeur par défaut : une clé absente ou
// illisible lève une erreur (la base refuse déjà une valeur invalide —
// CHECK "Reglage_reglement_valide" — et leur suppression). Mieux vaut
// échouer que d'appliquer un acompte ou un horaire inventé.
// Pas d'import de Prisma : conversion pure testable avec `node --test`, le
// client est reçu en paramètre (`prisma` de src/lib/prisma.ts le satisfait).

import type { ReglementCommande } from '../../domaine/constantes.ts';

/** Clés lues (= données initiales de la migration). */
export const CLES_REGLEMENT = {
  acomptePourcentageMin: 'reglement:acompte_min_pourcent',
  heureFermeture: 'reglement:heure_fermeture',
  retraitSemaine: 'reglement:patisserie_retrait_semaine',
  retraitWeekEnd: 'reglement:patisserie_retrait_week_end',
  joursWeekEndIso: 'reglement:jours_week_end_iso',
  famillesPatisserie: 'reglement:familles_patisserie',
} as const;

const TOUTES_LES_CLES: string[] = Object.values(CLES_REGLEMENT);

/** Ce que reçoit l'appelant : le règlement de commande et l'heure de fermeture. */
export type ReglagesReglement = {
  reglement: ReglementCommande;
  /** « HH:MM » — inventaire « jamais avant » (AVERT_INVENTAIRE_AVANT_FERMETURE). */
  heureFermeture: string;
};

/** Forme d'une ligne Prisma `Reglage` (seuls les champs lus). */
export type LigneReglage = { cle: string; valeur: string };

/** Client minimal. */
export type LecteurReglages = {
  reglage: {
    findMany(args: {
      where: { cle: { in: string[] } };
      select: { cle: true; valeur: true };
    }): Promise<LigneReglage[]>;
  };
};

const FORMAT_HEURE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function erreur(cle: string, raison: string): Error {
  return new Error(`Reglage ${cle} : ${raison}.`);
}

function lireJson(valeurs: Map<string, string>, cle: string): unknown {
  const brut = valeurs.get(cle);
  if (brut === undefined) throw erreur(cle, 'absent');
  try {
    return JSON.parse(brut);
  } catch {
    throw erreur(cle, 'illisible');
  }
}

function lireHeure(valeurs: Map<string, string>, cle: string): string {
  const v = lireJson(valeurs, cle);
  if (typeof v !== 'string' || !FORMAT_HEURE.test(v)) throw erreur(cle, 'heure « HH:MM » attendue');
  return v;
}

/**
 * Conversion pure lignes "Reglage" → données du domaine.
 * Lève si une clé manque ou si une valeur est hors format.
 */
export function versReglages(lignes: readonly LigneReglage[]): ReglagesReglement {
  const valeurs = new Map(lignes.map((l) => [l.cle, l.valeur]));

  const pourcent = lireJson(valeurs, CLES_REGLEMENT.acomptePourcentageMin);
  if (typeof pourcent !== 'number' || !Number.isInteger(pourcent) || pourcent < 0 || pourcent > 100) {
    throw erreur(CLES_REGLEMENT.acomptePourcentageMin, 'entier de 0 à 100 attendu');
  }

  const jours = lireJson(valeurs, CLES_REGLEMENT.joursWeekEndIso);
  if (
    !Array.isArray(jours) ||
    !jours.every((j) => Number.isInteger(j) && j >= 1 && j <= 7) ||
    new Set(jours).size !== jours.length
  ) {
    throw erreur(CLES_REGLEMENT.joursWeekEndIso, 'liste de jours 1 à 7 sans doublon attendue');
  }

  const familles = lireJson(valeurs, CLES_REGLEMENT.famillesPatisserie);
  if (
    !Array.isArray(familles) ||
    familles.length === 0 ||
    !familles.every((f) => typeof f === 'string' && f.trim().length > 0)
  ) {
    throw erreur(CLES_REGLEMENT.famillesPatisserie, 'liste de familles non vide attendue');
  }

  return {
    reglement: {
      acomptePourcentageMin: pourcent,
      horairesRetraitPatisserie: {
        familles: familles as string[],
        semaine: lireHeure(valeurs, CLES_REGLEMENT.retraitSemaine),
        weekEnd: lireHeure(valeurs, CLES_REGLEMENT.retraitWeekEnd),
        joursWeekEndIso: jours as number[],
        // Jours fériés ouverts : dérivés de la table JourFerme par le domaine.
        feriesOuverts: [],
      },
    },
    heureFermeture: lireHeure(valeurs, CLES_REGLEMENT.heureFermeture),
  };
}

/** Lit les réglages du règlement (une requête). */
export async function lireReglages(client: LecteurReglages): Promise<ReglagesReglement> {
  const lignes = await client.reglage.findMany({
    where: { cle: { in: TOUTES_LES_CLES } },
    select: { cle: true, valeur: true },
  });
  return versReglages(lignes);
}
