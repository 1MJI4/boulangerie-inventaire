// node --test src/components/commande/ecritureParGateau.test.ts
//
// Lot 2 — UNE ÉCRITURE PAR GÂTEAU (décision du propriétaire, 28/10/2026 : « une
// écriture par gâteau sur le bon, ça doit être clair quelle écriture pour quel
// gâteau »). Écran, domaine (rejoué au serveur), historique, bon imprimé,
// message de confirmation et lecture des commandes anciennes.
// Vrai catalogue : aucun prix en dur (LOI 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogueDepuisDossier } from '../../catalogue/chargerFichiers.ts';
import { creerApiCatalogue } from '../../catalogue/catalogue.ts';
import { CORRESPONDANCES_COMPTOIR } from '../../catalogue/correspondancesComptoir.ts';
import { blocagesCommande, controlerCommande, type CommandeSaisie, type ContexteCommande } from '../../domaine/commande.ts';
import { controlerSupplementEcriture, controlerSupplementPhoto, ecrituresAttendues } from '../../domaine/supplements.ts';
import { DELAIS_PAR_DEFAUT, FAMILLES_GATEAU, REGLEMENT_COMMANDE } from '../../domaine/constantes.ts';
import {
  choisirTaille,
  estLigneGateau,
  ficheDe,
  ligneVide,
  resoudreLocal,
  saisirSurLeGateau,
  supplementImpose,
  synchroniserSupplementsGateau,
  toucherProduit,
  versLigneSaisie,
  SUPPLEMENT_ECRITURE,
  SUPPLEMENT_PHOTO,
  type CatalogueCommande,
  type FicheCatalogue,
  type LigneEcran,
} from './modele.ts';
import { changementsLisibles, type Apres, type Existante, type LigneTexte } from './historique.ts';
import { sortieDe } from './sorties.ts';
import { ecrituresDeCommande, lignesSurLeGateau, messageConfirmation, resumeEcritures, surLesGateaux, type Commande, type LigneCommande } from '../../lib/commandes.ts';
import { consignesDeLigne, lignesDuBon, MENTION_PHOTO_A_IMPRIMER } from '../../lib/ticketCanvas.ts';

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
const LAYER = 'gateaux-sur-commande/layer-cake';
const BURGER = 'sur-commande/mini-burger';
const IDS = [BAVAROIS, 'gateaux-et-tartes/bavarois/6p', LAYER, BURGER, SUPPLEMENT_PHOTO, SUPPLEMENT_ECRITURE];
const catalogue: CatalogueCommande = { date: DATE, fiches: IDS.map(ficheCatalogue) };

const ctx: ContexteCommande = {
  resoudre: resoudreLocal(catalogue),
  joursFermes: [],
  delais: DELAIS_PAR_DEFAUT,
  reglement: { ...REGLEMENT_COMMANDE, acomptePourcentageMin: 0 },
  correspondancesComptoir: T,
  supplementEcriture: SUPPLEMENT_ECRITURE,
  supplementPhoto: SUPPLEMENT_PHOTO,
};

/** Bavarois 6 parts au bouton de taille → Bavarois 6P du comptoir (R60). */
const bavarois6 = (): LigneEcran => choisirTaille(toucherProduit([], ficheCatalogue(BAVAROIS)).lignes[0], 6, catalogue, T);
const layer20 = (): LigneEcran => ({ ...ligneVide(LAYER), quantite: 20 });
const burgers = (): LigneEcran => ({ ...ligneVide(BURGER), quantite: 10 });

const qte = (lignes: readonly LigneEcran[], id: string) =>
  lignes.filter((l) => l.produitId === id).reduce((n, l) => n + (l.quantite ?? 0), 0);

function saisie(lignes: readonly LigneEcran[], autres: Partial<CommandeSaisie> = {}): CommandeSaisie {
  return {
    client: 'Client test',
    telephone: '0470123456',
    datePrise: DATE,
    heurePrise: '10:00',
    dateRetrait: RETRAIT,
    heureRetrait: '12:00',
    lignes: lignes.map((l) => versLigneSaisie(l, ficheDe(catalogue, l.produitId))),
    acompteCentimes: 0,
    ...autres,
  };
}

/** Ligne d'une tablette d'avant le lot 2 : sans écriture ni photo par gâteau. */
function sansSurLeGateau<L extends { texteGateau?: unknown; sansEcriture?: unknown; photoImprimee?: unknown }>(l: L): L {
  const copie = { ...l };
  delete copie.texteGateau;
  delete copie.sansEcriture;
  delete copie.photoImprimee;
  return copie;
}

/* ------------------------------------------------------------------ Écran */

test('écran : chaque gâteau a son bloc « Sur le gâteau » (le salé n’en a pas)', () => {
  const lignes = [bavarois6(), burgers(), layer20()];
  assert.deepEqual(lignes.map((l) => estLigneGateau(l, catalogue, F)), [true, false, true]);
});

test('écran : deux gâteaux, deux écritures → supplément Écriture × 2, une seule ligne, non retirable', () => {
  let lignes = [bavarois6(), layer20()];
  const [a, b] = lignes;
  lignes = saisirSurLeGateau(lignes, a.cle, { texteGateau: 'J' }, catalogue, F);
  lignes = saisirSurLeGateau(lignes, a.cle, { texteGateau: 'JOYEUX ANNIVERSAIRE LINA' }, catalogue, F);
  assert.equal(qte(lignes, SUPPLEMENT_ECRITURE), 1, 'une lettre de plus n’ajoute rien');
  lignes = saisirSurLeGateau(lignes, b.cle, { texteGateau: 'BRAVO MARC' }, catalogue, F);
  assert.equal(qte(lignes, SUPPLEMENT_ECRITURE), 2, 'une fois par gâteau qui porte une écriture');
  assert.equal(lignes.filter((l) => l.produitId === SUPPLEMENT_ECRITURE).length, 1);
  const sup = lignes.find((l) => l.produitId === SUPPLEMENT_ECRITURE)!;
  assert.equal(supplementImpose(sup, lignes, catalogue, F), true, 'pas de × sur le supplément');
  assert.equal(lignes.find((l) => l.cle === a.cle)?.texteGateau, 'JOYEUX ANNIVERSAIRE LINA');
  assert.equal(lignes.find((l) => l.cle === b.cle)?.texteGateau, 'BRAVO MARC', 'chaque gâteau garde la sienne');
  // « Pas d'écriture » sur le 2e : le texte part, le supplément redescend à 1.
  lignes = saisirSurLeGateau(lignes, b.cle, { sansEcriture: true }, catalogue, F);
  assert.equal(lignes.find((l) => l.cle === b.cle)?.texteGateau, '');
  assert.equal(qte(lignes, SUPPLEMENT_ECRITURE), 1);
  // Texte vidé sur le 1er : plus aucune écriture → supplément retiré.
  lignes = saisirSurLeGateau(lignes, a.cle, { texteGateau: '   ' }, catalogue, F);
  assert.equal(qte(lignes, SUPPLEMENT_ECRITURE), 0);
  // Le domaine est d'accord à chaque étape.
  assert.deepEqual(blocagesCommande(saisie(lignes), ctx).filter((e) => e.code.includes('SUPPLEMENT')), []);
});

test('écran : supplément retiré au × ou gâteau remis → il revient tout seul ; même tableau si rien ne change', () => {
  let lignes = [bavarois6()];
  lignes = saisirSurLeGateau(lignes, lignes[0].cle, { texteGateau: 'BRAVO' }, catalogue, F);
  const sans = lignes.filter((l) => l.produitId !== SUPPLEMENT_ECRITURE);
  const remis = synchroniserSupplementsGateau(sans, catalogue, F);
  assert.equal(qte(remis, SUPPLEMENT_ECRITURE), 1);
  assert.equal(synchroniserSupplementsGateau(remis, catalogue, F), remis, 'aucune boucle de rendu');
});

test('écran : gâteau retiré → le supplément ne disparaît pas en silence (le domaine propose « Passer à 1 »)', () => {
  let lignes = [bavarois6(), layer20()];
  lignes = saisirSurLeGateau(lignes, lignes[0].cle, { texteGateau: 'A' }, catalogue, F);
  lignes = saisirSurLeGateau(lignes, lignes[1].cle, { texteGateau: 'B' }, catalogue, F);
  const sansLayer = synchroniserSupplementsGateau(lignes.filter((l) => l.produitId !== LAYER), catalogue, F);
  assert.equal(qte(sansLayer, SUPPLEMENT_ECRITURE), 2, 'rien ne descend sans un geste du vendeur');
  // Plus de suppléments que de gâteaux : R7 le refuse (un seul message), sortie en un geste.
  const b = blocagesCommande(saisie(sansLayer), ctx);
  assert.deepEqual(b.map((e) => [e.code, e.valeurProposee]), [['ERR_SUPPLEMENT_TROP_NOMBREUX', 1]]);
  assert.equal(sortieDe(b[0]).libelle, 'Passer à 1');
  // Layer Cake remis, sans écriture : deux gâteaux, une seule écriture → « Passer à 1 » aussi.
  const deuxGateaux = [...sansLayer, layer20()];
  const c = blocagesCommande(saisie(deuxGateaux), ctx).find((e) => e.code === 'ERR_SUPPLEMENT_EN_TROP');
  assert.ok(c);
  assert.equal(sortieDe(c).libelle, 'Passer à 1');
});

test('écran : photo à imprimer cochée sur deux gâteaux → supplément Photo × 2 ; décochée → retiré', () => {
  let lignes = [bavarois6(), layer20()];
  lignes = saisirSurLeGateau(lignes, lignes[0].cle, { photoImprimee: true }, catalogue, F);
  lignes = saisirSurLeGateau(lignes, lignes[1].cle, { photoImprimee: true }, catalogue, F);
  assert.equal(qte(lignes, SUPPLEMENT_PHOTO), 2);
  lignes = saisirSurLeGateau(lignes, lignes[0].cle, { photoImprimee: false }, catalogue, F);
  assert.equal(qte(lignes, SUPPLEMENT_PHOTO), 1);
  lignes = saisirSurLeGateau(lignes, lignes[1].cle, { photoImprimee: false }, catalogue, F);
  assert.equal(qte(lignes, SUPPLEMENT_PHOTO), 0);
});

test('écran : salé seul, ou supplément absent du tarif reçu → rien n’est ajouté (jamais de prix inventé)', () => {
  const sale = [burgers()];
  assert.equal(saisirSurLeGateau(sale, sale[0].cle, { texteGateau: 'BRAVO', photoImprimee: true }, catalogue, F).length, 1);
  const sansPhoto: CatalogueCommande = { ...catalogue, fiches: catalogue.fiches.filter((f) => f.produit.id !== SUPPLEMENT_PHOTO) };
  const g = [bavarois6()];
  assert.equal(qte(saisirSurLeGateau(g, g[0].cle, { photoImprimee: true }, sansPhoto, F), SUPPLEMENT_PHOTO), 0);
});

/* --------------------------------------------------- Domaine (rejoué serveur) */

test('domaine : deux écritures, un seul supplément → refus sur le 2e gâteau, sortie « Ajouter le supplément Écriture »', () => {
  const lignes: LigneEcran[] = [
    { ...bavarois6(), texteGateau: 'A' },
    { ...layer20(), texteGateau: 'B' },
    { ...ligneVide(SUPPLEMENT_ECRITURE), quantite: 1 },
  ];
  const b = blocagesCommande(saisie(lignes), ctx).find((e) => e.code === 'ERR_ECRITURE_SANS_SUPPLEMENT');
  assert.ok(b);
  assert.equal(b.champ, 'lignes[1].texteGateau', 'le gâteau dont l’écriture n’est pas payée');
  assert.equal(b.valeurProposee, SUPPLEMENT_ECRITURE);
  assert.equal(sortieDe(b).libelle, 'Ajouter le supplément Écriture');
  const ok = controlerCommande(saisie([lignes[0], lignes[1], { ...lignes[2], quantite: 2 }]), ctx);
  assert.ok(ok.ok, JSON.stringify(ok));
  assert.deepEqual(ok.donnees.lignes.map((l) => l.texteGateau ?? null), ['A', 'B', null], 'chaque gâteau garde son écriture');
});

test('domaine : jamais plus de suppléments que de gâteaux (R7), ni plus que d’écritures', () => {
  const deux: LigneEcran[] = [{ ...bavarois6(), texteGateau: 'A' }, { ...layer20(), texteGateau: 'B' }];
  const trois = blocagesCommande(saisie([...deux, { ...ligneVide(SUPPLEMENT_ECRITURE), quantite: 3 }]), ctx);
  assert.deepEqual(trois.map((e) => e.code), ['ERR_SUPPLEMENT_TROP_NOMBREUX'], 'un seul message, celui de R7');
  const uneEcriture: LigneEcran[] = [{ ...bavarois6(), texteGateau: 'A' }, layer20(), { ...ligneVide(SUPPLEMENT_ECRITURE), quantite: 2 }];
  const b = blocagesCommande(saisie(uneEcriture), ctx);
  assert.deepEqual(b.map((e) => [e.code, e.champ, e.valeurProposee]), [['ERR_SUPPLEMENT_EN_TROP', 'lignes[2].quantite', 1]]);
  // Aucune écriture du tout : « Retirer la ligne ».
  const aucune = blocagesCommande(saisie([bavarois6(), { ...ligneVide(SUPPLEMENT_ECRITURE), quantite: 1 }]), ctx);
  assert.equal(aucune[0]?.code, 'ERR_SUPPLEMENT_EN_TROP');
  assert.equal(sortieDe(aucune[0]).libelle, 'Retirer la ligne');
});

test('domaine : photo à imprimer sans son supplément → refus « Ajouter le supplément Photo » ; avec → accepté', () => {
  const lignes: LigneEcran[] = [{ ...bavarois6(), photoImprimee: true, sansEcriture: true }];
  const b = blocagesCommande(saisie(lignes), ctx).find((e) => e.code === 'ERR_PHOTO_SANS_SUPPLEMENT');
  assert.ok(b);
  assert.equal(b.champ, 'lignes[0].photoImprimee');
  assert.equal(sortieDe(b).libelle, 'Ajouter le supplément Photo');
  const ok = controlerCommande(saisie([...lignes, { ...ligneVide(SUPPLEMENT_PHOTO), quantite: 1 }]), ctx);
  assert.ok(ok.ok, JSON.stringify(ok));
  assert.equal(ok.donnees.lignes[0].photoImprimee, true);
});

test('domaine : une écriture sur une ligne qui n’est pas un gâteau n’est pas gardée, et ne coûte rien', () => {
  const r = controlerCommande(saisie([{ ...burgers(), texteGateau: 'BRAVO' }]), ctx);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.donnees.lignes[0].texteGateau, undefined);
  assert.equal(ecrituresAttendues([{ produitId: BURGER, quantite: 10, nbGateaux: 0, texteGateau: 'X' }]), 0);
  assert.deepEqual(controlerSupplementEcriture({ lignes: [{ produitId: LAYER, quantite: 20, nbGateaux: 1, texteGateau: '  ' }], supplementEcriture: SUPPLEMENT_ECRITURE }), []);
  assert.deepEqual(controlerSupplementPhoto({ lignes: [{ produitId: LAYER, quantite: 20, nbGateaux: 1 }], supplementPhoto: SUPPLEMENT_PHOTO }), []);
});

test('domaine : « écriture non précisée » demandée PAR gâteau sur commande (avertissement, champ de la ligne)', () => {
  const r = controlerCommande(saisie([layer20(), { ...layer20(), sansEcriture: true }]), ctx);
  assert.ok(r.ok, JSON.stringify(r));
  const champs = r.signalements.filter((s) => s.code === 'AVERT_ECRITURE_NON_PRECISEE').map((s) => s.champ);
  assert.deepEqual(champs, ['lignes[0].texteGateau']);
});

test('ancien format (tablette pas à jour, file hors ligne) : l’écriture de la commande va au premier gâteau', () => {
  const lignes = [burgers(), layer20(), layer20(), { ...ligneVide(SUPPLEMENT_ECRITURE), quantite: 1 }];
  // Saisie d'une tablette d'avant le lot 2 : aucune ligne ne porte d'écriture.
  const ancienne = saisie(lignes, { texteGateau: 'JOYEUX ANNIVERSAIRE' });
  const brutes = ancienne.lignes.map(sansSurLeGateau);
  const r = controlerCommande({ ...ancienne, lignes: brutes }, ctx);
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.donnees.lignes.map((l) => l.texteGateau ?? null), [null, 'JOYEUX ANNIVERSAIRE', null, null]);
  // Sans le supplément : refusé comme avant (une écriture se facture toujours).
  const sansSup = controlerCommande({ ...ancienne, lignes: brutes.slice(0, 3) }, ctx);
  assert.equal(sansSup.ok, false);
  if (!sansSup.ok) assert.equal(sansSup.code, 'ERR_ECRITURE_SANS_SUPPLEMENT');
});

/* ---------------------------------------------- Lecture des commandes, bon */

const ligneBase = (p: Partial<LigneCommande>): LigneCommande => ({
  libelle: 'Produit',
  quantite: 1,
  prixCentimes: ficheCatalogue(LAYER).prix.prixCentimes,
  unite: 'piece',
  poste: null,
  precision: null,
  ...p,
});
const layerEnregistre = (p: Partial<LigneCommande> = {}) =>
  ligneBase({
    libelle: 'Layer Cake',
    quantite: 20,
    produitCatalogue: { cleCatalogue: LAYER, categorie: ficheCatalogue(LAYER).produit.categorie, nom: ficheCatalogue(LAYER).produit.produit, regimePrix: 'C' },
    prixProduit: { basePrix: 'personne' },
    ...p,
  });
const burgerEnregistre = () =>
  ligneBase({
    libelle: 'Mini burger',
    quantite: 10,
    produitCatalogue: { cleCatalogue: BURGER, categorie: ficheCatalogue(BURGER).produit.categorie, nom: ficheCatalogue(BURGER).produit.produit, regimePrix: 'B' },
    prixProduit: { basePrix: 'piece' },
  });

test('commande ancienne : `Commande.texteGateau` se lit comme l’écriture de son premier gâteau (lecture seule)', () => {
  const ancienne = { texteGateau: 'BRAVO', sansEcriture: false, photoImprimee: true, lignes: [burgerEnregistre(), layerEnregistre(), layerEnregistre()] };
  const sur = surLesGateaux(ancienne);
  assert.deepEqual(sur.map((s) => s.texteGateau), [null, 'BRAVO', null]);
  assert.deepEqual(sur.map((s) => s.photoImprimee), [false, true, false]);
  assert.deepEqual(ecrituresDeCommande(ancienne), ['BRAVO']);
  assert.equal(ancienne.lignes[1].texteGateau, undefined, 'rien n’est réécrit');
  // Nouvelle commande : les lignes font foi, le résumé de la commande est ignoré.
  const nouvelle = { texteGateau: 'A · B', lignes: [layerEnregistre({ texteGateau: 'A', sansEcriture: false }), layerEnregistre({ texteGateau: 'B', sansEcriture: false })] };
  assert.deepEqual(ecrituresDeCommande(nouvelle), ['A', 'B']);
  assert.equal(resumeEcritures(['A', null, ' B ']), 'A · B');
  assert.equal(resumeEcritures([null, '']), null);
});

test('bon : chaque écriture SOUS son gâteau, en grand ; photo à imprimer sous son gâteau ; sans écriture, rien', () => {
  const c = {
    texteGateau: 'JOYEUX ANNIVERSAIRE LINA · BRAVO MARC',
    sansEcriture: false,
    photoImprimee: true,
    lignes: [
      layerEnregistre({ texteGateau: 'JOYEUX ANNIVERSAIRE LINA', sansEcriture: false, photoImprimee: true }),
      burgerEnregistre(),
      layerEnregistre({ texteGateau: 'BRAVO MARC', sansEcriture: false, photoImprimee: false }),
      layerEnregistre({ texteGateau: null, sansEcriture: true, photoImprimee: false }),
    ],
  };
  for (const d of ['CLIENT', 'BUREAU', 'MAGASIN', 'ATELIER'] as const) {
    const consignes = lignesDuBon(c, d).map((l) => consignesDeLigne(l));
    const ecriture = (k: number) => consignes[k].find((x) => x.texte.startsWith('ÉCRITURE'));
    assert.equal(ecriture(0)?.texte.replace(/\u00a0/g, ' '), 'ÉCRITURE : JOYEUX ANNIVERSAIRE LINA', d);
    assert.equal(ecriture(0)?.grand, true, 'en grand, clairement');
    assert.ok(consignes[0].some((x) => x.texte === MENTION_PHOTO_A_IMPRIMER), d);
    assert.equal(ecriture(1), undefined, 'le salé ne porte rien');
    assert.equal(ecriture(2)?.texte.replace(/\u00a0/g, ' '), 'ÉCRITURE : BRAVO MARC', d);
    assert.ok(!consignes[2].some((x) => x.texte === MENTION_PHOTO_A_IMPRIMER));
    assert.deepEqual(consignes[3].filter((x) => /ÉCRITURE|PHOTO/.test(x.texte)), [], 'pas d’écriture : rien d’imprimé');
  }
});

test('bon d’une commande ancienne : son écriture s’imprime sous le premier gâteau', () => {
  const c = { texteGateau: 'BRAVO', sansEcriture: false, photoImprimee: false, lignes: [burgerEnregistre(), layerEnregistre()] };
  const consignes = lignesDuBon(c, 'ATELIER').map((l) => consignesDeLigne(l).map((x) => x.texte.replace(/\u00a0/g, ' ')));
  assert.deepEqual(consignes[0].filter((t) => t.startsWith('ÉCRITURE')), []);
  assert.ok(consignes[1].includes('ÉCRITURE : BRAVO'));
});

test('message de confirmation : l’écriture sous la ligne de son gâteau', () => {
  const base = { numero: '2026-0001', retraitLe: RETRAIT, retraitHeure: '12:00', totalCentimes: 0, acompteCentimes: 0, modePaiement: 'especes' as const };
  const m = messageConfirmation({
    ...base,
    lignes: [layerEnregistre({ texteGateau: 'A', sansEcriture: false }), layerEnregistre({ texteGateau: 'B', sansEcriture: false })],
  });
  const l = m.split('\n');
  assert.ok(l.indexOf('   À écrire : « A »') === l.indexOf('• 20 × Layer Cake') + 1, m);
  assert.ok(m.includes('À écrire : « B »'));
  const ancien = messageConfirmation({ ...base, texteGateau: 'BRAVO', lignes: [burgerEnregistre(), layerEnregistre()] });
  assert.ok(ancien.includes('• 20 × Layer Cake\n   À écrire : « BRAVO »'), ancien);
});

/* -------------------------------------------------------- Réimpression */

test('réimpression : changer l’écriture ou la photo à imprimer d’UN gâteau change le bon', () => {
  const g = (p: Partial<LigneTexte>): LigneTexte => ({ libelle: 'Layer Cake', quantite: 20, prixCentimes: 1, unite: 'piece', ...p });
  const existante: Existante = {
    client: 'C', telephone: 'T', retraitLe: new Date(`${RETRAIT}T00:00:00Z`), retraitHeure: '12:00',
    texteGateau: 'A · B', zoneDessin: false, totalCentimes: 1, acompteCentimes: 0, remarques: null,
    photoImprimee: false, photoWhatsapp: false, demandeInhabituelle: false, modePaiement: 'especes',
    lignes: [g({ texteGateau: 'A' }), g({ texteGateau: 'B' })],
  };
  const apres: Apres = { ...existante, dateRetrait: RETRAIT, heureRetrait: '12:00' };
  assert.deepEqual(changementsLisibles(existante, apres, existante.lignes), []);
  // Écritures échangées entre les deux gâteaux : même résumé possible, mais le bon change.
  assert.ok(changementsLisibles(existante, apres, [g({ texteGateau: 'B' }), g({ texteGateau: 'A' })]).length > 0);
  assert.ok(changementsLisibles(existante, apres, [g({ texteGateau: 'A' }), g({ texteGateau: 'B', photoImprimee: true })]).length > 0);
  // « Pas d'écriture » coché sur un gâteau qui n'en avait pas : rien d'imprimé ne change.
  assert.deepEqual(changementsLisibles(existante, apres, [g({ texteGateau: 'A' }), g({ texteGateau: 'B', sansEcriture: false })]), []);
});

test('réimpression : commande ancienne relue par gâteau, rien d’autre changé → pas de faux « à réimprimer »', () => {
  const ancienne = { texteGateau: 'BRAVO', sansEcriture: false, photoImprimee: false, lignes: [burgerEnregistre(), layerEnregistre()] };
  const avant = lignesSurLeGateau(ancienne);
  const existante: Existante = {
    client: 'C', telephone: 'T', retraitLe: new Date(`${RETRAIT}T00:00:00Z`), retraitHeure: '12:00',
    texteGateau: 'BRAVO', zoneDessin: false, totalCentimes: 1, acompteCentimes: 0, remarques: null,
    photoImprimee: false, photoWhatsapp: false, demandeInhabituelle: false, modePaiement: 'especes',
    lignes: avant.map((l) => ({ ...l, unite: l.unite ?? 'piece' })),
  };
  const apres: Apres = { ...existante, dateRetrait: RETRAIT, heureRetrait: '12:00' };
  // Après enregistrement au nouveau format : l'écriture est sur le Layer Cake.
  const lignesApres = [
    { ...burgerEnregistre(), unite: 'piece', texteGateau: null, sansEcriture: null, photoImprimee: null },
    { ...layerEnregistre(), unite: 'piece', texteGateau: 'BRAVO', sansEcriture: false, photoImprimee: false },
  ];
  assert.deepEqual(changementsLisibles(existante, apres, lignesApres), []);
});

/* Type d'une commande complète : `depuisApi` fournit les lignes relues (contrôle de compilation). */
export type _Verif = Commande['lignes'][number]['texteGateau'];
