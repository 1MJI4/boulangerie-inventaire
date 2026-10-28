// node --test src/domaine/metier.test.ts
//
// Règles de commande sur le VRAI catalogue (data/), lu par l'API du module
// catalogue : aucun prix écrit en dur dans ce test (LOI 1). Les règles du
// domaine n'importent pas le catalogue ; seul ce test le charge, pour prouver
// que `Produit` / `PrixEnVigueur` se branchent tels quels.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogueDepuisDossier } from '../catalogue/chargerFichiers.ts';
import { creerApiCatalogue } from '../catalogue/catalogue.ts';
import { CORRESPONDANCES_COMPTOIR } from '../catalogue/correspondancesComptoir.ts';

import { multiplier, prixAuPoids } from './argent.ts';
import type { JourFerme } from './calendrier.ts';
import { DELAIS_PAR_DEFAUT, REGLEMENT_COMMANDE } from './constantes.ts';
import {
  blocagesCommande,
  controlerCommande,
  controlerLigne,
  resoudreDepuisCatalogue,
  type CommandeSaisie,
  type ContexteCommande,
  type LigneSaisie,
} from './commande.ts';
import { GOUT_AU_CHOIX } from './gouts.ts';
import { GOUTS_SUR_COMMANDE } from '../catalogue/goutsSurCommande.ts';
import { compterSymboles, taillesAPartirDuMinimum, taillesProches, validerMaximum, validerQuantiteMin, validerTailleGateau } from './minimums.ts';
import { prixLigne, validerPrixParPersonne } from './regimes.ts';
import type { FicheTarifee } from './types.ts';

const charge = chargerCatalogueDepuisDossier();
const api = creerApiCatalogue(charge.catalogue);
const resoudre = resoudreDepuisCatalogue(api);

const PRISE = '2026-10-15'; // jeudi
const RETRAIT = '2026-10-30'; // vendredi, loin de tout délai
const FERMES: JourFerme[] = [{ id: 1, nature: 'hebdomadaire', jourSemaineIso: 2, libelle: 'mardi' }];
const GERANT = { par: 'Karim', le: '2026-10-15T10:00:00Z' };

const ID = {
  layer: 'gateaux-sur-commande/layer-cake',
  number: 'gateaux-sur-commande/number-cake',
  mariage: 'gateaux-sur-commande/gateau-de-mariage',
  pieceMontee: 'gateaux-sur-commande/piece-montee',
  bavaroisC: 'gateaux-sur-commande/bavarois',
  bavarois6pComptoir: 'gateaux-et-tartes/bavarois/6p',
  photo: 'gateaux-sur-commande/supplement-photo',
  ecriture: 'gateaux-sur-commande/supplement-ecriture-simple',
  miniBurger: 'sur-commande/mini-burger',
  miniTartelette: 'gateaux-sur-commande/mini-tartelette',
  painSurprise: 'sur-commande/grand-pain-surprise',
  halwa: 'oriental/halwa-arbia',
  baguette: 'boulangerie/baguette/grise',
};

function fiche(id: string, date = PRISE): FicheTarifee {
  const r = resoudre(id, date);
  assert.ok(r.ok, `${id} introuvable au catalogue`);
  return r.donnees;
}

// Les tests de minimums, prix et délais isolent leur règle : acompte minimum à 0 %
// ici. Le règlement réel (50 %) est prouvé par `ctxReglement` plus bas.
const ctx: ContexteCommande = {
  resoudre,
  joursFermes: FERMES,
  delais: DELAIS_PAR_DEFAUT,
  reglement: { ...REGLEMENT_COMMANDE, acomptePourcentageMin: 0 },
  correspondancesComptoir: CORRESPONDANCES_COMPTOIR,
};
const ctxReglement: ContexteCommande = { ...ctx, reglement: REGLEMENT_COMMANDE };
// Délai d'un gâteau à étages : RÉGLAGE du gérant (0 par défaut, 18/10/2026).
// Valeur de TEST, comme si le gérant avait réglé 5 jours ouvrés.
const DELAI_ETAGES_TEST = 5;
const ctxEtages: ContexteCommande = { ...ctx, delais: { ...DELAIS_PAR_DEFAUT, gateauAEtages: DELAI_ETAGES_TEST } };

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

test('le catalogue se charge (pré-requis de ce fichier)', () => {
  assert.equal(charge.ok, true);
});

// ---------------------------------------------------------------- minimums

test('Layer Cake : 12 parts refusées, sortie « passer à 20 parts »', () => {
  const r = validerQuantiteMin(fiche(ID.layer), 12);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_QUANTITE_MIN');
    assert.equal(r.niveau, 'bloquant');
    assert.equal(r.valeurProposee, 20);
    assert.match(r.message, /Minimum 20 parts pour « Layer Cake »/);
  }
  assert.equal(validerQuantiteMin(fiche(ID.layer), 20).ok, true);
});

test('Number Cake « 25 » = 2 symboles × 15 = 30 parts : 20 parts REFUSÉES', () => {
  assert.equal(compterSymboles('25'), 2);
  const r = validerQuantiteMin(fiche(ID.number), 20, { nbSymboles: compterSymboles('25') });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.valeurProposee, 30);
    assert.match(r.message, /Minimum 30 parts/);
  }
  assert.equal(validerQuantiteMin(fiche(ID.number), 30, { nbSymboles: 2 }).ok, true);
});

test('Number Cake sans nombre de symboles → ERR_NB_SYMBOLES_MANQUANT', () => {
  for (const nb of [undefined, 0, -1, 1.5]) {
    const r = validerQuantiteMin(fiche(ID.number), 100, { nbSymboles: nb });
    assert.equal(r.ok, false, String(nb));
    if (!r.ok) assert.equal(r.code, 'ERR_NB_SYMBOLES_MANQUANT');
  }
});

test('HYPOTHÈSE symboles : « 18+ » compte 3 symboles (le plus exigeant)', () => {
  assert.equal(compterSymboles('18+'), 3);
  assert.equal(compterSymboles(' 1 8 '), 2);
});

test('seuils distincts, non unifiés : mini burger 10 pièces, mini tartelette 15, mariage 40, pièce montée 60', () => {
  const cas: [string, number, string][] = [
    [ID.miniBurger, 10, 'pièces'],
    [ID.miniTartelette, 15, 'pièces'],
    [ID.mariage, 40, 'parts'],
    [ID.pieceMontee, 60, 'parts'],
  ];
  for (const [id, min, unite] of cas) {
    const r = validerQuantiteMin(fiche(id), min - 1);
    assert.equal(r.ok, false, id);
    if (!r.ok) {
      assert.equal(r.valeurProposee, min, id);
      assert.match(r.message, new RegExp(`Minimum ${min} ${unite}`), id);
    }
    assert.equal(validerQuantiteMin(fiche(id), min).ok, true, id);
  }
});

test('produit sans minimum : toute quantité > 0 passe (pas de minimum inventé)', () => {
  assert.equal(validerQuantiteMin(fiche(ID.bavaroisC), 4).ok, true);
  assert.equal(validerQuantiteMin(fiche(ID.baguette), 1).ok, true);
});

test('pain surprise : 21 sandwichs → AVERTISSEMENT accepté, « ajouter un 2e pain » (2 pains proposés)', () => {
  const r = validerMaximum(fiche(ID.painSurprise), 1, 21);
  assert.ok(r.ok);
  assert.equal(r.signalements[0]?.code, 'AVERT_PAIN_SUPPLEMENTAIRE');
  assert.equal(r.signalements[0]?.valeurProposee, 2);
  const ok = validerMaximum(fiche(ID.painSurprise), 2, 40);
  assert.ok(ok.ok);
  assert.equal(ok.signalements.length, 0);
});

// ---------------------------------------------------------------- régimes

test('régime C : prix par personne pré-rempli au plancher, total = parts × prix/pers.', () => {
  const f = fiche(ID.bavaroisC);
  const r = prixLigne(f, 6);
  assert.ok(r.ok);
  assert.equal(r.donnees.regimePrix, 'C');
  assert.equal(r.donnees.prixUnitaireCentimes, f.prix.prixCentimes);
  assert.equal(r.donnees.totalCentimes, multiplier(6, f.prix.prixCentimes));
});

test('régime A vs C : même nom « Bavarois », deux prix construits différemment (régime lu, pas déduit)', () => {
  const comptoir = fiche(ID.bavarois6pComptoir);
  const commandeC = fiche(ID.bavaroisC);
  assert.equal(comptoir.produit.regimePrix, 'A');
  assert.equal(commandeC.produit.regimePrix, 'C');
  const a = prixLigne(comptoir, 1);
  const c = prixLigne(commandeC, 6);
  assert.ok(a.ok && c.ok);
  assert.equal(a.donnees.totalCentimes, comptoir.prix.prixCentimes, '6P comptoir = prix fixe du catalogue');
  assert.equal(c.donnees.totalCentimes, multiplier(6, commandeC.prix.prixCentimes));
});

test('régime C : prix modifiable vers le HAUT', () => {
  const f = fiche(ID.layer);
  const plus = f.prix.prixCentimes + 100;
  const r = prixLigne(f, 20, { prixParPersonneCentimes: plus });
  assert.ok(r.ok);
  assert.equal(r.donnees.totalCentimes, multiplier(20, plus));
});

test('régime C : sous le plancher → ERR_SOUS_PLANCHER, plancher proposé', () => {
  const f = fiche(ID.layer);
  const r = validerPrixParPersonne(f, f.prix.prixCentimes - 1);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_SOUS_PLANCHER');
    assert.equal(r.valeurProposee, f.prix.prixCentimes);
  }
});

test('régime C : sous le plancher avec déverrouillage gérant → accepté, tracé ; 0 € toujours refusé', () => {
  const f = fiche(ID.layer);
  const sous = f.prix.prixCentimes - 50;
  const r = prixLigne(f, 20, { prixParPersonneCentimes: sous, deverrouillage: GERANT });
  assert.ok(r.ok);
  assert.deepEqual(r.donnees.sousPlancher, GERANT);
  assert.equal(r.signalements[0]?.code, 'AVERT_SOUS_PLANCHER_AUTORISE');
  assert.equal(validerPrixParPersonne(f, 0, GERANT).ok, false);
  assert.equal(validerPrixParPersonne(f, sous, { par: '', le: GERANT.le }).ok, false, 'accord sans nom');
});

test('régime A au kilo : 750 g de Halwa arbia = poids × prix/kg, arrondi half-up', () => {
  const f = fiche(ID.halwa);
  assert.equal(f.produit.unite, 'kg');
  const r = prixLigne(f, 750);
  assert.ok(r.ok);
  assert.equal(r.donnees.totalCentimes, prixAuPoids(750, f.prix.prixCentimes));
  assert.equal(r.donnees.totalCentimes * 4, f.prix.prixCentimes * 3, '0,750 kg = trois quarts du prix au kilo, exactement');
});

test('unité incohérente (produit kg avec prix à la pièce) → ERR_UNITE_INCOHERENTE', () => {
  const f = fiche(ID.halwa);
  const r = prixLigne({ produit: f.produit, prix: { ...f.prix, basePrix: 'piece' } }, 750);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'ERR_UNITE_INCOHERENTE');
});

test('produit sans régime → refusé (jamais deviné)', () => {
  const f = fiche(ID.baguette);
  const r = prixLigne({ produit: { ...f.produit, regimePrix: null }, prix: f.prix }, 1);
  assert.equal(r.ok, false);
});

// ---------------------------------------------------------------- lignes

test('ligne sans produit → ERR_LIGNE_SANS_PRODUIT, sortie « supprimer la ligne »', () => {
  const r = controlerLigne({ produitId: '', libelle: '  ', quantite: 1 }, 3, PRISE, ctx);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_LIGNE_SANS_PRODUIT');
    assert.equal(r.valeurProposee, 3);
    assert.equal(r.champ, 'lignes[3].produitId');
  }
});

test('ligne : quantité nulle, négative, vide ou décimale → bloquant ; poids kg à 0 → bloquant', () => {
  for (const [id, q] of [[ID.baguette, 0], [ID.baguette, -1], [ID.baguette, Number.NaN], [ID.baguette, 1.5], [ID.halwa, 0]] as const) {
    const r = controlerLigne({ produitId: id, quantite: q }, 0, PRISE, ctx);
    assert.equal(r.ok, false, `${id} ${q}`);
    if (!r.ok) {
      assert.equal(r.code, 'ERR_QUANTITE_INVALIDE');
      assert.equal(r.champ, 'lignes[0].quantite');
    }
  }
});

test('ligne : produit inconnu → ERR_PRODUIT_INCONNU ; pas de tarif à la date → ERR_TARIF_ABSENT', () => {
  const r = controlerLigne({ produitId: 'n-existe/pas', quantite: 1 }, 0, PRISE, ctx);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'ERR_PRODUIT_INCONNU');
  const avant = controlerLigne({ produitId: ID.layer, quantite: 20 }, 0, '2026-01-01', ctx);
  assert.equal(avant.ok, false);
  if (!avant.ok) assert.equal(avant.code, 'ERR_TARIF_ABSENT');
});

test('ligne A/B : prix affiché ≠ catalogue → ERR_TARIF_INCOHERENT (jamais corrigé en silence)', () => {
  const f = fiche(ID.miniBurger);
  const r = controlerLigne({ produitId: ID.miniBurger, quantite: 10, prixUnitaireCentimes: f.prix.prixCentimes - 10 }, 0, PRISE, ctx);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_TARIF_INCOHERENT');
    assert.equal(r.valeurProposee, f.prix.prixCentimes);
  }
  assert.equal(controlerLigne({ produitId: ID.miniBurger, quantite: 10, prixUnitaireCentimes: f.prix.prixCentimes }, 0, PRISE, ctx).ok, true);
});

test('ligne : 9 mini burgers → ERR_QUANTITE_MIN à la saisie de la ligne', () => {
  const r = controlerLigne({ produitId: ID.miniBurger, quantite: 9 }, 1, PRISE, ctx);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_QUANTITE_MIN');
    assert.equal(r.valeurProposee, 10);
    assert.equal(r.champ, 'lignes[1].quantite');
  }
});

test('ligne libre : prix fixé avec le gérant obligatoire, prix > 0', () => {
  const montant = multiplier(50, 100); // montant de test, hors catalogue
  const sans = controlerLigne({ libelle: 'Plateau spécial', gateauLibre: false, quantite: 1, prixUnitaireCentimes: montant }, 0, PRISE, ctx);
  assert.equal(sans.ok, false);
  if (!sans.ok) assert.equal(sans.code, 'ERR_DROIT_INSUFFISANT');
  const nul = controlerLigne({ libelle: 'Plateau spécial', gateauLibre: false, quantite: 1, prixUnitaireCentimes: 0, deverrouillage: GERANT }, 0, PRISE, ctx);
  assert.equal(nul.ok, false);
  if (!nul.ok) assert.equal(nul.code, 'ERR_MONTANT_NUL');
  const ok = controlerLigne({ libelle: 'Plateau spécial', gateauLibre: false, quantite: 2, prixUnitaireCentimes: montant, deverrouillage: GERANT }, 0, PRISE, ctx);
  assert.ok(ok.ok);
  assert.equal(ok.donnees.totalCentimes, multiplier(2, montant));
  assert.deepEqual(ok.donnees.autorisation, GERANT);
});

// ---------------------------------------------------------------- commande

test('40 parts de mariage + photo : le supplément s’ajoute UNE fois, pas par personne', () => {
  const mariage = fiche(ID.mariage);
  const photo = fiche(ID.photo);
  const r = controlerCommande(
    commande([
      { produitId: ID.mariage, quantite: 40 },
      { produitId: ID.photo, quantite: 1 },
    ], { texteGateau: 'Félicitations' }),
    ctx,
  );
  assert.ok(r.ok, JSON.stringify(r));
  const attendu = multiplier(40, mariage.prix.prixCentimes) + photo.prix.prixCentimes;
  assert.equal(r.donnees.totalCentimes, attendu);
  assert.notEqual(r.donnees.totalCentimes, multiplier(40, mariage.prix.prixCentimes) + multiplier(40, photo.prix.prixCentimes));
  assert.equal(r.donnees.lignes[1].libelle, 'Supplément Photo', 'libellé du catalogue à la lettre');
});

test('R7 qa : Layer Cake 40 parts + Photo ×40 → ERR_SUPPLEMENT_TROP_NOMBREUX, 1 proposé', () => {
  const lignes: LigneSaisie[] = [
    { produitId: ID.layer, quantite: 40 },
    { produitId: ID.photo, quantite: 40 },
  ];
  const r = controlerCommande(commande(lignes, { sansEcriture: true }), ctx);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_SUPPLEMENT_TROP_NOMBREUX');
    assert.equal(r.niveau, 'bloquant');
    assert.equal(r.champ, 'lignes[1].quantite');
    assert.equal(r.valeurProposee, 1);
  }
  lignes[1] = { produitId: ID.photo, quantite: 1 };
  assert.ok(controlerCommande(commande(lignes, { sansEcriture: true }), ctx).ok, 'sortie en un geste : 1 photo');
});

test('R7 : Photo seule (aucun gâteau) → ERR_SUPPLEMENT_SANS_GATEAU, sortie supprimer la ligne', () => {
  const r = controlerCommande(
    commande([{ produitId: ID.baguette, quantite: 30 }, { produitId: ID.photo, quantite: 1 }]),
    ctx,
  );
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_SUPPLEMENT_SANS_GATEAU');
    assert.equal(r.champ, 'lignes[1].produitId');
    assert.equal(r.valeurProposee, 1, 'index de la ligne à supprimer');
  }
});

test('R7 : deux gâteaux → deux photos permises, Photo + Écriture sur un même gâteau permises', () => {
  const deux = controlerCommande(
    commande([
      { produitId: ID.layer, quantite: 20 },
      { produitId: ID.bavaroisC, quantite: 20 },
      { produitId: ID.photo, quantite: 2 },
    ], { sansEcriture: true }),
    ctx,
  );
  assert.ok(deux.ok, JSON.stringify(deux));
  const trois = blocagesCommande(
    commande([
      { produitId: ID.layer, quantite: 20 },
      { produitId: ID.photo, quantite: 2 },
      { produitId: ID.photo, quantite: 1 },
    ], { sansEcriture: true }),
    ctx,
  );
  assert.deepEqual(trois.map((b) => [b.code, b.champ, b.valeurProposee]), [
    ['ERR_SUPPLEMENT_TROP_NOMBREUX', 'lignes[1].quantite', 1],
    ['ERR_SUPPLEMENT_TROP_NOMBREUX', 'lignes[2].quantite', 0],
  ]);
  const photoEtEcriture = controlerCommande(
    commande([
      { produitId: ID.layer, quantite: 20 },
      { produitId: ID.photo, quantite: 1 },
      { produitId: ID.ecriture, quantite: 1 },
    ], { texteGateau: 'Joyeux anniversaire' }),
    ctx,
  );
  assert.ok(photoEtEcriture.ok, JSON.stringify(photoEtEcriture));
});

test('R7 : gâteaux du comptoir (A, famille gâteau) = un par LIGNE ; kilo et salé = aucun', () => {
  // Une ligne par gâteau (28/10/2026) : deux Bavarois 6P = deux lignes, deux photos possibles.
  const ok = controlerCommande(
    commande([
      { produitId: ID.bavarois6pComptoir, quantite: 1 },
      { produitId: ID.bavarois6pComptoir, quantite: 1 },
      { produitId: ID.photo, quantite: 2 },
    ], { sansEcriture: true }),
    ctx,
  );
  assert.ok(ok.ok, JSON.stringify(ok));
  assert.ok(!ok.signalements.some((s) => s.code === 'AVERT_PRODUIT_EN_DOUBLE'), 'deux gâteaux, jamais « à fusionner »');
  const r = controlerCommande(
    commande([
      { produitId: ID.halwa, quantite: 1000 },
      { produitId: ID.miniBurger, quantite: 10 },
      { produitId: ID.photo, quantite: 1 },
    ]),
    ctx,
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'ERR_SUPPLEMENT_SANS_GATEAU');
});

test('R7 : la règle ne masque pas un gâteau refusé (minimum) par un faux « sans gâteau »', () => {
  const r = controlerCommande(
    commande([{ produitId: ID.layer, quantite: 12 }, { produitId: ID.photo, quantite: 1 }], { sansEcriture: true }),
    ctx,
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'ERR_QUANTITE_MIN');
});

test(
  'R7 : un supplément du COMPTOIR ne compte pas comme un gâteau',
  () => {
    const r = controlerCommande(
      commande([{ produitId: 'gateaux-et-tartes/supplement/photo', quantite: 1 }, { produitId: ID.photo, quantite: 1 }]),
      ctx,
    );
    assert.equal(r.ok, false);
  },
);

test('le total envoyé par la tablette n’est jamais cru : recalculé, et l’écart est refusé', () => {
  const layer = fiche(ID.layer);
  const juste = multiplier(20, layer.prix.prixCentimes);
  const plus = controlerCommande(commande([{ produitId: ID.layer, quantite: 20 }], { totalConvenuCentimes: juste + 123, sansEcriture: true }), ctx);
  assert.equal(plus.ok, false);
  if (!plus.ok) {
    assert.equal(plus.code, 'ERR_TOTAL_INCOHERENT');
    assert.equal(plus.valeurProposee, juste);
  }
  const moins = controlerCommande(commande([{ produitId: ID.layer, quantite: 20 }], { totalConvenuCentimes: juste - 123, sansEcriture: true }), ctx);
  assert.equal(moins.ok, false);
  if (!moins.ok) assert.equal(moins.code, 'ERR_REMISE_NON_AUTORISEE');
  const remise = controlerCommande(
    commande([{ produitId: ID.layer, quantite: 20 }], { totalConvenuCentimes: juste - 123, remise: GERANT, sansEcriture: true }),
    ctx,
  );
  assert.ok(remise.ok);
  assert.equal(remise.donnees.totalCentimes, juste - 123);
  assert.equal(remise.donnees.totalTarifCentimes, juste);
  assert.deepEqual(remise.donnees.remise, GERANT);
});

test('commande valide : lignes recalculées, reste dû, jour de production = veille ouvrée', () => {
  const halwa = fiche(ID.halwa);
  const r = controlerCommande(
    commande([{ produitId: ID.halwa, quantite: 750 }], { acompteCentimes: 123, dateRetrait: '2026-10-21' }),
    ctx,
  );
  assert.ok(r.ok, JSON.stringify(r));
  const total = prixAuPoids(750, halwa.prix.prixCentimes);
  assert.equal(r.donnees.totalCentimes, total);
  assert.equal(r.donnees.resteDuCentimes, total - 123);
  assert.equal(r.donnees.dateProduction, '2026-10-19', 'retrait mercredi → production lundi (mardi fermé)');
  assert.equal(r.donnees.lignes[0].unite, 'kg');
});

test('commande vide → ERR_COMMANDE_VIDE', () => {
  const r = controlerCommande(commande([]), ctx);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'ERR_COMMANDE_VIDE');
});

test('retrait un mardi → ERR_JOUR_FERME avec le mercredi proposé', () => {
  const r = controlerCommande(commande([{ produitId: ID.baguette, quantite: 30 }], { dateRetrait: '2026-10-27' }), ctx);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_JOUR_FERME');
    assert.equal(r.valeurProposee, '2026-10-28');
  }
});

test('délai : gâteau de mariage, délai réglé par le gérant (5 j), le plus long délai de la commande s’applique', () => {
  const saisie = commande([{ produitId: ID.baguette, quantite: 30 }, { produitId: ID.mariage, quantite: 40 }], {
    dateRetrait: '2026-10-19',
    sansEcriture: true,
  });
  // Sans réglage (défaut 0, décision du 18/10/2026) : accepté.
  assert.ok(controlerCommande(saisie, ctx).ok, 'aucun délai minimum par défaut');
  const r = controlerCommande(saisie, ctxEtages);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_DELAI_TROP_COURT');
    assert.equal(r.valeurProposee, '2026-10-21', 'ven 16, sam 17, dim 18, lun 19, (mar fermé), mer 21');
  }
});

test('acompte supérieur au total → ERR_ACOMPTE_SUPERIEUR_TOTAL avec le total proposé', () => {
  const b = fiche(ID.baguette);
  const total = multiplier(30, b.prix.prixCentimes);
  const r = controlerCommande(commande([{ produitId: ID.baguette, quantite: 30 }], { acompteCentimes: total + 1 }), ctx);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_ACOMPTE_SUPERIEUR_TOTAL');
    assert.equal(r.valeurProposee, total);
  }
});

test('client et téléphone vides : tous les blocages listés dans l’ordre de l’écran', () => {
  const b = blocagesCommande(
    commande([{ produitId: ID.layer, quantite: 12 }], { client: '', telephone: '', dateRetrait: '2026-10-27' }),
    ctx,
  );
  assert.deepEqual(
    b.map((e) => e.code),
    ['ERR_CHAMP_OBLIGATOIRE', 'ERR_CHAMP_OBLIGATOIRE', 'ERR_JOUR_FERME', 'ERR_QUANTITE_MIN'],
  );
  assert.deepEqual(b.map((e) => e.champ), ['client', 'telephone', 'dateRetrait', 'lignes[0].quantite']);
});

test('même produit deux fois → avertissement « fusionner » ; favori jamais compté deux fois', () => {
  const b = fiche(ID.baguette);
  assert.ok(api.getProduit(ID.baguette).ok);
  const r = controlerCommande(
    commande([{ produitId: ID.baguette, quantite: 2 }, { produitId: ID.baguette, quantite: 3 }]),
    ctx,
  );
  assert.ok(r.ok);
  assert.equal(r.donnees.totalCentimes, multiplier(5, b.prix.prixCentimes), 'chaque ligne une fois, rien de plus');
  assert.ok(r.signalements.some((s) => s.code === 'AVERT_PRODUIT_EN_DOUBLE'));
  // LOI 4 : un favori apparaît UNE fois dans les rayons (pas de rayon « Favoris »).
  const vus = api
    .listerParCategorie(PRISE)
    .flatMap((rayon) => rayon.produits)
    .filter((p) => p.produit.id === ID.baguette);
  assert.equal(vus.length, 1);
});

test('gâteau sans écriture précisée et téléphone improbable → avertissements, commande acceptée', () => {
  const r = controlerCommande(commande([{ produitId: ID.layer, quantite: 20 }], { telephone: '12345', gateauComplexe: true }), ctx);
  assert.ok(r.ok);
  const codes = r.signalements.map((s) => s.code);
  assert.ok(codes.includes('AVERT_TELEPHONE_IMPROBABLE'));
  assert.ok(codes.includes('AVERT_ECRITURE_NON_PRECISEE'));
  assert.ok(codes.includes('AVERT_COMMANDE_INHABITUELLE'), 'ancien « gâteau complexe » = commande inhabituelle');
  assert.ok(!codes.includes('AVERT_GATEAU_COMPLEXE'));
});

test('modification d’une commande remise → ERR_COMMANDE_FIGEE', () => {
  const r = controlerCommande(commande([{ produitId: ID.baguette, quantite: 30 }]), {
    ...ctx,
    existante: { statut: 'remise', retraitLe: RETRAIT },
    joursAvantArchivage: 2,
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'ERR_COMMANDE_FIGEE');
});

test('pain surprise 21 sandwichs dans une commande : accepté, avertissement avec 2 pains proposés', () => {
  const r = controlerCommande(commande([{ produitId: ID.painSurprise, quantite: 1, nbObjets: 21 }]), ctx);
  assert.ok(r.ok);
  const a = r.signalements.find((s) => s.code === 'AVERT_PAIN_SUPPLEMENTAIRE');
  assert.equal(a?.valeurProposee, 2);
  assert.equal(a?.champ, 'lignes[0].quantite');
});

// ---------------------------------------------------------------- règlement intérieur (LOI 11)

test('R56 date et heure de prise reprises telles quelles ; heure de prise illisible → bloquant', () => {
  const r = controlerCommande(commande([{ produitId: ID.baguette, quantite: 30 }]), ctx);
  assert.ok(r.ok);
  assert.equal(r.donnees.datePrise, PRISE);
  assert.equal(r.donnees.heurePrise, '10:15');
  const x = controlerCommande(commande([{ produitId: ID.baguette, quantite: 30 }], { heurePrise: '' }), ctx);
  assert.equal(x.ok, false);
  if (!x.ok) {
    assert.equal(x.code, 'ERR_SAISIE_INVALIDE');
    assert.equal(x.champ, 'heurePrise');
  }
});

test('R52 acompte sous 50 % du total → ACCEPTÉ avec AVERT_ACOMPTE_INSUFFISANT, minimum proposé ; pile 50 % sans avertissement', () => {
  const b = fiche(ID.baguette);
  const total = multiplier(31, b.prix.prixCentimes);
  const minimum = total % 2 === 0 ? total / 2 : (total + 1) / 2;
  const r = controlerCommande(commande([{ produitId: ID.baguette, quantite: 31 }], { acompteCentimes: minimum - 1 }), ctxReglement);
  assert.ok(r.ok, 'un acompte faible ne bloque plus la vente (18/10/2026)');
  assert.equal(r.donnees.acompteCentimes, minimum - 1);
  const avert = r.signalements.filter((s) => s.code === 'AVERT_ACOMPTE_INSUFFISANT');
  assert.equal(avert.length, 1);
  assert.equal(avert[0]?.niveau, 'avertissement');
  assert.equal(avert[0]?.champ, 'acompte');
  assert.equal(avert[0]?.valeurProposee, minimum);
  const sansAcompte = controlerCommande(commande([{ produitId: ID.baguette, quantite: 31 }], { acompteCentimes: 0 }), ctxReglement);
  assert.ok(sansAcompte.ok, '0 € : accepté, signalé');
  assert.ok(sansAcompte.signalements.some((s) => s.code === 'AVERT_ACOMPTE_INSUFFISANT'));
  const ok = controlerCommande(commande([{ produitId: ID.baguette, quantite: 31 }], { acompteCentimes: minimum }), ctxReglement);
  assert.ok(ok.ok, JSON.stringify(ok));
  assert.ok(!ok.signalements.some((s) => s.code === 'AVERT_ACOMPTE_INSUFFISANT'));
});

test('R53 baguettes pour le lendemain → acceptées, INFO_COMMANDE_LENDEMAIN, aucun accord tracé', () => {
  const lignes = [{ produitId: ID.baguette, quantite: 30 }];
  const ok = controlerCommande(commande(lignes, { dateRetrait: '2026-10-16' }), ctx);
  assert.ok(ok.ok, JSON.stringify(ok));
  const info = ok.signalements.filter((s) => s.code === 'INFO_COMMANDE_LENDEMAIN');
  assert.equal(info.length, 1);
  assert.equal(info[0]?.niveau, 'information');
  assert.equal(ok.donnees.accordLendemain, undefined, 'plus d’accord du responsable');
  // Un ancien accord transmis par l'écran est ignoré : même résultat.
  const avecAccord = controlerCommande(commande(lignes, { dateRetrait: '2026-10-16', accordLendemain: GERANT }), ctx);
  assert.ok(avecAccord.ok);
  assert.equal(avecAccord.donnees.accordLendemain, undefined);
});

test('R53b retrait le jour même → ACCEPTÉ avec INFO_COMMANDE_JOUR_MEME, production le jour même', () => {
  for (const id of [ID.baguette, ID.miniBurger, ID.layer]) {
    const quantite = id === ID.layer ? 20 : 30;
    const r = controlerCommande(commande([{ produitId: id, quantite }], { dateRetrait: PRISE, sansEcriture: true }), ctx);
    assert.ok(r.ok, `${id} : ${JSON.stringify(r)}`);
    assert.equal(r.signalements.filter((s) => s.code === 'INFO_COMMANDE_JOUR_MEME').length, 1, id);
    assert.ok(!r.signalements.some((s) => s.code === 'INFO_COMMANDE_LENDEMAIN'), id);
    assert.equal(r.donnees.delaiJoursOuvres, 0);
    // Cascade R2d : jamais une fiche de production dans le passé.
    assert.equal(r.donnees.dateProduction, PRISE, 'production le jour de la prise, pas la veille');
  }
});

test('R53b jour même : saisie hors ligne un mardi pour le mardi, synchronisée le mercredi → ERR_JOUR_FERME', () => {
  const mardi = '2026-10-20';
  const r = controlerCommande(
    commande([{ produitId: ID.baguette, quantite: 30 }], { datePrise: mardi, dateRetrait: mardi }),
    { ...ctx, aujourdhui: mardi },
  );
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_JOUR_FERME');
    assert.equal(r.valeurProposee, '2026-10-21');
  }
});

test('R53b date passée reste refusée (ERR_DATE_PASSEE)', () => {
  const r = controlerCommande(commande([{ produitId: ID.baguette, quantite: 30 }], { dateRetrait: '2026-10-14' }), ctx);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'ERR_DATE_PASSEE');
});

test('R53 + délai : gâteau simple (Layer Cake) pour le lendemain → accepté avec information', () => {
  const ok = controlerCommande(
    commande([{ produitId: ID.layer, quantite: 20 }], { dateRetrait: '2026-10-16', sansEcriture: true }),
    ctx,
  );
  assert.ok(ok.ok, JSON.stringify(ok));
  assert.ok(ok.signalements.some((s) => s.code === 'INFO_COMMANDE_LENDEMAIN'));
  assert.equal(ok.donnees.delaiJoursOuvres, 0);
  assert.equal(ok.donnees.dateProduction, PRISE, 'veille ouvrée du vendredi = jeudi');
});

test('R53 + délai étages : pièce montée pour le lendemain → acceptée par défaut, refusée si le gérant a réglé 5 jours', () => {
  const saisie = commande([{ produitId: ID.pieceMontee, quantite: 60 }], { dateRetrait: '2026-10-16', sansEcriture: true });
  const defaut = controlerCommande(saisie, ctx);
  assert.ok(defaut.ok, JSON.stringify(defaut));
  assert.ok(defaut.signalements.some((s) => s.code === 'INFO_COMMANDE_LENDEMAIN'));
  const r = controlerCommande(saisie, ctxEtages);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_DELAI_TROP_COURT');
    assert.equal(r.valeurProposee, '2026-10-21', 'ven 16, sam 17, dim 18, lun 19, (mar fermé), mer 21');
  }
  assert.deepEqual(blocagesCommande(saisie, ctxEtages).map((e) => e.code), ['ERR_DELAI_TROP_COURT']);
});

// Réserve qa-metier B2 : le délai « gâteau à étages » dépend de la SEULE donnée
// `etages` de la fiche (fournie par le catalogue), jamais du nom ni du minimum.
function avecEtages(id: string, etages: number | null): ContexteCommande {
  return {
    ...ctxEtages,
    resoudre: (produitId, date) => {
      const r = resoudre(produitId, date);
      if (!r.ok || produitId !== id) return r;
      return { ...r, donnees: { ...r.donnees, prix: { ...r.donnees.prix, etages } } };
    },
  };
}

test('B2 délai étages : une fiche qui porte `etages` reçoit le délai gâteau à étages via controlerCommande', () => {
  const saisie = commande([{ produitId: ID.layer, quantite: 20 }], { dateRetrait: '2026-10-16', sansEcriture: true });
  assert.ok(controlerCommande(saisie, ctxEtages).ok, 'Layer Cake sans étages : lendemain accepté');
  const r = controlerCommande(saisie, avecEtages(ID.layer, 2));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_DELAI_TROP_COURT');
    assert.equal(r.valeurProposee, '2026-10-21', `${DELAI_ETAGES_TEST} jours ouvrés, mardi exclu`);
  }
});

test('B2 délai étages : sans la donnée `etages`, rien n’est déduit du nom ni du minimum (dépend du catalogue)', () => {
  const saisie = commande([{ produitId: ID.pieceMontee, quantite: 60 }], { dateRetrait: '2026-10-16', sansEcriture: true });
  const r = controlerCommande(saisie, avecEtages(ID.pieceMontee, null));
  assert.ok(r.ok, 'pas de déduction : le délai vient de la donnée, que catalogue-prix doit fournir');
  assert.equal(r.donnees.delaiJoursOuvres, DELAIS_PAR_DEFAUT.parRegime.C);
});

test('R54 heure de retrait hors ouverture → ERR_HEURE_HORS_OUVERTURE, borne proposée ; tous produits', () => {
  for (const [lignes, heure, proposee] of [
    [[{ produitId: ID.layer, quantite: 20 }], '05:30', '06:00'],
    [[{ produitId: ID.baguette, quantite: 30 }], '21:00', '20:00'],
  ] as const) {
    const r = controlerCommande(commande([...lignes], { dateRetrait: '2026-10-17', heureRetrait: heure, sansEcriture: true }), ctx);
    assert.equal(r.ok, false, heure);
    if (!r.ok) {
      assert.equal(r.code, 'ERR_HEURE_HORS_OUVERTURE');
      assert.equal(r.champ, 'heureRetrait');
      assert.equal(r.valeurProposee, proposee);
    }
  }
  // Ancienne règle pâtisserie (12h00 le samedi) supprimée : un gâteau à 07:00 passe.
  const ok = controlerCommande(
    commande([{ produitId: ID.layer, quantite: 20 }], { dateRetrait: '2026-10-17', heureRetrait: '07:00', sansEcriture: true }),
    ctx,
  );
  assert.ok(ok.ok, JSON.stringify(ok));
  assert.equal(ok.donnees.heureRetrait, '07:00');
});

test('R54 heure de retrait OBLIGATOIRE (22/10/2026) : sans heure → ERR_CHAMP_OBLIGATOIRE sur heureRetrait', () => {
  for (const [lignes, heureRetrait] of [
    [[{ produitId: ID.layer, quantite: 20 }], null],
    [[{ produitId: ID.baguette, quantite: 30 }], undefined],
    [[{ produitId: ID.baguette, quantite: 30 }], '  '],
  ] as const) {
    const r = controlerCommande(commande([...lignes], { heureRetrait, sansEcriture: true }), ctx);
    assert.equal(r.ok, false);
    if (r.ok) continue;
    assert.equal(r.code, 'ERR_CHAMP_OBLIGATOIRE');
    assert.equal(r.champ, 'heureRetrait');
  }
});

test('R55 case « demande inhabituelle » ou ligne libre → AVERT_COMMANDE_INHABITUELLE, commande acceptée', () => {
  const r = controlerCommande(commande([{ produitId: ID.baguette, quantite: 30 }], { demandeInhabituelle: true }), ctx);
  assert.ok(r.ok);
  assert.ok(r.signalements.some((s) => s.code === 'AVERT_COMMANDE_INHABITUELLE'));
  const libre = controlerCommande(
    commande([{ libelle: 'Gâteau licorne', gateauLibre: false, quantite: 1, prixUnitaireCentimes: multiplier(40, 100) /* montant de test, hors catalogue */, deverrouillage: GERANT }]),
    ctx,
  );
  assert.ok(libre.ok, JSON.stringify(libre));
  assert.equal(libre.signalements.filter((s) => s.code === 'AVERT_COMMANDE_INHABITUELLE').length, 1);
});

// ------------------------------------------------------------------ R59 tailles standard

const TAILLES = REGLEMENT_COMMANDE.taillesGateau;

test('taillesProches : strictement en dessous et au-dessus, liste dans le désordre', () => {
  assert.deepEqual(taillesProches(3, TAILLES), { inferieure: null, superieure: 4 });
  assert.deepEqual(taillesProches(7, TAILLES), { inferieure: 6, superieure: 8 });
  assert.deepEqual(taillesProches(12, TAILLES), { inferieure: 10, superieure: 15 });
  assert.deepEqual(taillesProches(22, TAILLES), { inferieure: 20, superieure: 25 });
  assert.deepEqual(taillesProches(35, TAILLES), { inferieure: 30, superieure: null });
  assert.deepEqual(taillesProches(7, [15, 8, 4, 6, 10]), { inferieure: 6, superieure: 8 });
});

test('Bavarois sur commande 3P → ERR_TAILLE_NON_STANDARD, 4 proposé, aucune taille inférieure', () => {
  const r = validerTailleGateau(fiche(ID.bavaroisC), 3, TAILLES);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_TAILLE_NON_STANDARD');
    assert.equal(r.niveau, 'bloquant');
    assert.equal(r.valeurProposee, 4);
    assert.match(r.message, /se fait en 4 parts, pas en 3/);
  }
});

test('Bavarois sur commande 7P → refusé, 6 et 8 cités, 8 proposé', () => {
  const r = validerTailleGateau(fiche(ID.bavaroisC), 7, TAILLES);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.valeurProposee, 8);
    assert.match(r.message, /Ce gâteau se fait en 6 ou 8 parts/);
  }
});

test('Bavarois sur commande 12P → refusé, 10 et 15 cités ; 15P accepté', () => {
  const r = validerTailleGateau(fiche(ID.bavaroisC), 12, TAILLES);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.valeurProposee, 15);
    assert.match(r.message, /10 ou 15 parts/);
  }
  const ok = validerTailleGateau(fiche(ID.bavaroisC), 15, TAILLES);
  assert.ok(ok.ok);
  assert.equal(ok.signalements.length, 0);
});

test('Bavarois sur commande 22P → 20 / 25, 25 proposé ; 35P → 30 seulement (pas de supérieure)', () => {
  const r22 = validerTailleGateau(fiche(ID.bavaroisC), 22, TAILLES);
  assert.equal(r22.ok, false);
  if (!r22.ok) {
    assert.equal(r22.valeurProposee, 25);
    assert.match(r22.message, /Ce gâteau se fait en 20 ou 25 parts, pas en 22/);
  }
  const r35 = validerTailleGateau(fiche(ID.bavaroisC), 35, TAILLES);
  assert.equal(r35.ok, false);
  if (!r35.ok) {
    assert.equal(r35.valeurProposee, 30);
    assert.match(r35.message, /Ce gâteau se fait en 30 parts, pas en 35/);
  }
  assert.ok(validerTailleGateau(fiche(ID.bavaroisC), 20, TAILLES).ok);
});

test('taille hors standard + code gérant → accepté, AVERT_TAILLE_NON_STANDARD_AUTORISEE tracé', () => {
  const r = validerTailleGateau(fiche(ID.bavaroisC), 7, TAILLES, GERANT);
  assert.ok(r.ok);
  assert.equal(r.signalements[0]?.code, 'AVERT_TAILLE_NON_STANDARD_AUTORISEE');
  assert.equal(r.signalements[0]?.niveau, 'avertissement');
  assert.match(r.signalements[0]?.message ?? '', /Karim/);
  assert.equal(validerTailleGateau(fiche(ID.bavaroisC), 7, TAILLES, { par: ' ', le: '' }).ok, false, 'accord incomplet');
  const ligne = controlerLigne({ produitId: ID.bavaroisC, quantite: 7, deverrouillageTaille: GERANT }, 0, PRISE, ctx);
  assert.ok(ligne.ok);
  if (ligne.ok) {
    assert.deepEqual(ligne.donnees.autorisationTaille, GERANT);
    assert.equal(ligne.signalements.some((s) => s.code === 'AVERT_TAILLE_NON_STANDARD_AUTORISEE'), true);
  }
  // Un accord de PRIX n'autorise pas une taille.
  assert.equal(controlerLigne({ produitId: ID.bavaroisC, quantite: 7, deverrouillage: GERANT }, 0, PRISE, ctx).ok, false);
});

test('tailles standard : Layer 22 parts, Number Cake, mariage, mini, comptoir non concernés', () => {
  assert.ok(validerTailleGateau(fiche(ID.layer), 22, TAILLES).ok);
  assert.ok(controlerLigne({ produitId: ID.layer, quantite: 22 }, 0, PRISE, ctx).ok);
  assert.ok(validerTailleGateau(fiche(ID.number), 31, TAILLES).ok);
  assert.ok(validerTailleGateau(fiche(ID.mariage), 41, TAILLES).ok);
  assert.ok(validerTailleGateau(fiche(ID.miniTartelette), 17, TAILLES).ok);
  assert.ok(validerTailleGateau(fiche(ID.bavarois6pComptoir), 3, TAILLES).ok);
});

test('controlerLigne : la taille est contrôlée APRÈS le minimum ; la liste est une donnée', () => {
  const r = controlerLigne({ produitId: ID.bavaroisC, quantite: 7 }, 2, PRISE, ctx);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_TAILLE_NON_STANDARD');
    assert.equal(r.champ, 'lignes[2].quantite');
    assert.equal(r.valeurProposee, 8);
  }
  const ctx7: ContexteCommande = { ...ctx, reglement: { ...ctx.reglement, taillesGateau: [7, 9] } };
  assert.ok(controlerLigne({ produitId: ID.bavaroisC, quantite: 7 }, 0, PRISE, ctx7).ok);
  // Au minimum non atteint, c'est le minimum qui parle (Layer 12 parts).
  const layer = controlerLigne({ produitId: ID.layer, quantite: 12 }, 0, PRISE, ctx);
  if (!layer.ok) assert.equal(layer.code, 'ERR_QUANTITE_MIN');
  const cmd = controlerCommande(commande([{ produitId: ID.bavaroisC, quantite: 7 }], { sansEcriture: true }), ctx);
  assert.equal(cmd.ok, false);
  if (!cmd.ok) assert.equal(cmd.code, 'ERR_TAILLE_NON_STANDARD');
});

// --- R61 : tailles proposées à partir du minimum, de 5 en 5 (propriétaire, 22/10/2026) ---

test('R61 tailles à partir du minimum : Layer 20…60, pièces montées 40… et 60…, Number Cake selon les symboles', () => {
  assert.deepEqual(taillesAPartirDuMinimum(fiche(ID.layer)), [20, 25, 30, 35, 40, 45, 50, 55, 60]);
  assert.equal(taillesAPartirDuMinimum(fiche(ID.mariage))[0], 40);
  assert.equal(taillesAPartirDuMinimum(fiche(ID.pieceMontee))[0], 60);
  assert.deepEqual(taillesAPartirDuMinimum(fiche(ID.number)), [], 'sans symboles, minimum inconnu : rien');
  assert.deepEqual(taillesAPartirDuMinimum(fiche(ID.number), 2).slice(0, 3), [30, 35, 40]);
  // Gâteau simple (tailles standard du gérant) : non concerné.
  assert.deepEqual(taillesAPartirDuMinimum(fiche(ID.bavaroisC)), []);
  // Raccourcis seulement : une taille hors liste au-dessus du minimum reste acceptée.
  assert.equal(validerQuantiteMin(fiche(ID.layer), 22).ok, true);
});

// --- R62 : goût obligatoire des gâteaux sur commande (propriétaire, 22/10/2026) ---

const ctxGouts: ContexteCommande = { ...ctxReglement, goutsSurCommande: GOUTS_SUR_COMMANDE };
const ligneGout = (produitId: string, quantite: number, gouts?: string[]) =>
  controlerLigne({ produitId, quantite, gouts }, 0, PRISE, ctxGouts);

test('R62 : Layer Cake sans goût → ERR_GOUT_MANQUANT, sortie « Au choix du pâtissier »', () => {
  const r = ligneGout(ID.layer, 20);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, 'ERR_GOUT_MANQUANT');
  assert.equal(r.valeurProposee, GOUT_AU_CHOIX);
  assert.equal(ligneGout(ID.layer, 20, ['Framboise']).ok, true);
  assert.equal(ligneGout(ID.layer, 20, [GOUT_AU_CHOIX]).ok, true);
});

test('R62 : pièce montée 3 étages → un goût PAR étage ; il manque l’étage 3', () => {
  const r = ligneGout(ID.pieceMontee, 60, ['Chocolat', 'Vanille']);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.message, /étage 3/);
  assert.equal(ligneGout(ID.pieceMontee, 60, ['Chocolat', 'Vanille', 'Fraise']).ok, true);
  assert.equal(ligneGout(ID.mariage, 40, ['Chocolat']).ok, false, '2 étages : 2 goûts');
});

test('R62 : entremet → une recette ; comptoir, minis et salé ne sont pas concernés', () => {
  const entremet = ligneGout('gateaux-sur-commande/entremet', 8);
  assert.equal(entremet.ok, false);
  if (!entremet.ok) assert.match(entremet.message, /recette/);
  assert.equal(ligneGout('gateaux-sur-commande/entremet', 8, ['Javanais']).ok, true);
  assert.equal(ligneGout(ID.bavarois6pComptoir, 1).ok, true, 'gâteau du comptoir : goût déjà connu');
  assert.equal(ligneGout('gateaux-sur-commande/mini-bavarois', 15).ok, true, 'minis : assortiment');
});

test('R62 + R60 : Bavarois commandé en 6 parts devenu le 6P du comptoir → son goût reste exigé', () => {
  const sansGout = controlerLigne(
    { produitId: ID.bavarois6pComptoir, quantite: 1, origineSurCommande: ID.bavaroisC },
    0, PRISE, ctxGouts,
  );
  assert.equal(sansGout.ok, false);
  if (!sansGout.ok) assert.equal(sansGout.code, 'ERR_GOUT_MANQUANT');
  const avecGout = controlerLigne(
    { produitId: ID.bavarois6pComptoir, quantite: 1, origineSurCommande: ID.bavaroisC, gouts: ['Vanille'] },
    0, PRISE, ctxGouts,
  );
  assert.equal(avecGout.ok, true);
  // Goût Framboise : le comptoir a son Bavarois framboise 6P → c'est lui (28/10/2026).
  const framboise = controlerLigne(
    { produitId: ID.bavarois6pComptoir, quantite: 1, origineSurCommande: ID.bavaroisC, gouts: ['Framboise'] },
    0, PRISE, ctxGouts,
  );
  assert.equal(framboise.ok, false);
  if (!framboise.ok) assert.equal(framboise.valeurProposee, 'gateaux-et-tartes/bavarois-framboise/6p');
  // Origine qui ne correspond pas au produit du comptoir : ignorée (achat au rayon).
  const fausse = controlerLigne({ produitId: ID.bavarois6pComptoir, quantite: 1, origineSurCommande: ID.layer }, 0, PRISE, ctxGouts);
  assert.equal(fausse.ok, true);
});
