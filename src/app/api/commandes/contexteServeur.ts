// src/app/api/commandes/contexteServeur.ts
//
// Ce dont la route des commandes (et GET /api/calendrier) a besoin pour
// REJOUER le domaine côté serveur (KO-3) : jours fermés, règlement intérieur,
// délais, catalogue de commande à la date de prise, horloge de Bruxelles.
// Propriétaire : `commandes-traiteur`. Aucune règle ici : on lit des DONNÉES
// et on les passe au domaine (src/domaine/commande.ts).

import { prisma } from '@/lib/prisma';
import { journaliser } from '@/lib/journal';
import { FUSEAU } from '@/lib/dateProduction';
import { lireJoursFermes } from '@/lib/serveur/joursFermes';
import { lireReglages } from '@/lib/serveur/reglages';
import { getPrixServeur, getProduitServeur } from '@/catalogue/serveur';
import type { PrixEnVigueurServeur, ProduitServeur } from '@/catalogue/types';
import { DELAIS_HYPOTHESE, REGLEMENT_COMMANDE, type DelaisCommande, type ReglementCommande } from '@/domaine/constantes';
import type { JourFerme } from '@/domaine/calendrier';
import type { ResoudreProduit } from '@/domaine/commande';
import type { Resultat } from '@/domaine/resultat';
import type { DateISO, FicheTarifee } from '@/domaine/types';
import { succes } from '@/domaine/resultat';
import { signaler } from '@/domaine/messages';

export type ContexteServeur = {
  joursFermes: JourFerme[];
  reglement: ReglementCommande;
  delais: DelaisCommande;
};

/**
 * Règlement intérieur : réglages en base (table « Reglage », lus par
 * src/lib/serveur/reglages.ts) ; s'ils manquent (migration pas encore
 * appliquée), valeurs du règlement transmis le 15/10/2026 (REGLEMENT_COMMANDE),
 * et l'écart est journalisé pour l'administrateur.
 */
async function lireReglementCommande(route: string): Promise<ReglementCommande> {
  try {
    return (await lireReglages(prisma)).reglement;
  } catch (e) {
    journaliser({
      niveau: 'avertissement',
      code: 'INFO_HYPOTHESE',
      route,
      piste: 'Réglages « reglement:* » absents ou illisibles : valeurs du règlement intérieur (REGLEMENT_COMMANDE) appliquées.',
      detail: e,
    });
    return REGLEMENT_COMMANDE;
  }
}

export async function chargerContexte(route: string): Promise<ContexteServeur> {
  const [joursFermes, reglement] = await Promise.all([lireJoursFermes(prisma), lireReglementCommande(route)]);
  // HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°17) : délais en jours ouvrés, en attendant le gérant.
  return { joursFermes, reglement, delais: DELAIS_HYPOTHESE };
}

/** Date « AAAA-MM-JJ » et heure « HH:MM » d'un instant, à Bruxelles (R56 : posées par le serveur). */
export function priseBruxelles(instant: Date): { datePrise: DateISO; heurePrise: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSEAU,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return { datePrise: `${parts.year}-${parts.month}-${parts.day}`, heurePrise: `${parts.hour}:${parts.minute}` };
}

export type FicheServeur = { produit: ProduitServeur; prix: PrixEnVigueurServeur };

/**
 * Lit au catalogue (base) chaque produit des lignes, à la date de prise (R4),
 * puis fournit au domaine un `ResoudreProduit` synchrone. Le domaine ne voit
 * QUE ce que dit le catalogue : jamais un prix venu de la tablette.
 */
export async function resoudreServeur(
  produitIds: readonly string[],
  datePrise: DateISO,
): Promise<{ resoudre: ResoudreProduit; fiches: Map<string, FicheServeur> }> {
  const resultats = new Map<string, Resultat<FicheServeur>>();
  for (const id of new Set(produitIds)) {
    const produit = await getProduitServeur(id);
    if (!produit.ok) {
      resultats.set(id, produit);
      continue;
    }
    const prix = await getPrixServeur(id, datePrise);
    resultats.set(id, prix.ok ? succes({ produit: produit.donnees, prix: prix.donnees }) : prix);
  }
  const fiches = new Map<string, FicheServeur>();
  for (const [id, r] of resultats) if (r.ok) fiches.set(id, r.donnees);

  const resoudre: ResoudreProduit = (produitId, date) => {
    const r = resultats.get(produitId);
    if (!r || date !== datePrise) {
      // Jamais demandé à une autre date : bug d'appel, on refuse plutôt que de deviner.
      return signaler('ERR_PRODUIT_INCONNU', {}, { champ: 'produitId' });
    }
    if (!r.ok) return r;
    return succes<FicheTarifee>(r.donnees);
  };
  return { resoudre, fiches };
}
