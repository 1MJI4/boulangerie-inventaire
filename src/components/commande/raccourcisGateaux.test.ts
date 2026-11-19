// node --test src/components/commande/raccourcisGateaux.test.ts
//
// Tuiles « gâteaux du comptoir en accès direct » (propriétaire, 19/11/2026) :
// Fraisier, Matadi chocolat, croûtes… en un toucher, sans passer par
// « Bavarois » puis le goût. Ce sont des RACCOURCIS vers ce qui existe déjà :
// la règle de prix reste R60 (comptoir jusqu'à 8P, par personne au-dessus).
// Vrai catalogue : aucun prix en dur (LOI 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogueDepuisDossier } from '../../catalogue/chargerFichiers.ts';
import { creerApiCatalogue } from '../../catalogue/catalogue.ts';
import { CORRESPONDANCES_COMPTOIR } from '../../catalogue/correspondancesComptoir.ts';
import { GOUTS_SUR_COMMANDE } from '../../catalogue/goutsSurCommande.ts';
import { RACCOURCIS_GATEAUX, type RaccourciGateau } from '../../catalogue/raccourcisGateaux.ts';
import { controlerLigne, type ContexteCommande } from '../../domaine/commande.ts';
import { DELAIS_PAR_DEFAUT, FAMILLES_GATEAU, REGLEMENT_COMMANDE, TAILLES_INTERDITES } from '../../domaine/constantes.ts';
import {
  choisirTaille,
  ficheDe,
  goutDitParLaTuile,
  ligneVide,
  resoudreLocal,
  suivreGout,
  toucherProduit,
  toucherRaccourci,
  tuilesRaccourcis,
  versLigneSaisie,
  SUPPLEMENT_ECRITURE,
  SUPPLEMENT_PHOTO,
  type CatalogueCommande,
  type FicheCatalogue,
  type LigneEcran,
  type TuileRaccourci,
} from './modele.ts';

const DATE = '2026-11-20';
const T = CORRESPONDANCES_COMPTOIR;
const BAV = 'gateaux-sur-commande/bavarois';
const api = creerApiCatalogue(chargerCatalogueDepuisDossier().catalogue);

// Tout le catalogue de commande à la date, comme le reçoit l'écran.
const catalogue: CatalogueCommande = (() => {
  const fiches: FicheCatalogue[] = [];
  for (const p of chargerCatalogueDepuisDossier().catalogue.produits.values()) {
    const x = api.getPrix(p.id, DATE);
    if (x.ok) fiches.push({ produit: p, prix: x.donnees } as unknown as FicheCatalogue);
  }
  return { date: DATE, fiches };
})();
const sans = (...ids: string[]): CatalogueCommande => ({ date: DATE, fiches: catalogue.fiches.filter((f) => !ids.includes(f.produit.id)) });
const fiche = (id: string) => {
  const f = catalogue.fiches.find((x) => x.produit.id === id);
  assert.ok(f, `${id} absent du catalogue`);
  return f;
};
const RAYON_GATEAU = fiche(BAV).produit.categorie;
const ctx: ContexteCommande = {
  resoudre: resoudreLocal(catalogue),
  joursFermes: [],
  delais: DELAIS_PAR_DEFAUT,
  reglement: { ...REGLEMENT_COMMANDE, acomptePourcentageMin: 0 },
  correspondancesComptoir: T,
  taillesInterdites: TAILLES_INTERDITES,
  supplementEcriture: SUPPLEMENT_ECRITURE,
  supplementPhoto: SUPPLEMENT_PHOTO,
};
const controler = (l: LigneEcran) => controlerLigne(versLigneSaisie(l, ficheDe(catalogue, l.produitId)), 0, DATE, ctx);

const tuiles = (lignes: readonly LigneEcran[] = [], c: CatalogueCommande = catalogue) => tuilesRaccourcis(c, lignes, '', RAYON_GATEAU);
const tuile = (libelle: string, lignes: readonly LigneEcran[] = [], c: CatalogueCommande = catalogue): TuileRaccourci => {
  const t = tuiles(lignes, c).find((x) => x.raccourci.libelle === libelle);
  assert.ok(t, `tuile « ${libelle} » absente`);
  return t;
};
const toucher = (libelle: string, lignes: readonly LigneEcran[] = []) => {
  const r = toucherRaccourci(lignes, tuile(libelle, lignes));
  assert.ok(r, `${libelle} : toucher sans effet`);
  return r;
};
const sc = (r: RaccourciGateau) => (r.type === 'surCommande' ? r : null);

test('donnée : chaque raccourci pointe vers des produits du catalogue, libellés à la lettre (LOI 5, LOI 6)', () => {
  assert.equal(RACCOURCIS_GATEAUX.length, 10);
  assert.equal(new Set(RACCOURCIS_GATEAUX.map((r) => r.cle)).size, 10, 'clés uniques');
  const choix = GOUTS_SUR_COMMANDE[BAV];
  const enTete = choix.liste === 'parfum' ? (choix.goutsEnTete ?? []) : [];
  for (const r of RACCOURCIS_GATEAUX) {
    if (r.type === 'surCommande') {
      const f = fiche(r.surCommande);
      assert.equal(f.produit.regimePrix, 'C', r.libelle);
      assert.equal(f.prix.basePrix, 'personne', r.libelle);
      assert.ok(enTete.includes(r.gout), `${r.libelle} : goût « ${r.gout} » absent des goûts en tête`);
      // Le libellé est celui du gâteau du comptoir que ce goût désigne.
      const six = T.find((c) => c.surCommande === r.surCommande && c.parts === 6 && c.gout === r.gout);
      assert.ok(six, `${r.libelle} : pas de correspondance 6 parts`);
      assert.equal(fiche(six.comptoir).produit.produit, r.libelle);
    } else {
      assert.ok(r.tailles.length > 0, r.libelle);
      for (const t of r.tailles) {
        const f = fiche(t.comptoir);
        assert.equal(f.produit.regimePrix, 'A', t.comptoir);
        assert.equal(f.prix.basePrix, 'piece', t.comptoir);
        assert.ok(FAMILLES_GATEAU.includes(f.produit.famille), t.comptoir);
        assert.equal(`${f.produit.produit} ${f.produit.sousCategorie}`, `${r.libelle} ${t.parts}P`, 'libellé du tarif, à la lettre');
      }
    }
  }
});

test('tuilesRaccourcis : visibles dans la famille Gâteau, absentes ailleurs et sans filtre', () => {
  assert.deepEqual(tuiles().map((t) => t.raccourci.libelle), RACCOURCIS_GATEAUX.map((r) => r.libelle));
  assert.deepEqual(tuilesRaccourcis(catalogue, [], '', null), []);
  assert.deepEqual(tuilesRaccourcis(catalogue, [], '', 'Viennoiserie'), []);
});

test('tuilesRaccourcis : la recherche « frais » montre Fraisier et Croûte Fraises, quel que soit le rayon', () => {
  assert.deepEqual(tuilesRaccourcis(catalogue, [], 'frais', null).map((t) => t.raccourci.libelle), ['Fraisier', 'Croûte Fraises']);
  assert.deepEqual(tuilesRaccourcis(catalogue, [], 'FORET', 'Viennoiserie').map((t) => t.raccourci.libelle), ['Forêt noire']);
  assert.deepEqual(tuilesRaccourcis(catalogue, [], 'baguette', RAYON_GATEAU), []);
});

test('toucher « Fraisier » : un Bavarois sur commande, goût Fraisier, boutons de taille ouverts', () => {
  const r = toucher('Fraisier');
  assert.equal(r.lignes.length, 1);
  assert.equal(r.champ, 'taille');
  const l = r.lignes[0];
  assert.equal(l.cle, r.cle);
  assert.equal(l.produitId, BAV);
  assert.deepEqual(l.gouts, ['Fraisier']);
  assert.equal(l.quantite, null, 'la taille reste à choisir');
});

test('Fraisier puis taille 6 : la ligne devient « Fraisier 6P » du comptoir, à son prix ; 10 : par personne', () => {
  const l = toucher('Fraisier').lignes[0];
  const six = choisirTaille(l, 6, catalogue, T);
  assert.equal(six.produitId, 'gateaux-et-tartes/fraisier/6p');
  assert.equal(six.quantite, 1);
  const r6 = controler({ ...six, sansEcriture: true, forme: 'rond' });
  assert.ok(r6.ok, JSON.stringify(r6));
  assert.equal(r6.donnees.totalCentimes, fiche('gateaux-et-tartes/fraisier/6p').prix.prixCentimes);

  const dix = choisirTaille(l, 10, catalogue, T);
  assert.equal(dix.produitId, BAV);
  assert.equal(dix.quantite, 10);
  const r10 = controler({ ...dix, sansEcriture: true, forme: 'carre' });
  assert.ok(r10.ok, JSON.stringify(r10));
  assert.equal(r10.donnees.totalCentimes, 10 * fiche(BAV).prix.prixCentimes);
});

test('Matadi sans taille puis Fraisier : DEUX gâteaux, chacun son goût', () => {
  const un = toucher('Matadi chocolat');
  const deux = toucher('Fraisier', un.lignes);
  assert.equal(deux.lignes.length, 2);
  assert.deepEqual(deux.lignes.map((l) => l.gouts), [['Matadi chocolat'], ['Fraisier']]);
  assert.notEqual(deux.cle, un.cle);
});

test('Fraisier deux fois sans taille : un seul gâteau, rouvert ; avec sa taille : un 2e gâteau', () => {
  const un = toucher('Fraisier');
  const encore = toucher('Fraisier', un.lignes);
  assert.equal(encore.lignes.length, 1);
  assert.equal(encore.cle, un.cle);
  assert.equal(encore.champ, 'taille');
  const taille = un.lignes.map((l) => choisirTaille(l, 6, catalogue, T));
  const deux = toucher('Fraisier', taille);
  assert.equal(deux.lignes.length, 2);
  assert.deepEqual(deux.lignes.map((l) => l.quantite), [1, null], 'jamais « 2 × » (une ligne par gâteau)');
});

test('la carte « Bavarois » rouvre le gâteau sans taille ; une autre tuile crée toujours le sien', () => {
  // Fraisier sans taille, puis la carte Bavarois (autre goût à choisir) : la carte
  // rouvre la ligne sans taille — c'est le comportement existant, et le vendeur
  // voit « Fraisier » sur la ligne. Le raccourci, lui, ne vole jamais la ligne d'un autre goût.
  const fraisier = toucher('Fraisier');
  const bav = toucherProduit(fraisier.lignes, fiche(BAV));
  assert.equal(bav.lignes.length, 1);
  const matadi = toucher('Matadi chocolat', bav.lignes);
  assert.equal(matadi.lignes.length, 2);
});

test('Matadi chocolat 4 parts : ERR_TAILLE_INTERDITE et ses deux sorties (R65)', () => {
  const l = choisirTaille(toucher('Matadi chocolat').lignes[0], 4, catalogue, T);
  assert.equal(l.produitId, 'gateaux-et-tartes/matadi-chocolat/4p');
  const r = controler({ ...l, sansEcriture: true, forme: 'rond' });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, 'ERR_TAILLE_INTERDITE');
  assert.equal((r.valeurProposee as unknown[]).length, 2);
});

test('Fraisier 6P puis goût Mangue : la ligne suit le goût (« Bavarois mangue 6P »)', () => {
  const six = choisirTaille(toucher('Fraisier').lignes[0], 6, catalogue, T);
  const mangue = suivreGout({ ...six, gouts: ['Mangue'] }, catalogue, T);
  assert.equal(mangue.produitId, 'gateaux-et-tartes/bavarois-mangue/6p');
});

test('croûte : une taille par produit du comptoir, prix lu au catalogue ; toucher la tuile ne crée rien', () => {
  const t = tuile('Croûte Fraises');
  assert.equal(t.fiche, null);
  assert.deepEqual(t.tailles.map((x) => [x.parts, x.fiche.produit.id]), [
    [6, 'gateaux-et-tartes/croute/fraises-6p'],
    [8, 'gateaux-et-tartes/croute/fraises-8p'],
  ]);
  assert.equal(toucherRaccourci([], t), null, 'la taille se touche sur la tuile');
  // Le chemin existant du gâteau du comptoir : un toucher = un gâteau, à son prix.
  const r = toucherProduit([], t.tailles[1].fiche);
  assert.equal(r.champ, 'gateau');
  const c = controler({ ...r.lignes[0], sansEcriture: true });
  assert.ok(c.ok, JSON.stringify(c));
  assert.equal(c.donnees.totalCentimes, fiche('gateaux-et-tartes/croute/fraises-8p').prix.prixCentimes);
});

test('produit sans prix à la date : taille non proposée ; plus aucune taille → tuile absente', () => {
  const une = tuile('Croûte Fraises', [], sans('gateaux-et-tartes/croute/fraises-8p'));
  assert.deepEqual(une.tailles.map((x) => x.parts), [6]);
  const aucune = tuiles([], sans('gateaux-et-tartes/croute/fraises-6p', 'gateaux-et-tartes/croute/fraises-8p'));
  assert.equal(aucune.some((t) => t.raccourci.libelle === 'Croûte Fraises'), false);
  // Gâteau sur commande absent : ses sept tuiles disparaissent (et avec elles le
  // rayon qui les porte) ; les croûtes restent trouvables par la recherche.
  assert.deepEqual(tuiles([], sans(BAV)), []);
  assert.deepEqual(tuilesRaccourcis(sans(BAV), [], 'croute', null).map((t) => t.raccourci.type), ['comptoir', 'comptoir', 'comptoir']);
  assert.deepEqual(tuilesRaccourcis(sans(BAV), [], 'fraisier', null), []);
});

test('auBon : compte les gâteaux de la tuile, pas ceux d’un autre goût', () => {
  const fraisier6 = choisirTaille(toucher('Fraisier').lignes[0], 6, catalogue, T);
  const fraisier15 = choisirTaille({ ...ligneVide(BAV), gouts: [' fraisier '] }, 15, catalogue, T);
  const matadi = toucher('Matadi chocolat').lignes[0];
  const croute = toucherProduit([], fiche('gateaux-et-tartes/croute/fraises-8p')).lignes[0];
  const lignes = [fraisier6, fraisier15, matadi, croute];
  const compte = Object.fromEntries(tuiles(lignes).map((t) => [t.raccourci.libelle, t.auBon]));
  assert.equal(compte['Fraisier'], 2);
  assert.equal(compte['Matadi chocolat'], 1);
  assert.equal(compte['Mousse chocolat'], 0);
  assert.equal(compte['Croûte Fraises'], 1);
  assert.equal(compte['Croûte Fruits'], 0);
  assert.ok(sc(RACCOURCIS_GATEAUX[0]), 'la première tuile est un gâteau sur commande');
});

test('goût déjà dit par la tuile : la liste des goûts n’a pas à rester ouverte (propriétaire, 19/11/2026)', () => {
  const fraisier = toucher('Fraisier').lignes[0];
  assert.equal(goutDitParLaTuile(fraisier), true, 'dès le toucher, avant la taille');
  assert.equal(goutDitParLaTuile(choisirTaille(fraisier, 6, catalogue, T)), true, 'Fraisier 6P du comptoir');
  assert.equal(goutDitParLaTuile(choisirTaille(fraisier, 15, catalogue, T)), true, '15 parts, prix par personne');
  // Bavarois touché sans tuile : le goût reste à choisir, la liste reste ouverte.
  const bavarois = toucherProduit([], fiche(BAV)).lignes[0];
  assert.equal(goutDitParLaTuile(bavarois), false);
  assert.equal(goutDitParLaTuile({ ...bavarois, gouts: ['Vanille'] }), false, 'goût qui n’est pas une tuile');
  assert.equal(goutDitParLaTuile({ ...bavarois, gouts: ['Au choix du pâtissier'] }), false);
  // Croûte, Layer Cake, ligne libre : pas de goût posé par une tuile.
  assert.equal(goutDitParLaTuile(toucherProduit([], fiche('gateaux-et-tartes/croute/fraises-8p')).lignes[0]), false);
  assert.equal(goutDitParLaTuile({ ...ligneVide('gateaux-sur-commande/layer-cake'), gouts: ['Fraisier'] }), false);
  assert.equal(goutDitParLaTuile(ligneVide(null)), false);
});
