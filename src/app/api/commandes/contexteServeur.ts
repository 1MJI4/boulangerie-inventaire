// src/app/api/commandes/contexteServeur.ts
//
// Ce dont la route des commandes (et GET /api/calendrier) a besoin pour
// REJOUER le domaine côté serveur (KO-3) : jours fermés, règlement intérieur,
// délais, catalogue de commande à la date de prise, horloge de Bruxelles.
// Propriétaire : `commandes-traiteur`. Aucune règle ici : on lit des DONNÉES
// et on les passe au domaine (src/domaine/commande.ts).

import { prisma } from '@/lib/prisma';
import { journaliser, nouvelleReference } from '@/lib/journal';
import { FUSEAU } from '@/lib/dateProduction';
import { lireJoursFermes } from '@/lib/serveur/joursFermes';
import { lireReglages } from '@/lib/serveur/reglages';
import { getPrixServeur, getProduitServeur } from '@/catalogue/serveur';
import type { PrixEnVigueurServeur, ProduitServeur } from '@/catalogue/types';
import {
  CORRESPONDANCES_COMPTOIR,
  clesCorrespondances,
  controlerCorrespondancesComptoir,
  type CorrespondanceComptoir,
  type FicheCorrespondance,
} from '@/catalogue/correspondancesComptoir';
import { DELAIS_PAR_DEFAUT, REGLEMENT_COMMANDE, type DelaisCommande, type ReglementCommande } from '@/domaine/constantes';
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
 * Règlement intérieur et délai d'un gâteau à étages : réglages en base (table
 * « Reglage », lus par src/lib/serveur/reglages.ts) ; s'ils sont illisibles
 * (migration pas encore appliquée, valeur cassée), valeurs par défaut des
 * décisions du propriétaire (REGLEMENT_COMMANDE, DELAIS_PAR_DEFAUT), et
 * l'écart est journalisé pour l'administrateur.
 */
async function lireReglagesCommande(route: string): Promise<{ reglement: ReglementCommande; delais: DelaisCommande }> {
  try {
    const r = await lireReglages(prisma);
    return {
      reglement: r.reglement,
      // Délai 0 pour tous les régimes (jour même autorisé, 18/10/2026) ;
      // gâteau à étages : réglage du gérant (reglement:delai_gateau_etages_jours).
      delais: { parRegime: { ...DELAIS_PAR_DEFAUT.parRegime }, gateauAEtages: r.delaiGateauEtagesJours },
    };
  } catch (e) {
    journaliser({
      niveau: 'avertissement',
      code: 'INFO_HYPOTHESE',
      route,
      piste: 'Réglages « reglement:* » absents ou illisibles : valeurs par défaut (REGLEMENT_COMMANDE, DELAIS_PAR_DEFAUT) appliquées.',
      detail: e,
    });
    return { reglement: REGLEMENT_COMMANDE, delais: DELAIS_PAR_DEFAUT };
  }
}

export async function chargerContexte(route: string): Promise<ContexteServeur> {
  const [joursFermes, reglages] = await Promise.all([lireJoursFermes(prisma), lireReglagesCommande(route)]);
  return { joursFermes, reglement: reglages.reglement, delais: reglages.delais };
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

/**
 * R60 — correspondances « gâteau sur commande + taille → gâteau du comptoir »
 * (donnée du catalogue), CONTRÔLÉES contre le catalogue en base à la date de
 * prise dès qu'une ligne touche l'un de ces produits : clé inconnue, régime
 * inattendu ou taille hors des tailles standard → la commande est refusée
 * (ERR_CONFIGURATION_SERVEUR, piste dans le journal) plutôt que vendue à un
 * prix douteux (règle de doute). Aucune ligne concernée : rien n'est lu.
 */
export async function correspondancesServeur(
  produitIds: readonly string[],
  datePrise: DateISO,
  tailles: readonly number[],
  route: string,
): Promise<Resultat<readonly CorrespondanceComptoir[]>> {
  const cles = clesCorrespondances(CORRESPONDANCES_COMPTOIR);
  if (!produitIds.some((id) => cles.includes(id))) return succes(CORRESPONDANCES_COMPTOIR);
  const fiches = new Map<string, FicheCorrespondance | null>();
  for (const cle of cles) {
    const produit = await getProduitServeur(cle);
    if (!produit.ok) {
      fiches.set(cle, null);
      continue;
    }
    const prix = await getPrixServeur(cle, datePrise);
    fiches.set(cle, { produit: produit.donnees, prix: prix.ok ? prix.donnees : null });
  }
  const erreurs = controlerCorrespondancesComptoir(CORRESPONDANCES_COMPTOIR, (cle) => fiches.get(cle) ?? null, tailles);
  if (erreurs.length === 0) return succes(CORRESPONDANCES_COMPTOIR);
  const reference = nouvelleReference();
  journaliser({
    niveau: 'erreur',
    code: 'ERR_CONFIGURATION_SERVEUR',
    route,
    reference,
    piste: `Correspondances gâteau sur commande → comptoir invalides (src/catalogue/correspondancesComptoir.ts) : ${erreurs.join(' ')}`,
  });
  return signaler('ERR_CONFIGURATION_SERVEUR', { reference });
}
