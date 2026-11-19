// src/lib/commandesDuJour.ts
//
// Ce que le manager lit en tête des prévisions : les commandes de la journée,
// regroupées. Mise en mots seulement — aucune règle métier, aucun prix.
//
// Un gâteau vendu PAR PERSONNE ne s'additionne jamais en pièces (propriétaire,
// 19/11/2026) : deux Bavarois de 10 et 12 personnes sont deux gâteaux, pas
// « 22 × Bavarois ». La lecture de la quantité est celle du bon
// (`lectureQuantite`, d'après la donnée du tarif, jamais d'après le nom).

import type { LigneCommande } from './commandes.ts';
import { formaterLigneTicket, lectureQuantite } from './ticketCanvas.ts';
import { formaterQuantite } from '../domaine/unites.ts';

export type LigneDuJour = {
  /** « 6 × », « 1,250 kg », « 1 gâteau », « 2 gâteaux ». */
  quantite: string;
  /** « Crêpe facie poulet », « Bavarois — 10 personnes ». */
  libelle: string;
};

export function resumeCommandesDuJour(commandes: readonly { lignes: readonly LigneCommande[] }[]): LigneDuJour[] {
  type Groupe = { sorte: 'piece' | 'kg' | 'gateau' | 'supplement'; nom: string; personnes: number; total: number; gateaux: number };
  const groupes = new Map<string, Groupe>();

  for (const commande of commandes) {
    for (const ligne of commande.lignes) {
      const lecture = lectureQuantite(ligne);
      // Le nom du bon (« Fraisier » pour un Bavarois goût Fraisier), sinon le goût entre parenthèses.
      const surLeBon = formaterLigneTicket(ligne, 'MAGASIN');
      const gouts = (ligne.gouts ?? []).map((g) => g.trim()).filter(Boolean);
      if (lecture === 'gateau-par-personne') {
        const nom = surLeBon.gouts && gouts.length > 0 ? `${surLeBon.libelle} (${gouts.join(' · ')})` : surLeBon.libelle;
        const cle = `gateau|${nom}|${ligne.quantite}`;
        const g = groupes.get(cle) ?? { sorte: 'gateau', nom, personnes: ligne.quantite, total: 0, gateaux: 0 };
        g.gateaux += 1;
        groupes.set(cle, g);
        continue;
      }
      const sorte = lecture === 'kg' ? 'kg' : lecture === 'supplement-par-personne' ? 'supplement' : 'piece';
      const cle = `${sorte}|${surLeBon.libelle}`;
      const g = groupes.get(cle) ?? { sorte, nom: surLeBon.libelle, personnes: 0, total: 0, gateaux: 0 };
      g.total += ligne.quantite;
      groupes.set(cle, g);
    }
  }

  return [...groupes.values()].map((g) => {
    if (g.sorte === 'gateau') {
      const personnes = `${formaterQuantite('piece', g.personnes)} personnes`;
      return g.gateaux === 1
        ? { quantite: '1 gâteau', libelle: `${g.nom} — ${personnes}` }
        : { quantite: `${g.gateaux} gâteaux`, libelle: `${g.nom} — ${personnes} chacun` };
    }
    if (g.sorte === 'kg') return { quantite: formaterQuantite('kg', g.total), libelle: g.nom };
    if (g.sorte === 'supplement') return { quantite: '', libelle: `${g.nom} — ${formaterQuantite('piece', g.total)} personnes` };
    return { quantite: `${formaterQuantite('piece', g.total)} ×`, libelle: g.nom };
  });
}
