// src/lib/serveur/partCommandee.ts
//
// R72 — Part des commandes clients sur la feuille du fournil (propriétaire,
// 19/11/2026). AUCUNE règle ici : le calcul est dans le domaine
// (src/domaine/commandesFournil.ts), le lien commande → fournil dans
// src/catalogue/basesFournil.ts. Ce module lit les commandes, appelle le
// domaine et ÉCRIT le résultat dans "Inventaire" (commandeAuto,
// plateauCommandes) pour que l'historique le garde.
//
// UN SEUL RECALCUL COMPLET, jamais d'addition au fil de l'eau : on relit
// toutes les commandes non annulées de la journée et on REMPLACE les valeurs.
// Rejoué deux fois, il donne le même résultat ; un recalcul manqué (coupure)
// est rattrapé par le suivant. Appelé après chaque commande créée, modifiée ou
// annulée, et à l'ouverture des prévisions et de la feuille du fournil.
//
// Journée de production = jour du RETRAIT de la commande (convention de
// l'écran des prévisions). Une journée passée n'est plus réécrite.
//
// LOI 10 : les deux listes restent séparées ; seule la table BASES_FOURNIL
// les relie (clé du catalogue de commande → nom unique d'un produit d'inventaire).

import { prisma } from '@/lib/prisma';
import { journaliser } from '@/lib/journal';
import { dateDuJour } from '@/lib/dateProduction';
import { BASES_FOURNIL, basesSuivies, clesSuivies } from '@/catalogue/basesFournil';
import {
  formaterResumePlateaux,
  partCommandeeParBase,
  plateauxEnPlus,
  type DetailCommande,
  type LigneCommandee,
} from '@/domaine/commandesFournil';
import { sePlanifieEnPlateaux } from '@/domaine/plateaux';

export interface PartFournil {
  produitId: number;
  nom: string;
  /** Pièces commandées dans l'application pour ce produit (dérivés compris). */
  commandeAuto: number;
  /** Pièces à sortir EN PLUS pour ces commandes. */
  plateauCommandes: number;
  detail: DetailCommande[];
}

export interface PartCommandeeJournee {
  journee: string;
  bases: PartFournil[];
  /** Une phrase par groupe de sortes qui partagent leurs plateaux (vide si aucune commande). */
  resumes: string[];
}

/** Une DATE Postgres se stocke à midi UTC (comme /api/inventaires). */
function versDatePg(dateISO: string): Date {
  return new Date(`${dateISO}T12:00:00.000Z`);
}

export async function recalculerPartCommandee(journee: string): Promise<PartCommandeeJournee> {
  const [produits, lignesBase] = await Promise.all([
    prisma.produit.findMany({
      where: { nom: { in: basesSuivies() }, unite: 'piece' },
      select: { id: true, nom: true, ordre: true, piecesParPlateau: true },
      orderBy: { ordre: 'asc' },
    }),
    prisma.ligneCommande.findMany({
      where: {
        commande: { retraitLe: new Date(`${journee}T00:00:00Z`), statut: { not: 'annulee' } },
        produitCatalogue: { cleCatalogue: { in: clesSuivies() } },
      },
      select: {
        quantite: true,
        unite: true,
        produitCatalogue: { select: { cleCatalogue: true, nom: true } },
        commande: { select: { statut: true } },
      },
    }),
  ]);

  // Une base absente de la liste d'inventaire (ou au kilo) : ses commandes ne
  // peuvent pas être portées — on le dit dans le journal, on ne devine rien.
  const connus = new Set(produits.map((p) => p.nom));
  const liens = BASES_FOURNIL.filter((l) => connus.has(l.fournil));
  const manquantes = basesSuivies().filter((nom) => !connus.has(nom));
  if (manquantes.length > 0) {
    journaliser({
      niveau: 'avertissement',
      code: 'ERR_CONFIGURATION_SERVEUR',
      route: 'partCommandee',
      piste: `Produit(s) du fournil absent(s) de la liste d'inventaire : ${manquantes.join(', ')}. Leurs commandes ne sont pas ajoutées à la feuille.`,
    });
  }

  const lignes: LigneCommandee[] = lignesBase.map((l) => ({
    cleCatalogue: l.produitCatalogue?.cleCatalogue ?? null,
    libelle: l.produitCatalogue?.nom ?? '',
    quantite: l.quantite,
    unite: l.unite,
    statutCommande: l.commande.statut,
  }));
  const parts = partCommandeeParBase(lignes, liens);
  const partDe = new Map(parts.map((p) => [p.fournil, p]));

  // Sortes qui partagent leurs plateaux = même contenance (16 pour Croissant
  // et Couque au chocolat). Un produit sans plateau sort ses pièces telles quelles.
  const aSortir = new Map<string, number>();
  const resumes: string[] = [];
  const contenances = [...new Set(produits.map((p) => p.piecesParPlateau).filter(sePlanifieEnPlateaux))];
  for (const contenance of contenances) {
    const groupe = produits.filter((p) => p.piecesParPlateau === contenance);
    const calcul = plateauxEnPlus(
      groupe.map((p) => ({ fournil: p.nom, pieces: partDe.get(p.nom)?.pieces ?? 0 })),
      contenance,
    );
    for (const r of calcul.repartition) aSortir.set(r.fournil, r.aSortir);
    const resume = formaterResumePlateaux(calcul);
    if (resume !== '') resumes.push(resume);
  }

  const bases: PartFournil[] = produits.map((p) => {
    const part = partDe.get(p.nom);
    return {
      produitId: p.id,
      nom: p.nom,
      commandeAuto: part?.pieces ?? 0,
      plateauCommandes: aSortir.get(p.nom) ?? part?.pieces ?? 0,
      detail: part?.detail ?? [],
    };
  });

  // Une journée passée est figée : l'historique garde ce qui avait été demandé.
  if (journee >= dateDuJour() && bases.length > 0) {
    const date = versDatePg(journee);
    const existants = await prisma.inventaire.findMany({
      where: { dateInventaire: date, produitId: { in: bases.map((b) => b.produitId) } },
      select: { produitId: true, commandeAuto: true, plateauCommandes: true },
    });
    const enBase = new Map(existants.map((e) => [e.produitId, e]));
    const ecritures = bases.flatMap((b) => {
      const avant = enBase.get(b.produitId);
      const rien = b.commandeAuto === 0 && b.plateauCommandes === 0;
      if (!avant && rien) return [];
      if (avant && (avant.commandeAuto ?? 0) === b.commandeAuto && (avant.plateauCommandes ?? 0) === b.plateauCommandes) return [];
      const donnees = { commandeAuto: b.commandeAuto, plateauCommandes: b.plateauCommandes };
      return [
        prisma.inventaire.upsert({
          where: { produitId_dateInventaire: { produitId: b.produitId, dateInventaire: date } },
          update: donnees,
          create: { produitId: b.produitId, dateInventaire: date, unite: 'piece', ...donnees },
          select: { id: true },
        }),
      ];
    });
    if (ecritures.length > 0) await prisma.$transaction(ecritures);
  }

  return { journee, bases, resumes };
}

/**
 * Après une écriture de commande : ne fait JAMAIS échouer la commande. Un
 * recalcul manqué est rattrapé à l'ouverture des prévisions ou de la feuille.
 */
export async function recalculerApresCommande(journees: readonly string[], route: string): Promise<void> {
  for (const journee of new Set(journees)) {
    try {
      await recalculerPartCommandee(journee);
    } catch (e) {
      journaliser({
        niveau: 'erreur',
        code: 'ERR_INATTENDUE',
        route,
        piste: `Part des commandes non recalculée pour le ${journee} (commande enregistrée) : rattrapée à la prochaine ouverture de la feuille.`,
        detail: e,
      });
    }
  }
}
