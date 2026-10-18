// node --test src/domaine/prixComptoir.test.ts
//
// R60 — gâteau sur commande vendu au prix du COMPTOIR dans les tailles qui
// existent au comptoir (décision du propriétaire du 18/10/2026).
// Sur le VRAI catalogue (data/) : aucun prix écrit en dur (LOI 1), tout est lu
// par l'API du catalogue.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogueDepuisDossier } from '../catalogue/chargerFichiers.ts';
import { creerApiCatalogue } from '../catalogue/catalogue.ts';
import {
  CORRESPONDANCES_COMPTOIR,
  clesCorrespondances,
  controlerCorrespondancesComptoir,
  type FicheCorrespondance,
} from '../catalogue/correspondancesComptoir.ts';

import { multiplier } from './argent.ts';
import type { JourFerme } from './calendrier.ts';
import { DELAIS_PAR_DEFAUT, REGLEMENT_COMMANDE } from './constantes.ts';
import {
  controlerCommande,
  controlerLigne,
  resoudreDepuisCatalogue,
  type CommandeSaisie,
  type ContexteCommande,
  type LigneSaisie,
} from './commande.ts';
import { gateauSurCommandeDe, produitComptoirPourTaille, validerPrixComptoir } from './prixComptoir.ts';
import type { FicheTarifee } from './types.ts';

const charge = chargerCatalogueDepuisDossier();
const api = creerApiCatalogue(charge.catalogue);
const resoudre = resoudreDepuisCatalogue(api);

const PRISE = '2026-10-15'; // jeudi
const RETRAIT = '2026-10-30'; // vendredi
const FERMES: JourFerme[] = [{ id: 1, nature: 'hebdomadaire', jourSemaineIso: 2, libelle: 'mardi' }];
const GERANT = { par: 'Karim', le: '2026-10-15T10:00:00Z' };
const TAILLES = REGLEMENT_COMMANDE.taillesGateau;

const ID = {
  bavarois: 'gateaux-sur-commande/bavarois',
  creme: 'gateaux-sur-commande/creme-fraiche',
  bavarois6p: 'gateaux-et-tartes/bavarois/6p',
  bavarois10p: 'gateaux-et-tartes/bavarois/10p',
  creme8p: 'gateaux-et-tartes/creme-fraiche/8p',
  photo: 'gateaux-sur-commande/supplement-photo',
  ecriture: 'gateaux-sur-commande/supplement-ecriture-simple',
};

const ctx: ContexteCommande = {
  resoudre,
  joursFermes: FERMES,
  delais: DELAIS_PAR_DEFAUT,
  reglement: { ...REGLEMENT_COMMANDE, acomptePourcentageMin: 0 },
  correspondancesComptoir: CORRESPONDANCES_COMPTOIR,
};

function fiche(id: string): FicheTarifee {
  const r = resoudre(id, PRISE);
  assert.ok(r.ok, `${id} introuvable au catalogue`);
  return r.donnees;
}
const prixDe = (id: string) => fiche(id).prix.prixCentimes;

function commande(lignes: LigneSaisie[], extra: Partial<CommandeSaisie> = {}): CommandeSaisie {
  return {
    client: 'Dupont',
    telephone: '0470 12 34 56',
    datePrise: PRISE,
    heurePrise: '10:15',
    dateRetrait: RETRAIT,
    heureRetrait: '14:00',
    lignes,
    ...extra,
  };
}

/** Lecture du catalogue pour le contrôle des correspondances (comme le serveur, en base). */
function lireCatalogue(cle: string): FicheCorrespondance | null {
  const p = api.getProduit(cle);
  if (!p.ok) return null;
  const x = api.getPrix(cle, PRISE);
  return { produit: p.donnees, prix: x.ok ? x.donnees : null };
}

// ------------------------------------------------------------ la donnée

test('correspondances : valides sur le vrai catalogue (clés, régimes, tailles standard)', () => {
  assert.equal(charge.ok, true);
  assert.deepEqual(controlerCorrespondancesComptoir(CORRESPONDANCES_COMPTOIR, lireCatalogue, TAILLES), []);
  assert.ok(clesCorrespondances(CORRESPONDANCES_COMPTOIR).includes(ID.bavarois6p));
});

test('correspondance vers une clé du comptoir inexistante : refusée, message clair', () => {
  const e = controlerCorrespondancesComptoir(
    [{ surCommande: ID.bavarois, parts: 6, comptoir: 'gateaux-et-tartes/bavarois/6-parts' }],
    lireCatalogue,
    TAILLES,
  );
  assert.equal(e.length, 1);
  assert.match(e[0], /produit du comptoir est inconnu du catalogue/);
});

test('correspondance invalide : régime ≠ A, gâteau d’origine pas en régime C, taille hors standard, doublon', () => {
  // Vers un produit sur commande (régime C) au lieu du comptoir.
  const regime = controlerCorrespondancesComptoir([{ surCommande: ID.bavarois, parts: 6, comptoir: ID.creme }], lireCatalogue, TAILLES);
  assert.ok(regime.some((m) => /n’est pas un produit du comptoir vendu à la pièce/.test(m)));
  // Origine = produit du comptoir.
  const origine = controlerCorrespondancesComptoir([{ surCommande: ID.bavarois10p, parts: 6, comptoir: ID.bavarois6p }], lireCatalogue, TAILLES);
  assert.ok(origine.some((m) => /n’est pas un gâteau sur commande au prix par personne/.test(m)));
  // 7 parts : hors des tailles standard.
  const taille = controlerCorrespondancesComptoir([{ surCommande: ID.bavarois, parts: 7, comptoir: ID.bavarois6p }], lireCatalogue, TAILLES);
  assert.ok(taille.some((m) => /7 parts n’est pas une taille standard/.test(m)));
  // Gâteau sur commande inconnu.
  const inconnu = controlerCorrespondancesComptoir([{ surCommande: 'gateaux-sur-commande/xyz', parts: 6, comptoir: ID.bavarois6p }], lireCatalogue, TAILLES);
  assert.ok(inconnu.some((m) => /gâteau sur commande est inconnu/.test(m)));
  // Même taille deux fois.
  const doublon = controlerCorrespondancesComptoir(
    [
      { surCommande: ID.bavarois, parts: 6, comptoir: ID.bavarois6p },
      { surCommande: ID.bavarois, parts: 6, comptoir: ID.bavarois10p },
    ],
    lireCatalogue,
    TAILLES,
  );
  assert.ok(doublon.some((m) => /déjà associée/.test(m)));
});

// ------------------------------------------------------------ fonctions pures

test('produitComptoirPourTaille : bavarois 6 → comptoir 6P ; crème fraîche 4 → aucun ; crème fraîche 8 → 8P', () => {
  const t = CORRESPONDANCES_COMPTOIR;
  assert.equal(produitComptoirPourTaille(ID.bavarois, 6, t), ID.bavarois6p);
  assert.equal(produitComptoirPourTaille(ID.bavarois, 10, t), ID.bavarois10p);
  assert.equal(produitComptoirPourTaille(ID.bavarois, 15, t), null, 'pas de 15P au comptoir');
  assert.equal(produitComptoirPourTaille(ID.creme, 4, t), null, 'pas de crème fraîche 4P au comptoir');
  assert.equal(produitComptoirPourTaille(ID.creme, 8, t), ID.creme8p);
  assert.equal(produitComptoirPourTaille(null, 6, t), null);
  assert.equal(produitComptoirPourTaille(ID.bavarois, null, t), null);
  assert.equal(produitComptoirPourTaille(ID.bavarois, 6, []), null, 'table vide : règle sans objet');
  assert.deepEqual(gateauSurCommandeDe(ID.creme8p, t), { surCommande: ID.creme, parts: 8 });
  assert.equal(gateauSurCommandeDe(ID.photo, t), null);
});

test('validerPrixComptoir : bloquant avec la clé du comptoir proposée ; sans équivalent : accepté', () => {
  const r = validerPrixComptoir(fiche(ID.bavarois), 6, CORRESPONDANCES_COMPTOIR);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_PRIX_COMPTOIR');
    assert.equal(r.niveau, 'bloquant');
    assert.equal(r.valeurProposee, ID.bavarois6p);
    assert.match(r.message, /« Bavarois » en 6 parts existe au comptoir/);
  }
  assert.ok(validerPrixComptoir(fiche(ID.creme), 4, CORRESPONDANCES_COMPTOIR).ok);
  assert.ok(validerPrixComptoir(fiche(ID.bavarois), 20, CORRESPONDANCES_COMPTOIR).ok);
});

// ------------------------------------------------------------ lignes

test('bavarois 6 parts = la ligne du comptoir 6P, au prix du catalogue (quantité 1)', () => {
  const surCommande = controlerLigne({ produitId: ID.bavarois, quantite: 6 }, 0, PRISE, ctx);
  assert.equal(surCommande.ok, false);
  if (!surCommande.ok) {
    assert.equal(surCommande.code, 'ERR_PRIX_COMPTOIR');
    assert.equal(surCommande.champ, 'lignes[0].quantite');
  }
  const r = controlerLigne({ produitId: ID.bavarois6p, quantite: 1, prixUnitaireCentimes: prixDe(ID.bavarois6p) }, 0, PRISE, ctx);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.donnees.regimePrix, 'A');
  assert.equal(r.donnees.totalCentimes, prixDe(ID.bavarois6p));
  assert.equal(r.donnees.libelle, 'Bavarois 6P', 'libellé du catalogue à la lettre (LOI 5)');
  assert.notEqual(r.donnees.totalCentimes, multiplier(6, prixDe(ID.bavarois)), 'pas 6 × prix par personne');
});

test('crème fraîche 4 parts = régime C, 4 × prix par personne (pas de 4P au comptoir)', () => {
  const r = controlerLigne({ produitId: ID.creme, quantite: 4 }, 0, PRISE, ctx);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.donnees.regimePrix, 'C');
  assert.equal(r.donnees.totalCentimes, multiplier(4, prixDe(ID.creme)));
});

test('crème fraîche 8 parts = comptoir 8P au prix du catalogue', () => {
  const c = controlerLigne({ produitId: ID.creme, quantite: 8 }, 0, PRISE, ctx);
  assert.equal(c.ok, false);
  if (!c.ok) assert.equal(c.valeurProposee, ID.creme8p);
  const r = controlerLigne({ produitId: ID.creme8p, quantite: 1, prixUnitaireCentimes: prixDe(ID.creme8p) }, 0, PRISE, ctx);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.donnees.totalCentimes, prixDe(ID.creme8p));
});

test('prix du comptoir jamais modifiable : en dessous, au-dessus, même avec le gérant → ERR_TARIF_INCOHERENT', () => {
  const prix = prixDe(ID.bavarois6p);
  for (const autre of [prix - 1, prix + 500]) {
    for (const deverrouillage of [undefined, GERANT]) {
      const r = controlerLigne({ produitId: ID.bavarois6p, quantite: 1, prixUnitaireCentimes: autre, deverrouillage }, 0, PRISE, ctx);
      assert.equal(r.ok, false);
      if (!r.ok) {
        assert.equal(r.code, 'ERR_TARIF_INCOHERENT');
        assert.equal(r.valeurProposee, prix);
      }
    }
  }
});

// ------------------------------------------------------------ la commande (rejouée telle quelle au serveur)

test('bavarois du comptoir + photo + écriture : suppléments acceptés, total = somme du catalogue', () => {
  const lignes: LigneSaisie[] = [
    { produitId: ID.bavarois6p, quantite: 1, prixUnitaireCentimes: prixDe(ID.bavarois6p) },
    { produitId: ID.photo, quantite: 1, prixUnitaireCentimes: prixDe(ID.photo) },
    { produitId: ID.ecriture, quantite: 1, prixUnitaireCentimes: prixDe(ID.ecriture) },
  ];
  const r = controlerCommande(commande(lignes, { texteGateau: 'Joyeux anniversaire' }), ctx);
  assert.ok(r.ok, r.ok ? '' : r.message);
  if (!r.ok) return;
  assert.equal(r.donnees.totalCentimes, prixDe(ID.bavarois6p) + prixDe(ID.photo) + prixDe(ID.ecriture));
  assert.equal(r.donnees.delaiJoursOuvres, 0, 'même délai que le gâteau simple sur commande');
  // Deux photos pour un seul gâteau : refusé comme pour tout gâteau.
  const deux = controlerCommande(
    commande([lignes[0], { produitId: ID.photo, quantite: 2, prixUnitaireCentimes: prixDe(ID.photo) }], { sansEcriture: true }),
    ctx,
  );
  assert.equal(deux.ok, false);
  if (!deux.ok) assert.equal(deux.code, 'ERR_SUPPLEMENT_TROP_NOMBREUX');
});

test('le gâteau du comptoir qui remplace un gâteau commandé reste un gâteau : écriture demandée', () => {
  const r = controlerCommande(commande([{ produitId: ID.bavarois6p, quantite: 1, prixUnitaireCentimes: prixDe(ID.bavarois6p) }]), ctx);
  assert.ok(r.ok);
  if (r.ok) assert.ok(r.signalements.some((s) => s.code === 'AVERT_ECRITURE_NON_PRECISEE'));
});

test('rejeu : une commande au prix par personne dans une taille du comptoir (tablette pas à jour) est refusée', () => {
  const r = controlerCommande(commande([{ produitId: ID.bavarois, quantite: 8, prixUnitaireCentimes: prixDe(ID.bavarois) }], { sansEcriture: true }), ctx);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_PRIX_COMPTOIR');
    assert.equal(r.valeurProposee, 'gateaux-et-tartes/bavarois/8p');
  }
  // Même avec un accord de prix du gérant : la taille du comptoir impose le comptoir.
  const g = controlerCommande(
    commande([{ produitId: ID.bavarois, quantite: 8, prixUnitaireCentimes: prixDe(ID.bavarois) + 100, deverrouillage: GERANT }], { sansEcriture: true }),
    ctx,
  );
  assert.equal(g.ok, false);
});

test('n’interdit pas : bavarois 15 parts au prix par personne, au-dessus du plancher', () => {
  const r = controlerLigne({ produitId: ID.bavarois, quantite: 15, prixUnitaireCentimes: prixDe(ID.bavarois) + 50 }, 0, PRISE, ctx);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.donnees.totalCentimes, multiplier(15, prixDe(ID.bavarois) + 50));
});
