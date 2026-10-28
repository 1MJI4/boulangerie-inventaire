// node --test src/components/commande/audit2810.test.ts
//
// Audit UX du 28/10/2026, lot 1 « prise de commande » : chaque correction a
// son test. Fiches de TEST, montants fictifs (aucun prix du catalogue, LOI 1).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { blocagesCommande, controlerCommande, controlerLigne, type CommandeSaisie, type ContexteCommande } from '../../domaine/commande.ts';
import { compterSymboles, symbolesDuTexte } from '../../domaine/minimums.ts';
import { controlerSupplementEcriture } from '../../domaine/supplements.ts';
import { DELAIS_PAR_DEFAUT, REGLEMENT_COMMANDE, SUPPLEMENT_ECRITURE } from '../../domaine/constantes.ts';
import { GOUT_AU_CHOIX } from '../../domaine/gouts.ts';
import {
  basculerFormesLibres,
  basculerSupplement,
  choisirNombreSymboles,
  ecrireChiffresOuLettres,
  gateauxAuBon,
  ligneVide,
  resoudreLocal,
  saisirSurLeGateau,
  supplementImpose,
  synchroniserSupplementsGateau,
  versLigneSaisie,
  type CatalogueCommande,
  type FicheCatalogue,
  type LigneEcran,
} from './modele.ts';
import { changementsLisibles, detailModification, MARQUEUR_REIMPRESSION, type Apres, type Existante, type LigneTexte } from './historique.ts';
import { libelleManque } from './manques.ts';
import { sortieDe } from './sorties.ts';

const DATE = '2026-10-15'; // jeudi
const RETRAIT = '2026-10-16'; // vendredi
const PRIX = 500; // fictif
const GERANT = { par: 'Gérant', le: '2026-10-15T09:00:00.000Z' };

const NUMBER = 'c/number';
const LAYER = 'c/layer';
const number: FicheCatalogue = {
  produit: { id: NUMBER, produit: 'Number Cake', sousCategorie: '', unite: 'piece', regimePrix: 'C', famille: 'patisserie', categorie: 'Gâteaux', estFavori: false },
  prix: { prixCentimes: PRIX, basePrix: 'personne', prixEstPlancher: true, minQuantite: null, minParSymbole: 15, maxParUnite: null },
};
const layer: FicheCatalogue = {
  produit: { id: LAYER, produit: 'Layer Cake', sousCategorie: '', unite: 'piece', regimePrix: 'C', famille: 'patisserie', categorie: 'Gâteaux', estFavori: false },
  prix: { prixCentimes: PRIX, basePrix: 'personne', prixEstPlancher: true, minQuantite: 20, minParSymbole: null, maxParUnite: null },
};
const ecriture: FicheCatalogue = {
  produit: { id: SUPPLEMENT_ECRITURE, produit: 'Écriture simple', sousCategorie: '', unite: 'piece', regimePrix: 'C', famille: 'supplement', categorie: 'Gâteaux', estFavori: false },
  prix: { prixCentimes: PRIX, basePrix: 'forfait', prixEstPlancher: false, minQuantite: null, minParSymbole: null, maxParUnite: null },
};
const cat: CatalogueCommande = { date: DATE, fiches: [number, layer, ecriture] };
const FAMILLES = ['patisserie'];

const ctx: ContexteCommande = {
  resoudre: resoudreLocal(cat),
  joursFermes: [],
  delais: DELAIS_PAR_DEFAUT,
  reglement: REGLEMENT_COMMANDE,
  correspondancesComptoir: [],
  supplementEcriture: SUPPLEMENT_ECRITURE,
};

const commande = (lignes: CommandeSaisie['lignes'], autres: Partial<CommandeSaisie> = {}): CommandeSaisie => ({
  client: 'Client test',
  telephone: '0470123456',
  datePrise: DATE,
  heurePrise: '10:00',
  dateRetrait: RETRAIT,
  heureRetrait: '12:00',
  lignes,
  acompteCentimes: 0,
  ...autres,
});

// ===================================================================== 1. Réimpression

const LIGNE: LigneTexte = {
  libelle: 'Layer Cake', quantite: 20, prixCentimes: PRIX, unite: 'piece',
  gouts: ['Vanille'], decorations: [], formes: null, nbSymboles: null, precision: null, nbObjets: null,
};
const EXISTANTE: Existante = {
  client: 'Client test', telephone: '0470123456', retraitLe: new Date(`${RETRAIT}T00:00:00Z`), retraitHeure: '12:00',
  texteGateau: null, zoneDessin: false, totalCentimes: 20 * PRIX, acompteCentimes: 0,
  remarques: null, photoImprimee: false, photoWhatsapp: false, demandeInhabituelle: false, modePaiement: 'especes',
  lignes: [LIGNE],
};
const APRES: Apres = {
  client: EXISTANTE.client, telephone: EXISTANTE.telephone, dateRetrait: RETRAIT, heureRetrait: '12:00',
  texteGateau: null, zoneDessin: false, totalCentimes: EXISTANTE.totalCentimes, acompteCentimes: 0,
  remarques: null, photoImprimee: false, photoWhatsapp: false, demandeInhabituelle: false, modePaiement: 'especes',
};

test('1. rien d’imprimé ne change → aucun changement (pas de réimpression)', () => {
  assert.deepEqual(changementsLisibles(EXISTANTE, APRES, [LIGNE]), []);
  assert.equal(detailModification([], false), 'aucun changement');
});

test('1. tout champ imprimé compte : goût, déco, chiffres, précision, remarques, photos, demande inhabituelle', () => {
  const casLigne: Partial<LigneTexte>[] = [
    { gouts: ['Chocolat caramel'] },
    { decorations: ['Oreo'] },
    { formes: '25' },
    { nbSymboles: 2 },
    { precision: 'peu sucré' },
    { nbObjets: 30 },
    { photoModele: 'G043' },
    // Lot 2 (28/10/2026) : écriture et photo à imprimer d'UN gâteau.
    { texteGateau: 'JOYEUX ANNIVERSAIRE LINA' },
    { photoImprimee: true },
  ];
  for (const c of casLigne) {
    assert.ok(changementsLisibles(EXISTANTE, APRES, [{ ...LIGNE, ...c }]).length > 0, JSON.stringify(c));
  }
  const casCommande: Partial<Apres>[] = [
    { remarques: 'Allergie noix' },
    { photoImprimee: true },
    { photoWhatsapp: true },
    { demandeInhabituelle: true },
    { modePaiement: 'virement' },
    { texteGateau: 'JOYEUX ANNIVERSAIRE' },
  ];
  for (const c of casCommande) {
    assert.ok(changementsLisibles(EXISTANTE, { ...APRES, ...c }, [LIGNE]).length > 0, JSON.stringify(c));
  }
});

test('1. marqueur « à réimprimer » en tête, jamais coupé même au-delà de 2000 caractères', () => {
  const enorme = Array.from({ length: 300 }, (_, i) => `produit numéro ${i} changé`);
  const d = detailModification(enorme, true);
  assert.ok(d.startsWith(MARQUEUR_REIMPRESSION));
  assert.ok(d.length <= 2000);
  assert.ok(d.includes('à réimprimer'), 'lu par modifieeApresImpression (bon imprimé)');
  assert.ok(!detailModification(['client'], false).includes(MARQUEUR_REIMPRESSION));
});

// ===================================================================== 3. Number Cake

test('3. le nombre de chiffres ou lettres suit le texte : « 2 5 », « 2-5 », « 25 » → 2', () => {
  for (const t of ['25', '2 5', '2-5', ' 2 . 5 ']) assert.equal(compterSymboles(t), 2, t);
  assert.equal(symbolesDuTexte(''), null);
  assert.equal(symbolesDuTexte('cœur + 1', true), null, 'autre dessin : non compté');
  const l = { ...ligneVide(NUMBER), nbSymboles: 1 };
  assert.deepEqual(ecrireChiffresOuLettres(l, '2 5'), { formes: '2 5', nbSymboles: 2 });
});

test('3. toucher « 1 » après « 25 » : le texte est vidé (jamais 1 avec « 25 »)', () => {
  const l = { ...ligneVide(NUMBER), nbSymboles: 2, formes: '25' };
  assert.deepEqual(choisirNombreSymboles(l, 1), { nbSymboles: 1, formes: '' });
  assert.deepEqual(choisirNombreSymboles(l, 2), { nbSymboles: 2 }, 'même nombre : texte gardé');
  // Décocher « Autre dessin » recompte le texte.
  assert.deepEqual(basculerFormesLibres({ ...l, formesLibres: true, nbSymboles: 1 }, false), { formesLibres: false, nbSymboles: 2 });
});

test('3. domaine (rejoué serveur) : « 25 » déclaré 1 chiffre, 15 parts → refus « Passer à 30 parts »', () => {
  const l: LigneEcran = { ...ligneVide(NUMBER), nbSymboles: 1, formes: '25', quantite: 15, gouts: ['Vanille'] };
  const saisie = versLigneSaisie(l, number);
  assert.equal(saisie.formes, '25', 'le texte part au domaine et au serveur');
  const r = controlerLigne(saisie, 0, DATE, ctx);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, 'ERR_QUANTITE_MIN');
  assert.equal(r.valeurProposee, 30);
  assert.match(r.message, /2 chiffres ou lettres/);
  assert.doesNotMatch(r.message, /symbole/);
  assert.equal(sortieDe(r, 'parts').libelle, 'Passer à 30 parts');
  const ok = controlerLigne({ ...saisie, quantite: 30 }, 0, DATE, ctx);
  assert.ok(ok.ok, JSON.stringify(ok));
  assert.equal(ok.donnees.nbSymboles, 2, 'enregistré : 2, pas 1');
  // Autre dessin : le nombre déclaré reste juge.
  const libre = controlerLigne({ ...saisie, formes: 'cœur 1', formesLibres: true, nbSymboles: 2, quantite: 30 }, 0, DATE, ctx);
  assert.ok(libre.ok);
});

// ===================================================================== 4. Supplément écriture

/** Ligne d'une tablette d'avant le lot 2 : sans écriture ni photo par gâteau. */
function sansSurLeGateau<L extends { texteGateau?: unknown; sansEcriture?: unknown; photoImprimee?: unknown }>(l: L): L {
  const copie = { ...l };
  delete copie.texteGateau;
  delete copie.sansEcriture;
  delete copie.photoImprimee;
  return copie;
}

const layer20: LigneEcran = { ...ligneVide(LAYER), quantite: 20, gouts: ['Vanille'] };

test('4. écriture + gâteau sans supplément : refus bloquant avec sortie « Ajouter le supplément Écriture »', () => {
  // Ancien format (écriture de la commande) : elle va au premier gâteau (lot 2, 28/10/2026).
  const sans = commande([versLigneSaisie(layer20, layer)].map(sansSurLeGateau), {
    texteGateau: 'JOYEUX ANNIVERSAIRE',
  });
  const b = blocagesCommande(sans, ctx).find((e) => e.code === 'ERR_ECRITURE_SANS_SUPPLEMENT');
  assert.ok(b);
  assert.equal(b.champ, 'lignes[0].texteGateau', 'sous le gâteau qui porte l’écriture');
  // Nouveau format : l'écriture est sur la ligne.
  const parGateau = commande([versLigneSaisie({ ...layer20, texteGateau: 'JOYEUX ANNIVERSAIRE' }, layer)]);
  assert.equal(blocagesCommande(parGateau, ctx).find((e) => e.code === 'ERR_ECRITURE_SANS_SUPPLEMENT')?.champ, 'lignes[0].texteGateau');
  assert.equal(b.valeurProposee, SUPPLEMENT_ECRITURE);
  assert.equal(sortieDe(b).libelle, 'Ajouter le supplément Écriture');
  const avec = commande([
    versLigneSaisie({ ...layer20, texteGateau: 'JOYEUX ANNIVERSAIRE' }, layer),
    versLigneSaisie({ ...ligneVide(SUPPLEMENT_ECRITURE), quantite: 1 }, ecriture),
  ]);
  assert.ok(controlerCommande(avec, ctx).ok);
  // Sans texte : pas de supplément exigé.
  assert.equal(blocagesCommande(commande([versLigneSaisie(layer20, layer)]), ctx).length, 0);
  assert.deepEqual(
    controlerSupplementEcriture({ lignes: [{ produitId: LAYER, quantite: 20, nbGateaux: 1, texteGateau: '  ' }], supplementEcriture: SUPPLEMENT_ECRITURE }),
    [],
  );
});

test('4. gâteau retiré puis remis, supplément retiré au × : il revient tout seul (texte présent)', () => {
  // Supplément retiré (sortie « Supprimer la ligne » ou ×), gâteau remis avec son écriture :
  const lignes = [{ ...layer20, texteGateau: 'JOYEUX ANNIVERSAIRE' }];
  const remis = synchroniserSupplementsGateau(lignes, cat, FAMILLES);
  assert.deepEqual(remis.map((l) => l.produitId), [LAYER, SUPPLEMENT_ECRITURE]);
  // Rien à faire → même tableau (aucune boucle de rendu).
  assert.equal(synchroniserSupplementsGateau(remis, cat, FAMILLES), remis);
  // Sans gâteau, sans texte, ou « Pas d'écriture » : rien n'est ajouté.
  assert.deepEqual(synchroniserSupplementsGateau([], cat, FAMILLES), []);
  assert.equal(synchroniserSupplementsGateau([layer20], cat, FAMILLES).length, 1);
  assert.equal(synchroniserSupplementsGateau([{ ...layer20, texteGateau: 'X', sansEcriture: true }], cat, FAMILLES).length, 1);
  // Pas de × sur le supplément d'une écriture saisie.
  const sup = remis[1];
  assert.equal(supplementImpose(sup, remis, cat, FAMILLES), true);
  const vide = saisirSurLeGateau(remis, remis[0].cle, { texteGateau: '' }, cat, FAMILLES);
  assert.equal(vide.length, 1, 'texte vidé : supplément retiré');
  assert.equal(supplementImpose(layer20, remis, cat, FAMILLES), false);
  assert.equal(basculerSupplement(remis, SUPPLEMENT_ECRITURE, true, cat, FAMILLES).length, 2, 'jamais en double');
});

// ===================================================================== 5. Autre demande = gâteau ?

const libre = (p: Partial<LigneEcran>): LigneEcran => ({
  ...ligneVide(null), libelleLibre: 'Gâteau licorne', quantite: 1, prixUnitaireCentimes: PRIX, deverrouillage: GERANT, ...p,
});

test('5. « Autre demande » : « C’est un gâteau ? » obligatoire, jamais deviné du libellé', () => {
  const r = controlerLigne(versLigneSaisie(libre({}), null), 0, DATE, ctx);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, 'ERR_CHAMP_OBLIGATOIRE');
  assert.equal(r.champ, 'lignes[0].gateauLibre');
  assert.equal(libelleManque(r, [libre({})], cat).titre, 'Gâteau ou non — Gâteau licorne');
  const non = controlerLigne(versLigneSaisie(libre({ gateauLibre: false }), null), 0, DATE, ctx);
  assert.ok(non.ok);
  assert.equal(non.donnees.nbGateaux, 0);
});

test('5. gâteau libre : goût exigé (sortie « Au choix du pâtissier »), parts exigées, compte pour un gâteau', () => {
  const sansGout = controlerLigne(versLigneSaisie(libre({ gateauLibre: true, quantite: 12 }), null), 0, DATE, ctx);
  assert.equal(sansGout.ok, false);
  if (!sansGout.ok) {
    assert.equal(sansGout.code, 'ERR_GOUT_MANQUANT');
    assert.equal(sansGout.valeurProposee, GOUT_AU_CHOIX);
  }
  const sansParts = controlerLigne(versLigneSaisie(libre({ gateauLibre: true, quantite: null, gouts: ['Vanille'] }), null), 0, DATE, ctx);
  assert.equal(sansParts.ok, false);
  if (!sansParts.ok) assert.equal(sansParts.code, 'ERR_QUANTITE_INVALIDE');
  const ok = controlerLigne(versLigneSaisie(libre({ gateauLibre: true, quantite: 12, gouts: [GOUT_AU_CHOIX] }), null), 0, DATE, ctx);
  assert.ok(ok.ok);
  assert.equal(ok.donnees.nbGateaux, 1);
  assert.equal(ok.donnees.totalCentimes, 12 * PRIX);
  assert.equal(gateauxAuBon([libre({ gateauLibre: true })], cat, FAMILLES), 1, 'écriture et photo possibles sous le gâteau libre');
  assert.equal(gateauxAuBon([libre({ gateauLibre: false })], cat, FAMILLES), 0);
});

// ===================================================================== 6. « À corriger »

test('6. libellé du niveau bloquant : « À corriger », plus « Refusé »', () => {
  const src = readFileSync(fileURLToPath(new URL('../signalement/niveaux.tsx', import.meta.url)), 'utf8');
  assert.match(src, /libelle: 'À corriger'/);
  assert.doesNotMatch(src, /libelle: 'Refusé'/);
});

// ===================================================================== 7. Fenêtre « Il manque »

test('7. « Il manque » : un refus de règle porte sa phrase du domaine ; un champ vide, le mot-clé seul', () => {
  const mardi = { code: 'ERR_JOUR_FERME', message: 'Fermé le mardi — choisissez un autre jour de retrait.', champ: 'dateRetrait' };
  assert.deepEqual(libelleManque(mardi, [], cat), { titre: 'Date de retrait', detail: mardi.message });
  const lignes = [{ ...ligneVide(LAYER), quantite: 12 }];
  const min = controlerLigne(versLigneSaisie(lignes[0], layer), 0, DATE, ctx);
  assert.equal(min.ok, false);
  if (!min.ok) {
    const l = libelleManque(min, lignes, cat);
    assert.equal(l.titre, 'Taille ou quantité — Layer Cake');
    assert.match(l.detail ?? '', /Minimum 20/);
  }
  const vide = { code: 'ERR_CHAMP_OBLIGATOIRE', message: 'Le champ « nom du client » est obligatoire : remplissez-le pour continuer.', champ: 'client' };
  assert.deepEqual(libelleManque(vide, [], cat), { titre: 'Nom du client', detail: null });
});
