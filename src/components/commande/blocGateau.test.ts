// node --test src/components/commande/blocGateau.test.ts
//
// Bloc « Sur le gâteau » du bon (18/10/2026 ; lot 2 du 28/10/2026 : un bloc
// SOUS CHAQUE gâteau, cf. ecritureParGateau.test.ts) : écrire / cocher « photo
// à imprimer » met le supplément au bon, vider / décocher le retire ; R7
// respectée (une fois par gâteau, jamais sans gâteau). Vrai catalogue : aucun
// prix en dur (LOI 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogueDepuisDossier } from '../../catalogue/chargerFichiers.ts';
import { creerApiCatalogue } from '../../catalogue/catalogue.ts';
import { CORRESPONDANCES_COMPTOIR } from '../../catalogue/correspondancesComptoir.ts';
import { controlerLigne } from '../../domaine/commande.ts';
import { somme } from '../../domaine/argent.ts';
import { controlerSupplements } from '../../domaine/supplements.ts';
import { DELAIS_PAR_DEFAUT, FAMILLES_GATEAU, REGLEMENT_COMMANDE } from '../../domaine/constantes.ts';
import {
  aSupplement,
  basculerSupplement,
  choisirTaille,
  ficheDe,
  gateauxAuBon,
  indexPremierGateau,
  ligneVide,
  resoudreLocal,
  saisirSurLeGateau,
  toucherProduit,
  versLigneSaisie,
  SUPPLEMENT_ECRITURE,
  SUPPLEMENT_PHOTO,
  type CatalogueCommande,
  type FicheCatalogue,
  type LigneEcran,
} from './modele.ts';

const DATE = '2026-10-15';
const api = creerApiCatalogue(chargerCatalogueDepuisDossier().catalogue);
const T = CORRESPONDANCES_COMPTOIR;
const F = FAMILLES_GATEAU;

function ficheCatalogue(id: string): FicheCatalogue {
  const p = api.getProduit(id);
  const x = api.getPrix(id, DATE);
  assert.ok(p.ok && x.ok, `${id} absent du catalogue`);
  return { produit: p.donnees, prix: x.donnees } as unknown as FicheCatalogue;
}

const BAVAROIS = 'gateaux-sur-commande/bavarois';
const BURGER = 'sur-commande/mini-burger';
const IDS = [BAVAROIS, 'gateaux-et-tartes/bavarois/6p', BURGER, SUPPLEMENT_PHOTO, SUPPLEMENT_ECRITURE];
const catalogue: CatalogueCommande = { date: DATE, fiches: IDS.map(ficheCatalogue) };
const ctx = { resoudre: resoudreLocal(catalogue), delais: DELAIS_PAR_DEFAUT, reglement: REGLEMENT_COMMANDE, correspondancesComptoir: T };

/** Bavarois 6 parts au bouton de taille → Bavarois 6P du comptoir (R60). */
const bavarois6 = (): LigneEcran => choisirTaille(toucherProduit([], ficheCatalogue(BAVAROIS)).lignes[0], 6, catalogue, T);
const burgers = (): LigneEcran => ({ ...ligneVide(BURGER), quantite: 10 });

/** Refus R7 du domaine sur les lignes de l'écran. */
function refusR7(lignes: readonly LigneEcran[]) {
  return controlerSupplements(
    lignes.map((l) => {
      const f = ficheDe(catalogue, l.produitId);
      return {
        produitId: l.produitId,
        basePrix: f?.prix.basePrix ?? null,
        quantite: l.quantite ?? 0,
        nbGateaux: gateauxAuBon([l], catalogue, F),
      };
    }),
  );
}

test('bloc « Gâteau » : sous le premier gâteau (y compris le Bavarois 6P du comptoir, R60), absent sans gâteau', () => {
  assert.equal(indexPremierGateau([burgers()], catalogue, F), null, 'salé seul : pas de bloc');
  assert.equal(indexPremierGateau([], catalogue, F), null);
  assert.equal(indexPremierGateau([burgers(), bavarois6()], catalogue, F), 1);
  // Gâteau sur commande pas encore dimensionné : déjà un gâteau (le bloc s'affiche).
  assert.equal(indexPremierGateau([ligneVide(BAVAROIS)], catalogue, F), 0);
  // Deux gâteaux : un seul bloc, sous le premier.
  assert.equal(indexPremierGateau([bavarois6(), burgers(), bavarois6()], catalogue, F), 0);
  // Un supplément n'est pas un gâteau.
  assert.equal(indexPremierGateau([{ ...ligneVide(SUPPLEMENT_PHOTO), quantite: 1 }], catalogue, F), null);
});

test('bloc « Sur le gâteau » : sous CHAQUE gâteau, plus de renvoi vers « le » bloc (lot 2, 28/10/2026)', () => {
  const lignes = [burgers(), bavarois6(), { ...bavarois6(), photoModele: 'G200' }];
  assert.deepEqual(lignes.map((l) => gateauxAuBon([l], catalogue, F) > 0), [false, true, true]);
  // Chaque gâteau garde sa propre écriture.
  let l2 = saisirSurLeGateau(lignes, lignes[1].cle, { texteGateau: 'A' }, catalogue, F);
  l2 = saisirSurLeGateau(l2, lignes[2].cle, { texteGateau: 'B' }, catalogue, F);
  assert.deepEqual(l2.slice(0, 3).map((l) => l.texteGateau), ['', 'A', 'B']);
});

test('photo à imprimer : cocher ajoute le supplément Photo une fois, décocher le retire', () => {
  const base = [bavarois6()];
  const coche = basculerSupplement(base, SUPPLEMENT_PHOTO, true, catalogue, F);
  assert.equal(coche.length, 2);
  assert.equal(coche[1].produitId, SUPPLEMENT_PHOTO);
  assert.equal(coche[1].quantite, 1);
  assert.ok(aSupplement(coche, SUPPLEMENT_PHOTO), 'la case suit la présence de la ligne');
  // Re-cocher (ou supplément déjà ajouté depuis la grille) : pas de doublon.
  assert.equal(basculerSupplement(coche, SUPPLEMENT_PHOTO, true, catalogue, F).length, 2);
  assert.deepEqual(refusR7(coche), [], 'R7 respectée');
  const decoche = basculerSupplement(coche, SUPPLEMENT_PHOTO, false, catalogue, F);
  assert.equal(decoche.length, 1);
  assert.ok(!aSupplement(decoche, SUPPLEMENT_PHOTO));
});

test('jamais de supplément sans gâteau (R7) : salé seul, rien n’est ajouté', () => {
  const lignes = [burgers()];
  assert.equal(basculerSupplement(lignes, SUPPLEMENT_PHOTO, true, catalogue, F).length, 1);
  assert.equal(saisirSurLeGateau(lignes, lignes[0].cle, { texteGateau: 'BRAVO' }, catalogue, F).length, 1);
});

test('supplément absent du catalogue reçu : rien n’est ajouté (jamais de prix inventé)', () => {
  const sansPhoto: CatalogueCommande = { ...catalogue, fiches: catalogue.fiches.filter((f) => f.produit.id !== SUPPLEMENT_PHOTO) };
  const lignes = [bavarois6()];
  assert.equal(basculerSupplement(lignes, SUPPLEMENT_PHOTO, true, sansPhoto, F).length, 1);
});

test('écriture : un texte ajoute le supplément, le vider le retire ; retiré à la main, il revient (automatique, 28/10/2026)', () => {
  let lignes = [bavarois6()];
  const cle = lignes[0].cle;
  lignes = saisirSurLeGateau(lignes, cle, { texteGateau: 'J' }, catalogue, F);
  lignes = saisirSurLeGateau(lignes, cle, { texteGateau: 'JO' }, catalogue, F);
  assert.equal(lignes.filter((l) => l.produitId === SUPPLEMENT_ECRITURE).length, 1, 'une seule ligne, pas une par lettre');
  assert.deepEqual(refusR7(lignes), []);
  // Le vendeur retire la ligne du supplément : la saisie suivante la remet (non retirable, 28/10/2026).
  const retiree = lignes.filter((l) => l.produitId !== SUPPLEMENT_ECRITURE);
  assert.ok(!aSupplement(retiree, SUPPLEMENT_ECRITURE));
  assert.ok(aSupplement(saisirSurLeGateau(retiree, cle, { texteGateau: 'JOY' }, catalogue, F), SUPPLEMENT_ECRITURE), 'de retour');
  assert.ok(!aSupplement(saisirSurLeGateau(lignes, cle, { texteGateau: '   ' }, catalogue, F), SUPPLEMENT_ECRITURE), 'texte vidé : retiré');
});

test('total affiché = somme des lignes : Bavarois 6P + photo + écriture, prix du catalogue', () => {
  let lignes = [bavarois6()];
  lignes = saisirSurLeGateau(lignes, lignes[0].cle, { photoImprimee: true }, catalogue, F);
  lignes = saisirSurLeGateau(lignes, lignes[0].cle, { texteGateau: 'JOYEUX ANNIVERSAIRE' }, catalogue, F);
  const totaux = lignes.map((l, i) => {
    const r = controlerLigne(versLigneSaisie(l, ficheDe(catalogue, l.produitId)), i, DATE, ctx);
    assert.ok(r.ok, `ligne ${l.produitId} refusée`);
    return r.ok ? r.donnees.totalCentimes : 0;
  });
  const attendu = somme(['gateaux-et-tartes/bavarois/6p', SUPPLEMENT_PHOTO, SUPPLEMENT_ECRITURE].map((id) => ficheCatalogue(id).prix.prixCentimes));
  assert.equal(somme(totaux), attendu);
});

test('dernier gâteau retiré : sa saisie part avec lui, suppléments refusés par le domaine (pas retirés en silence)', () => {
  // L'écriture est sur la ligne du gâteau (lot 2) : retirer le gâteau la retire.
  const g = { ...bavarois6(), texteGateau: 'BRAVO' };
  assert.equal(versLigneSaisie(g, ficheDe(catalogue, g.produitId)).texteGateau, 'BRAVO');
  assert.equal(versLigneSaisie({ ...g, sansEcriture: true }, ficheDe(catalogue, g.produitId)).texteGateau, null, '« pas d’écriture » l’emporte');

  let lignes = [bavarois6()];
  lignes = basculerSupplement(lignes, SUPPLEMENT_PHOTO, true, catalogue, F);
  const sansGateau = lignes.slice(1);
  assert.deepEqual(refusR7(sansGateau).map((e) => e.code), ['ERR_SUPPLEMENT_SANS_GATEAU']);
});
