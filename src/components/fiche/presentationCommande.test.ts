// node --test src/components/fiche/presentationCommande.test.ts
//
// Présentation d'une commande à l'écran (refonte de l'accueil vendeur et de la
// liste, 28/10/2026) : résumé compact mais complet, écriture par gâteau ou par
// commande, compte par type tiré du rayon, tri par heure, groupes de la liste,
// libellés « Retirée par le client ». Montants : aucun (prix à 0, LOI 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Commande, LigneCommande } from '../../lib/commandes.ts';
import {
  chercherCommandes,
  compterParType,
  ecritureDeCommande,
  infosParGateau,
  filtrerParType,
  grouperCommandes,
  heureLisible,
  LIBELLE_STATUT_ECRAN,
  ligneAffichee,
  lienTelephone,
  resumeCommande,
  texteAutres,
  trierParHeure,
} from './presentationCommande.ts';

const GATEAUX = 'Tarifs (minimum) pour les Gâteaux SIMPLES sur commande';

function ligne(l: Partial<LigneCommande> & { libelle: string }): LigneCommande {
  return { quantite: 1, prixCentimes: 0, poste: null, precision: null, ...l };
}

const layer = ligne({
  libelle: 'Layer Cake',
  quantite: 20,
  gouts: ['Framboise'],
  forme: 'rond',
  photoModele: 'G043',
  precision: 'Bougies à part',
  produitCatalogue: { cleCatalogue: 'gateaux-sur-commande/layer-cake', categorie: GATEAUX, nom: 'Layer Cake', regimePrix: 'C' },
  prixProduit: { basePrix: 'personne' },
});
const ecritureSupp = ligne({
  libelle: 'Supplément Écriture',
  produitCatalogue: { cleCatalogue: 'gateaux-sur-commande/supplement', categorie: GATEAUX, nom: 'Supplément', regimePrix: 'C' },
  prixProduit: { basePrix: 'forfait' },
});
const pistolets = ligne({
  libelle: 'Pistolet',
  quantite: 12,
  produitCatalogue: { cleCatalogue: 'boulangerie/pistolet', categorie: 'Boulangerie', nom: 'Pistolet', regimePrix: 'A' },
  prixProduit: { basePrix: 'piece' },
});
const miniPizza = ligne({
  libelle: 'Mini pizza',
  quantite: 10,
  produitCatalogue: { cleCatalogue: 'sur-commande/mini-pizza', categorie: 'Sur commande', nom: 'Mini pizza', regimePrix: 'B' },
  prixProduit: { basePrix: 'piece' },
});
const gazelle = ligne({
  libelle: 'Corne de gazelle',
  quantite: 750,
  unite: 'kg',
  produitCatalogue: { cleCatalogue: 'oriental/corne-de-gazelle', categorie: 'Oriental', nom: 'Corne de gazelle', regimePrix: 'A' },
});

function commande(c: Partial<Commande>): Commande {
  return {
    id: 1,
    numero: '2026-0001',
    client: 'Dupont',
    telephone: '0470 12 34 56',
    vendeur: 'Test',
    priseLe: '2026-10-28T08:00:00Z',
    origine: 'comptoir',
    retraitLe: '2026-10-29',
    retraitHeure: '14:30',
    modePaiement: 'especes',
    acompteCentimes: 0,
    acompteRecuLe: null,
    totalCentimes: 0,
    texteGateau: null,
    sansEcriture: false,
    photoWhatsapp: false,
    photoImprimee: false,
    remarques: null,
    statut: 'imprimee',
    imprimeeLe: null,
    remiseLe: null,
    avertissements: [],
    anonymiseeLe: null,
    lignes: [],
    ...c,
  };
}

test('statut à l’écran : « Retirée par le client », jamais « Remise »', () => {
  assert.equal(LIBELLE_STATUT_ECRAN.remise, 'Retirée par le client');
  for (const l of Object.values(LIBELLE_STATUT_ECRAN)) assert.doesNotMatch(l, /remise/i);
});

test('heure : « 14:30 » se lit « 14h30 », vide → null', () => {
  assert.equal(heureLisible('14:30'), '14h30');
  assert.equal(heureLisible('09:05'), '9h05');
  assert.equal(heureLisible(''), null);
  assert.equal(heureLisible(null), null);
});

test('ligne par personne : « 20 parts », goût, forme, photo, précision, sans capitales', () => {
  const a = ligneAffichee(layer);
  assert.equal(a.quantite, '20 parts');
  assert.equal(a.libelle, 'Layer Cake');
  assert.deepEqual(a.details, ['Framboise', 'Rond', 'Photo G043', 'Bougies à part']);
  assert.equal(a.supplement, false);
});

test('ligne à la pièce « 12 × » ; au kilo « 0,750 kg », jamais « +1 » (LOI 2)', () => {
  assert.equal(ligneAffichee(pistolets).quantite, '12 ×');
  assert.equal(ligneAffichee(gazelle).quantite, '0,750 kg');
});

test('pièce montée : un goût par étage ; Number Cake : « chiffres ou lettres »', () => {
  const a = ligneAffichee(ligne({ libelle: 'Pièce montée 2 étages', gouts: ['Vanille', 'Chocolat noir'] }));
  assert.deepEqual(a.details, ['Étage 1 : Vanille', 'Étage 2 : Chocolat noir']);
  const n = ligneAffichee(ligne({ libelle: 'Number Cake', formes: '25' }));
  assert.deepEqual(n.details, ['Chiffres ou lettres : 25']);
});

test('Bavarois goût Fraisier se dit « Fraisier », sans répéter le goût', () => {
  const a = ligneAffichee(
    ligne({ libelle: 'Bavarois', gouts: ['Fraisier'], produitCatalogue: { cleCatalogue: 'gateaux-sur-commande/bavarois' } }),
  );
  assert.equal(a.libelle, 'Fraisier');
  assert.deepEqual(a.details, []);
});

test('écriture par gâteau (ligne) prioritaire sur celle de la commande', () => {
  const parLigne = { ...layer, texteGateau: 'Joyeux anniversaire Léa' } as LigneCommande;
  assert.deepEqual(ligneAffichee(parLigne).details.at(-2), 'Écriture : « Joyeux anniversaire Léa »');
  const c = commande({ texteGateau: 'Ancienne', lignes: [parLigne] });
  assert.equal(ecritureDeCommande(c), null);
  assert.equal(ecritureDeCommande(commande({ texteGateau: ' Bravo ', lignes: [layer] })), 'Bravo');
});

test('résumé : gâteaux avant suppléments, écriture de commande sur le gâteau, « et N autres »', () => {
  const c = commande({ texteGateau: 'Bravo', lignes: [ecritureSupp, layer, pistolets, miniPizza] });
  const r = resumeCommande(c, 2);
  assert.deepEqual(r.lignes.map((l) => l.libelle), ['Layer Cake', 'Pistolet']);
  assert.ok(r.lignes[0].details.includes('Écriture : « Bravo »'));
  assert.equal(r.autres, 2);
  assert.equal(texteAutres(r.autres), 'et 2 autres articles');
  assert.equal(texteAutres(1), 'et 1 autre article');
  assert.equal(texteAutres(0), '');
  assert.equal(resumeCommande(commande({ lignes: [] })).autres, 0);
});

test('compte par type : tiré du rayon, une commande mixte compte dans chaque type', () => {
  const liste = [
    commande({ id: 1, lignes: [layer, pistolets] }),
    commande({ id: 2, lignes: [miniPizza] }),
    commande({ id: 3, lignes: [ligne({ libelle: 'Ligne libre' })] }),
  ];
  assert.deepEqual(compterParType(liste), { tout: 3, patisserie: 1, sale: 1, boulangerie: 1 });
  assert.deepEqual(filtrerParType(liste, 'boulangerie').map((c) => c.id), [1]);
  assert.equal(filtrerParType(liste, null).length, 3);
});

test('le nom ne donne pas le type : « Layer Cake » sans rayon ne compte nulle part', () => {
  assert.deepEqual(compterParType([commande({ lignes: [ligne({ libelle: 'Layer Cake' })] })]), {
    tout: 1,
    patisserie: 0,
    sale: 0,
    boulangerie: 0,
  });
});

test('tri par heure : sans heure en dernier, puis par numéro ; liste reçue inchangée', () => {
  const liste = [
    commande({ numero: 'c', retraitHeure: null }),
    commande({ numero: 'b', retraitHeure: '9:00' }),
    commande({ numero: 'a', retraitHeure: '14:30' }),
    commande({ numero: 'd', retraitHeure: '09:00' }),
  ];
  assert.deepEqual(trierParHeure(liste).map((c) => c.numero), ['b', 'd', 'a', 'c']);
  assert.equal(liste[0].numero, 'c');
});

test('groupes de la liste : à imprimer, virements, retard, aujourd’hui, à venir', () => {
  const j = '2026-10-28';
  const liste = [
    commande({ id: 1, statut: 'a_imprimer', retraitLe: j }),
    commande({ id: 2, statut: 'imprimee', retraitLe: '2026-10-27' }),
    commande({ id: 3, statut: 'imprimee', retraitLe: j }),
    commande({ id: 4, statut: 'imprimee', retraitLe: '2026-10-30', modePaiement: 'virement' }),
  ];
  const g = grouperCommandes(liste, j);
  assert.deepEqual(g.aImprimer.map((c) => c.id), [1]);
  assert.deepEqual(g.enRetard.map((c) => c.id), [2]);
  assert.deepEqual(g.duJour.map((c) => c.id), [3]);
  assert.deepEqual(g.aVenir.map((c) => c.id), [4]);
  assert.deepEqual(g.virements.map((c) => c.id), [4]);
});

test('recherche : nom, numéro, téléphone avec ou sans espaces', () => {
  const liste = [commande({ id: 1 }), commande({ id: 2, client: 'Martin', numero: '2026-0002', telephone: '02 123 45 67' })];
  assert.deepEqual(chercherCommandes(liste, 'mart').map((c) => c.id), [2]);
  assert.deepEqual(chercherCommandes(liste, '0001').map((c) => c.id), [1]);
  assert.deepEqual(chercherCommandes(liste, '0470123').map((c) => c.id), [1]);
  assert.equal(chercherCommandes(liste, '  ').length, 2);
});

test('lien téléphone : chiffres et « + » seulement ; rien d’appelable → null', () => {
  assert.equal(lienTelephone('0470 12 34 56'), 'tel:0470123456');
  assert.equal(lienTelephone('+32 2 123 45 67'), 'tel:+3221234567');
  assert.equal(lienTelephone('anonyme'), null);
});

test('photo à imprimer sur un gâteau (lot 2) : dite sur sa ligne ; infos par gâteau détectées', () => {
  const avecPhoto = { ...layer, photoImprimee: true } as LigneCommande;
  assert.ok(ligneAffichee(avecPhoto).details.includes('Photo à imprimer'));
  assert.equal(infosParGateau(commande({ lignes: [avecPhoto] })), true);
  assert.equal(infosParGateau(commande({ lignes: [layer] })), false);
});
