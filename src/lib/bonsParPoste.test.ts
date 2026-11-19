// node --test src/lib/bonsParPoste.test.ts
//
// R74 — un papier par poste (propriétaire, 19/11/2026) : en plus des bons
// CLIENT, BUREAU et MAGASIN (complets), un bon de PRODUCTION par poste concerné
// — PÂTISSIER, ATELIER, BOULANGER — avec ses seules lignes, sans prix, et pour
// le boulanger son échéance (2 heures avant le retrait).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogueDepuisDossier } from '../catalogue/chargerFichiers.ts';
import type { Commande, LigneCommande } from './commandes.ts';
import {
  DESTINATIONS,
  LIBELLE_DESTINATION,
  autresPostesDuBon,
  consignesDeLigne,
  dessinerSurContexte,
  destinationsDeCommande,
  echeanceDuBon,
  estBonDeProduction,
  lignesDuBon,
  type Destination,
} from './ticketCanvas.ts';

const produits = [...chargerCatalogueDepuisDossier().catalogue.produits.values()];
function ligne(cle: string | null, quantite: number, partiel: Partial<LigneCommande> = {}): LigneCommande {
  const p = cle ? produits.find((x) => x.id === cle) : null;
  if (cle) assert.ok(p, `${cle} absent du catalogue`);
  return {
    libelle: p ? [p.produit, p.sousCategorie].filter(Boolean).join(' ') : 'Demande libre',
    quantite,
    prixCentimes: 100, // prix de test : seul le fait qu'il s'imprime ou non est vérifié
    unite: 'piece',
    poste: null,
    precision: null,
    produitCatalogue: p ? { cleCatalogue: p.id, categorie: p.categorie, nom: p.produit, regimePrix: p.regimePrix } : null,
    prixProduit: { basePrix: 'piece' },
    ...partiel,
  } as LigneCommande;
}
const EAU = produits.find((p) => p.categorie === 'Frigo-Boisson')!.id;
const BURGER = ligne('sur-commande/mini-burger', 15, { gouts: ['Kefta'] });
const FRAISIER = ligne('gateaux-et-tartes/fraisier/6p', 1, { forme: 'rond', texteGateau: 'BRAVO' });
const WRAP = ligne('sur-commande/mini-wrap', 10);
const BOISSON = ligne(EAU, 6);

function commande(lignes: LigneCommande[], partiel: Partial<Commande> = {}): Commande {
  return {
    id: 1,
    numero: '2026-0042',
    client: 'Client test',
    telephone: '0470 00 00 00',
    vendeur: 'Nadia',
    priseLe: '2026-11-19T10:00:00.000Z',
    origine: 'comptoir',
    retraitLe: '2026-11-21',
    retraitHeure: '10:00',
    modePaiement: 'especes',
    acompteCentimes: 500,
    acompteRecuLe: null,
    totalCentimes: 4000,
    texteGateau: null,
    sansEcriture: false,
    photoWhatsapp: false,
    photoImprimee: false,
    demandeInhabituelle: false,
    remarques: 'ALLERGIE fruits à coque',
    statut: 'enregistree',
    imprimeeLe: null,
    remiseLe: null,
    avertissements: [],
    anonymiseeLe: null,
    lignes,
    ...partiel,
  } as Commande;
}
const MIXTE = commande([BURGER, FRAISIER, WRAP, BOISSON]);
const propre = (t: string) => t.replace(/ /g, ' ');

function tracer(destination: Destination, c: Commande): string[] {
  const traces: string[] = [];
  const taille = (font: string) => Number(/(\d+)px/.exec(font)?.[1] ?? 16);
  const ctx: Record<string, unknown> = {
    font: '',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    textBaseline: 'top',
    save() {},
    restore() {},
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    setLineDash() {},
    measureText(t: string) {
      return { width: t.length * taille(String(ctx.font)) * 0.6 };
    },
    fillText(t: string) {
      traces.push(propre(t));
    },
  };
  dessinerSurContexte(ctx as unknown as CanvasRenderingContext2D, destination, c);
  return traces;
}

test('papiers d’une commande : CLIENT, MAGASIN, puis un bon par poste concerné — plus de bon BUREAU (propriétaire, 19/11/2026)', () => {
  assert.deepEqual([...DESTINATIONS], ['CLIENT', 'BUREAU', 'MAGASIN', 'PATISSIER', 'ATELIER', 'BOULANGER']);
  assert.deepEqual(destinationsDeCommande(MIXTE), ['CLIENT', 'MAGASIN', 'PATISSIER', 'ATELIER', 'BOULANGER']);
  // Pâtisserie seule : plus de bon ATELIER (demande du propriétaire).
  assert.deepEqual(destinationsDeCommande(commande([FRAISIER])), ['CLIENT', 'MAGASIN', 'PATISSIER']);
  assert.deepEqual(destinationsDeCommande(commande([WRAP])), ['CLIENT', 'MAGASIN', 'ATELIER']);
  // Rien à produire (boissons) : les deux bons complets, aucun bon de production.
  assert.deepEqual(destinationsDeCommande(commande([BOISSON])), ['CLIENT', 'MAGASIN']);
  assert.deepEqual(DESTINATIONS.filter(estBonDeProduction), ['PATISSIER', 'ATELIER', 'BOULANGER']);
  assert.equal(LIBELLE_DESTINATION.PATISSIER, 'PÂTISSIER');
});

test('lignes : chaque bon de production n’a que les lignes de son poste, sans prix ; les bons complets ne changent pas', () => {
  const noms = (d: Destination) => lignesDuBon(MIXTE, d).map((l) => l.libelle);
  assert.deepEqual(noms('PATISSIER'), [FRAISIER.libelle]);
  assert.deepEqual(noms('ATELIER'), [BURGER.libelle, WRAP.libelle]);
  assert.deepEqual(noms('BOULANGER'), [BURGER.libelle]);
  for (const d of ['CLIENT', 'BUREAU', 'MAGASIN'] as const) {
    assert.deepEqual(noms(d), [BURGER.libelle, FRAISIER.libelle, WRAP.libelle, BOISSON.libelle], d);
    assert.ok(lignesDuBon(MIXTE, d).every((l) => l.prix !== ''), `${d} : prix imprimés`);
  }
  for (const d of ['PATISSIER', 'ATELIER', 'BOULANGER'] as const) {
    assert.ok(lignesDuBon(MIXTE, d).every((l) => l.prix === '' && l.prixUnitaire === null), `${d} : aucun prix`);
  }
});

test('consignes : le boulanger lit ce qu’il doit faire ; l’atelier sait que le pain arrive et quand', () => {
  const consignes = (d: Destination, i = 0) => consignesDeLigne(lignesDuBon(MIXTE, d)[i]).map((c) => propre(c.texte));
  assert.ok(consignes('BOULANGER').includes('À FAIRE : LE PAIN'), JSON.stringify(consignes('BOULANGER')));
  assert.ok(consignes('ATELIER').includes('Pain : boulanger, prêt à 8h00'), JSON.stringify(consignes('ATELIER')));
  assert.ok(consignes('ATELIER').includes('VIANDE : KEFTA'));
  // Le pâtissier garde tout ce qui décrit son gâteau.
  const p = consignes('PATISSIER');
  assert.ok(p.includes('FORME : ROND') && p.some((t) => t.startsWith('ÉCRITURE')), JSON.stringify(p));
});

test('échéance : « PRÊT POUR 8h00 » pour le boulanger (retrait 10h00), rien pour les autres ; la veille après minuit', () => {
  assert.equal(echeanceDuBon(MIXTE, 'BOULANGER'), 'PRÊT POUR 8h00');
  assert.equal(echeanceDuBon(MIXTE, 'ATELIER'), null);
  assert.equal(echeanceDuBon(MIXTE, 'PATISSIER'), null);
  assert.equal(echeanceDuBon(MIXTE, 'MAGASIN'), null);
  assert.equal(echeanceDuBon(commande([BURGER], { retraitHeure: '06:30' }), 'BOULANGER'), 'PRÊT POUR 4h30');
  assert.equal(propre(echeanceDuBon(commande([BURGER], { retraitHeure: '01:00' }), 'BOULANGER') ?? ''), 'PRÊT POUR 23h00 LA VEILLE (20/11)');
  assert.equal(echeanceDuBon(commande([BURGER], { retraitHeure: null }), 'BOULANGER'), null);
});

test('autres postes : chaque bon de production cite qui d’autre travaille sur la commande', () => {
  assert.equal(autresPostesDuBon(MIXTE, 'BOULANGER'), 'Aussi : pâtissier, atelier');
  assert.equal(autresPostesDuBon(MIXTE, 'PATISSIER'), 'Aussi : atelier, boulanger');
  assert.equal(autresPostesDuBon(commande([FRAISIER]), 'PATISSIER'), null);
  assert.equal(autresPostesDuBon(MIXTE, 'MAGASIN'), null);
});

test('bon imprimé BOULANGER : titre, échéance en clair, remarques, ses lignes — ni prix, ni total, ni les autres lignes', () => {
  const t = tracer('BOULANGER', MIXTE);
  assert.ok(t.includes('B O U L A N G E R'), t.join(' | '));
  assert.ok(t.includes('PRÊT POUR 8h00'));
  assert.ok(t.some((x) => x.includes('ALLERGIE fruits à coque')), 'les remarques restent sur le bon de production');
  assert.ok(t.some((x) => x.includes(BURGER.libelle)));
  assert.ok(!t.some((x) => x.includes(FRAISIER.libelle) || x.includes(WRAP.libelle)), 'pas les lignes des autres postes');
  assert.ok(!t.some((x) => /€/.test(x)), `aucun montant : ${t.filter((x) => /€/.test(x)).join(' | ')}`);
  assert.ok(!t.some((x) => /^(TOTAL|ACOMPTE|RESTANT DÛ)$/i.test(x)));
  assert.ok(t.includes('Aussi : pâtissier, atelier'));
});

test('bon imprimé PÂTISSIER : titre avec l’accent ; bon MAGASIN : complet, avec les montants', () => {
  assert.ok(tracer('PATISSIER', MIXTE).includes('P Â T I S S I E R'));
  const m = tracer('MAGASIN', MIXTE);
  assert.ok(m.some((x) => /€/.test(x)));
  // Un libellé long passe à la ligne sur le papier : on relit le bon d'un trait.
  const texte = m.join(' ');
  for (const l of [BURGER, FRAISIER, WRAP, BOISSON]) assert.ok(texte.includes(l.libelle), l.libelle);
});
