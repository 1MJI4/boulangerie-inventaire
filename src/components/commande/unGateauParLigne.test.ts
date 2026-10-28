// node --test src/components/commande/unGateauParLigne.test.ts
//
// UNE LIGNE PAR GÂTEAU — décision du propriétaire (28/10/2026) : « 2 Bavarois
// comptent pour 2 gâteaux différents, avec leurs propres caractéristiques ».
// Écran (toucher, photo, séparation), domaine (rejoué au serveur), suppléments
// et bon imprimé. Vrai catalogue : aucun prix en dur (LOI 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogueDepuisDossier } from '../../catalogue/chargerFichiers.ts';
import { creerApiCatalogue } from '../../catalogue/catalogue.ts';
import { CORRESPONDANCES_COMPTOIR } from '../../catalogue/correspondancesComptoir.ts';
import { blocagesCommande, controlerCommande, controlerLigne, type CommandeSaisie, type ContexteCommande } from '../../domaine/commande.ts';
import { gateauxDeLigne } from '../../domaine/supplements.ts';
import { controlerUnGateauParLigne, estSeparationProposee, libelleSeparation } from '../../domaine/unGateauParLigne.ts';
import { DELAIS_PAR_DEFAUT, FAMILLES_GATEAU, REGLEMENT_COMMANDE, SUPPLEMENTS_PAR_PERSONNE } from '../../domaine/constantes.ts';
import {
  choisirTaille,
  ficheDe,
  ligneVide,
  resoudreLocal,
  saisirSurLeGateau,
  separerLigneGateau,
  synchroniserSupplementsGateau,
  toucherProduit,
  versLigneSaisie,
  SUPPLEMENT_ECRITURE,
  SUPPLEMENT_PHOTO,
  type CatalogueCommande,
  type FicheCatalogue,
  type LigneEcran,
} from './modele.ts';
import { ajouterAvecPhoto } from './galerie.ts';
import { estManqueSimple, libelleManque, MOT_UN_GATEAU_PAR_LIGNE } from './manques.ts';
import type { LigneCommande } from '../../lib/commandes.ts';
import { consignesDeLigne, lignesDuBon } from '../../lib/ticketCanvas.ts';

const DATE = '2026-10-15'; // jeudi
const RETRAIT = '2026-10-16'; // vendredi
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
const BAVAROIS_6P = 'gateaux-et-tartes/bavarois/6p';
const LAYER = 'gateaux-sur-commande/layer-cake';
const BURGER = 'sur-commande/mini-burger';
const IDS = [BAVAROIS, BAVAROIS_6P, LAYER, BURGER, SUPPLEMENT_PHOTO, SUPPLEMENT_ECRITURE];
const catalogue: CatalogueCommande = { date: DATE, fiches: IDS.map(ficheCatalogue) };
const fBav6 = ficheCatalogue(BAVAROIS_6P);

const ctx: ContexteCommande = {
  resoudre: resoudreLocal(catalogue),
  joursFermes: [],
  delais: DELAIS_PAR_DEFAUT,
  reglement: { ...REGLEMENT_COMMANDE, acomptePourcentageMin: 0 },
  correspondancesComptoir: T,
  supplementEcriture: SUPPLEMENT_ECRITURE,
  supplementPhoto: SUPPLEMENT_PHOTO,
};

function saisie(lignes: readonly LigneEcran[]): CommandeSaisie {
  return {
    client: 'Client test',
    telephone: '0470123456',
    datePrise: DATE,
    heurePrise: '10:00',
    dateRetrait: RETRAIT,
    heureRetrait: '12:00',
    lignes: lignes.map((l) => versLigneSaisie(l, ficheDe(catalogue, l.produitId))),
    acompteCentimes: 0,
  };
}

const ligneSaisie = (l: LigneEcran) => versLigneSaisie(l, ficheDe(catalogue, l.produitId));

/* ------------------------------------------------------------------ Écran */

test('écran : toucher deux fois « Bavarois 6P » = DEUX gâteaux, chacun sa ligne de 1, sans pavé', () => {
  const un = toucherProduit([], fBav6, F);
  assert.equal(un.champ, 'gateau', 'aucun pavé de quantité');
  const deux = toucherProduit(un.lignes, fBav6, F);
  assert.equal(deux.lignes.length, 2);
  assert.deepEqual(deux.lignes.map((l) => l.quantite), [1, 1], 'jamais « quantité 2 »');
  assert.notEqual(deux.cle, un.cle, 'la ligne touchée est le nouveau gâteau');
  assert.equal(deux.champ, 'gateau');
});

test('écran : gâteau par personne — nouveau gâteau dès que le précédent a sa taille ; sinon on le rouvre', () => {
  const layer = ficheCatalogue(LAYER);
  const a = toucherProduit([], layer, F);
  assert.equal(toucherProduit(a.lignes, layer, F).lignes.length, 1, 'double toucher : pas de 2e gâteau vide');
  const vingt = a.lignes.map((l) => ({ ...l, quantite: 20 }));
  const b = toucherProduit(vingt, layer, F);
  assert.equal(b.lignes.length, 2);
  assert.deepEqual(b.lignes.map((l) => l.quantite), [20, null], 'les parts restent celles d’UN gâteau');
  assert.equal(b.champ, 'taille');
  // Bavarois sur commande devenu « Bavarois 6P » (R60) : un 2e toucher = un 2e Bavarois.
  const bav = choisirTaille(toucherProduit([], ficheCatalogue(BAVAROIS), F).lignes[0], 6, catalogue, T);
  const c = toucherProduit([bav], ficheCatalogue(BAVAROIS), F);
  assert.equal(c.lignes.length, 2);
  assert.equal(c.lignes[1].produitId, BAVAROIS);
});

test('écran : ce qui n’est pas un gâteau garde « un toucher = +1 » (mini-burgers)', () => {
  const burger = ficheCatalogue(BURGER);
  let lignes = toucherProduit([], burger, F).lignes;
  lignes = toucherProduit(lignes, burger, F).lignes;
  assert.equal(lignes.length, 1);
  assert.equal(lignes[0].quantite, 2);
});

test('écran : photo d’un gâteau — posée sur le gâteau qui n’en a pas ; tous en ont une → nouveau gâteau', () => {
  const photo = (id: string) => ({ id });
  const ajouter = (lignes: LigneEcran[], id: string) =>
    ajouterAvecPhoto(lignes, fBav6, photo(id), catalogue, F, SUPPLEMENTS_PAR_PERSONNE, T);
  const un = toucherProduit([], fBav6, F).lignes;
  const a = ajouter(un, 'G001');
  assert.deepEqual(a.lignes.map((l) => [l.photoModele, l.quantite]), [['G001', 1]], 'gâteau déjà au bon : la photo s’y pose');
  const b = ajouter(a.lignes, 'G001');
  assert.deepEqual(b.lignes.map((l) => [l.photoModele, l.quantite]), [['G001', 1], ['G001', 1]], 'même photo : un 2e gâteau, jamais « 2 × »');
  const c = ajouter(b.lignes, 'G002');
  assert.equal(c.lignes.length, 3);
  assert.equal(c.lignes[2].photoModele, 'G002');
  assert.equal(c.champ, 'gateau');
});

/* --------------------------------------------------- Domaine (rejoué serveur) */

test('domaine : « 2 × Bavarois 6P » refusé à la saisie, sortie « Séparer en 2 gâteaux »', () => {
  const ancienne: LigneEcran = { ...ligneVide(BAVAROIS_6P), quantite: 2 };
  const r = controlerLigne(ligneSaisie(ancienne), 3, DATE, ctx);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.niveau, 'bloquant');
  assert.equal(r.code, 'ERR_QUANTITE_INVALIDE');
  assert.equal(r.champ, 'lignes[3].quantite');
  assert.deepEqual(r.valeurProposee, { separerEn: 2 });
  assert.ok(estSeparationProposee(r.valeurProposee));
  assert.match(r.message, /2 gâteaux sur une seule ligne/);
  assert.match(r.message, /séparez-les\.$/, 'dit quoi faire (LOI 9)');
  assert.equal(libelleSeparation(2), 'Séparer en 2 gâteaux');
  // La commande entière aussi (c'est ce que le serveur rejoue).
  const c = controlerCommande(saisie([ancienne]), ctx);
  assert.equal(c.ok, false);
  if (!c.ok) assert.deepEqual(c.valeurProposee, { separerEn: 2 });
});

test('domaine n’interdit pas : 1 gâteau, deux lignes du même gâteau, 10 mini-burgers, un Layer de 30 parts', () => {
  const r = controlerCommande(
    saisie([
      { ...ligneVide(BAVAROIS_6P), quantite: 1, sansEcriture: true },
      { ...ligneVide(BAVAROIS_6P), quantite: 1, sansEcriture: true },
      { ...ligneVide(BURGER), quantite: 10 },
      { ...ligneVide(LAYER), quantite: 30, sansEcriture: true },
    ]),
    ctx,
  );
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok(!r.signalements.some((s) => s.code === 'AVERT_PRODUIT_EN_DOUBLE'), 'deux gâteaux ne sont pas « à fusionner »');
  assert.equal(controlerUnGateauParLigne({ regimePrix: 'A', basePrix: 'piece', famille: 'boulangerie', quantite: 6, produit: 'Baguette' }, F), null);
  // Une ligne = un gâteau, même une ligne ancienne de 3 : ses suppléments ne triplent pas.
  assert.equal(gateauxDeLigne({ regimePrix: 'A', basePrix: 'piece', famille: 'gateau', quantite: 3 }, F), 1);
});

/* ------------------------------------------------------------ Séparation */

test('séparer : N lignes de 1 ; goût, forme, photo, précision copiés ; écriture et photo à imprimer sur le 1er', () => {
  const ancienne: LigneEcran = {
    ...ligneVide(BAVAROIS_6P),
    quantite: 3,
    gouts: ['Vanille'],
    forme: 'rond',
    photoModele: 'G043',
    precision: 'peu sucré',
    texteGateau: 'BRAVO',
    photoImprimee: true,
  };
  const avant = { ...ligneVide(BURGER), quantite: 10 };
  const lignes = separerLigneGateau([avant, ancienne], ancienne.cle);
  assert.equal(lignes.length, 4);
  assert.equal(lignes[0], avant, 'les autres lignes ne bougent pas');
  const g = lignes.slice(1);
  assert.equal(g[0].cle, ancienne.cle, 'le 1er garde sa place et sa clé');
  assert.equal(new Set(g.map((l) => l.cle)).size, 3);
  for (const l of g) {
    assert.equal(l.quantite, 1);
    assert.deepEqual([l.produitId, l.gouts, l.forme, l.photoModele, l.precision], [BAVAROIS_6P, ['Vanille'], 'rond', 'G043', 'peu sucré']);
  }
  assert.deepEqual(g.map((l) => [l.texteGateau, l.photoImprimee]), [['BRAVO', true], ['', false], ['', false]]);
  g[1].gouts.push('X');
  assert.deepEqual(g[0].gouts, ['Vanille'], 'copies indépendantes');
  assert.deepEqual(separerLigneGateau(lignes, g[0].cle), lignes, 'ligne à 1 : rien ne change');
});

test('séparer puis valider : la commande passe, un supplément par gâteau qui porte une écriture', () => {
  const ancienne: LigneEcran = { ...ligneVide(BAVAROIS_6P), quantite: 2, texteGateau: 'LINA' };
  let lignes = synchroniserSupplementsGateau([ancienne], catalogue, F);
  const sup = () => lignes.filter((l) => l.produitId === SUPPLEMENT_ECRITURE).reduce((n, l) => n + (l.quantite ?? 0), 0);
  assert.equal(sup(), 1, 'une ligne = un gâteau : une écriture, un supplément');
  lignes = synchroniserSupplementsGateau(separerLigneGateau(lignes, ancienne.cle), catalogue, F);
  assert.equal(sup(), 1, 'séparer ne facture rien en plus');
  // Le 2e gâteau reçoit sa propre écriture : son supplément suit.
  lignes = saisirSurLeGateau(lignes, lignes[1].cle, { texteGateau: 'MARC' }, catalogue, F);
  assert.equal(sup(), 2);
  const r = controlerCommande(saisie(lignes), ctx);
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.donnees.lignes.filter((l) => l.produitId === BAVAROIS_6P).map((l) => l.texteGateau), ['LINA', 'MARC']);
});

test('séparer une ligne qui portait un supplément par gâteau : rien ne descend en silence, « Passer à 1 » proposé', () => {
  // Ligne enregistrée sous l'ancienne règle (« même texte sur chaque gâteau », 2 suppléments).
  const ancienne: LigneEcran = { ...ligneVide(BAVAROIS_6P), quantite: 2, texteGateau: 'LINA' };
  const sup: LigneEcran = { ...ligneVide(SUPPLEMENT_ECRITURE), quantite: 2 };
  const lignes = synchroniserSupplementsGateau(separerLigneGateau([ancienne, sup], ancienne.cle), catalogue, F);
  const b = blocagesCommande(saisie(lignes), ctx);
  assert.deepEqual(b.map((e) => [e.code, e.valeurProposee]), [['ERR_SUPPLEMENT_EN_TROP', 1]]);
});

test('fenêtre « Il manque » : la ligne de N gâteaux garde son bouton (pas un simple champ vide)', () => {
  const ancienne: LigneEcran = { ...ligneVide(BAVAROIS_6P), quantite: 2 };
  const r = controlerLigne(ligneSaisie(ancienne), 0, DATE, ctx);
  assert.ok(!r.ok);
  if (r.ok) return;
  assert.equal(estManqueSimple(r), false);
  assert.equal(estManqueSimple({ code: 'ERR_QUANTITE_INVALIDE' }), true, 'quantité vide : toujours un simple manque');
  const m = libelleManque(r, [ancienne], catalogue);
  assert.match(m.titre, new RegExp(`^${MOT_UN_GATEAU_PAR_LIGNE}`));
  assert.equal(m.detail, r.message);
});

/* ------------------------------------------------------------------ Bon */

test('bon : deux Bavarois 6P = deux gâteaux distincts, chacun avec son écriture', () => {
  const f = fBav6;
  const bav = (p: Partial<LigneCommande>): LigneCommande => ({
    libelle: 'Bavarois 6P',
    quantite: 1,
    prixCentimes: f.prix.prixCentimes,
    unite: 'piece',
    poste: null,
    precision: null,
    produitCatalogue: { cleCatalogue: BAVAROIS_6P, categorie: f.produit.categorie, nom: f.produit.produit, regimePrix: 'A' },
    prixProduit: { basePrix: 'piece' },
    ...p,
  });
  const c = {
    texteGateau: 'LINA · MARC',
    sansEcriture: false,
    photoImprimee: false,
    lignes: [bav({ texteGateau: 'LINA', sansEcriture: false }), bav({ texteGateau: 'MARC', sansEcriture: false, photoModele: 'G043' })],
  };
  for (const d of ['CLIENT', 'ATELIER'] as const) {
    const bon = lignesDuBon(c, d);
    assert.equal(bon.length, 2, d);
    const ecritures = bon.map((l) => consignesDeLigne(l).filter((x) => x.texte.startsWith('ÉCRITURE')).map((x) => x.texte.replace(/ /g, ' ')));
    assert.deepEqual(ecritures, [['ÉCRITURE : LINA'], ['ÉCRITURE : MARC']], d);
  }
});
