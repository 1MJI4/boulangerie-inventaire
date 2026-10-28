// node --test src/components/commande/vendeur2810.test.ts
//
// Corrections trouvées en parcourant l'application comme un vendeur (28/10/2026) :
// total à annoncer jamais à 0 € pendant la saisie, gâteau sur commande en tête
// de la recherche, date vide = champ à remplir, « Autre demande » à décrire,
// « Annuler » qui demande confirmation, photo en attente qui bloque la validation.
// Sur le VRAI catalogue : aucun prix écrit en dur (LOI 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogueDepuisDossier } from '../../catalogue/chargerFichiers.ts';
import { creerApiCatalogue } from '../../catalogue/catalogue.ts';
import { CORRESPONDANCES_COMPTOIR } from '../../catalogue/correspondancesComptoir.ts';
import { GOUTS_SUR_COMMANDE } from '../../catalogue/goutsSurCommande.ts';
import { blocagesCommande, montantCalculableLigne, totalEnCours, type ContexteCommande } from '../../domaine/commande.ts';
import { validerDateRetrait } from '../../domaine/calendrier.ts';
import { validerPhotoEnAttente } from '../../domaine/coherence.ts';
import { DELAIS_PAR_DEFAUT, REGLEMENT_COMMANDE, REGLES_FORME, TAILLES_INTERDITES } from '../../domaine/constantes.ts';
import { formaterEuros, multiplier, somme } from '../../domaine/argent.ts';
import {
  choisirTaille,
  fichesVisibles,
  ligneVide,
  ordonnerResultatsRecherche,
  resoudreLocal,
  toucherProduit,
  versCommandeSaisie,
  versLigneSaisie,
  ficheDe,
  type CatalogueCommande,
  type FicheCatalogue,
  type LigneEcran,
} from './modele.ts';
import { libelleManque, MANQUE_SIMPLE, texteChampVide } from './manques.ts';
import { empreinteSaisie, saisieEntamee, texteMontantEnCours, texteResteEnCours } from './saisieEnCours.ts';

const DATE = '2026-10-15';
const cat = chargerCatalogueDepuisDossier().catalogue;
const api = creerApiCatalogue(cat);
const BAVAROIS = 'gateaux-sur-commande/bavarois';
const LAYER = 'gateaux-sur-commande/layer-cake';
const BURGER = 'sur-commande/mini-burger';

function ficheCatalogue(id: string): FicheCatalogue {
  const p = api.getProduit(id);
  const x = api.getPrix(id, DATE);
  assert.ok(p.ok && x.ok, `${id} absent du catalogue`);
  return { produit: p.donnees, prix: x.donnees } as unknown as FicheCatalogue;
}

// Catalogue reçu par la tablette : tout ce qui a un prix à la date.
const catalogue: CatalogueCommande = {
  date: DATE,
  fiches: [...cat.produits.values()].flatMap((p) => (api.getPrix(p.id, DATE).ok ? [ficheCatalogue(p.id)] : [])),
};
const ctx: ContexteCommande = {
  resoudre: resoudreLocal(catalogue),
  joursFermes: [],
  delais: DELAIS_PAR_DEFAUT,
  reglement: REGLEMENT_COMMANDE,
  correspondancesComptoir: CORRESPONDANCES_COMPTOIR,
  goutsSurCommande: GOUTS_SUR_COMMANDE,
  formes: REGLES_FORME,
  taillesInterdites: TAILLES_INTERDITES,
};
const saisies = (lignes: LigneEcran[]) => lignes.map((l) => versLigneSaisie(l, ficheDe(catalogue, l.produitId)));
const prix = (id: string) => ficheCatalogue(id).prix.prixCentimes;

/** Bavarois sur commande, goût Framboise, taille 6 : devient « Bavarois framboise 6P », forme pas choisie. */
function bavaroisFramboise6(): LigneEcran {
  const l = toucherProduit([], ficheCatalogue(BAVAROIS)).lignes[0];
  return choisirTaille({ ...l, gouts: ['Framboise'] }, 6, catalogue, CORRESPONDANCES_COMPTOIR);
}

// ------------------------------------------------------------------ 1. total à annoncer

test('1. Bavarois framboise 6P sans forme : total = prix du comptoir, « à compléter » (jamais 0,00 €)', () => {
  const l = bavaroisFramboise6();
  assert.equal(l.produitId, 'gateaux-et-tartes/bavarois-framboise/6p');
  const t = totalEnCours(saisies([l]), DATE, ctx);
  assert.equal(t.complet, false, 'forme à choisir : pas définitif');
  assert.equal(t.totalCentimes, prix('gateaux-et-tartes/bavarois-framboise/6p'));
  assert.notEqual(t.totalCentimes, 0);
  const texte = texteMontantEnCours(t.totalCentimes, t.complet);
  assert.equal(texte.montant, formaterEuros(t.totalCentimes));
  assert.equal(texte.suite, '+ à compléter');
});

test('1. Layer Cake sans taille : pas compté, et le total le dit (pas de « 0,00 € »)', () => {
  const l = toucherProduit([], ficheCatalogue(LAYER)).lignes[0];
  const t = totalEnCours(saisies([l]), DATE, ctx);
  assert.deepEqual(t.montants, [null]);
  assert.equal(t.complet, false);
  assert.deepEqual(texteMontantEnCours(t.totalCentimes, t.complet), { montant: null, suite: 'à compléter' });
  assert.equal(texteResteEnCours(0, t.totalCentimes, t.complet), 'reste à compléter');
});

test('1. 1 mini-burger (sous le minimum) + Layer sans taille : prix connu × quantité connue, à compléter', () => {
  const burger = toucherProduit([], ficheCatalogue(BURGER)).lignes[0];
  assert.equal(burger.quantite, 1);
  const layer = toucherProduit([], ficheCatalogue(LAYER)).lignes[0];
  const t = totalEnCours(saisies([burger, layer]), DATE, ctx);
  assert.equal(t.totalCentimes, multiplier(1, prix(BURGER)));
  assert.equal(t.complet, false);
  assert.equal(texteResteEnCours(t.totalCentimes, t.totalCentimes, false), `reste ${formaterEuros(t.totalCentimes)} + à compléter`);
});

test('1. toutes les lignes admises : total complet, sans « à compléter »', () => {
  const burgers = { ...toucherProduit([], ficheCatalogue(BURGER)).lignes[0], quantite: 10 };
  const t = totalEnCours(saisies([burgers]), DATE, ctx);
  assert.equal(t.complet, true);
  assert.equal(t.totalCentimes, multiplier(10, prix(BURGER)));
  assert.deepEqual(texteMontantEnCours(t.totalCentimes, true), { montant: formaterEuros(t.totalCentimes), suite: null });
});

test('1. montant non calculable : quantité vide, prix sous le plancher, produit inconnu', () => {
  assert.equal(montantCalculableLigne({ produitId: BURGER, quantite: 0 }, DATE, ctx), null);
  assert.equal(montantCalculableLigne({ produitId: LAYER, quantite: 20, prixUnitaireCentimes: 1 }, DATE, ctx), null);
  assert.equal(montantCalculableLigne({ produitId: 'inconnu/x', quantite: 2 }, DATE, ctx), null);
  // Ligne libre : prix fixé × quantité, même sans l'accord du gérant (affichage seulement).
  assert.equal(montantCalculableLigne({ produitId: null, libelle: 'Licorne', quantite: 2, prixUnitaireCentimes: prix(BURGER) }, DATE, ctx), multiplier(2, prix(BURGER)));
  const t = totalEnCours([], DATE, ctx);
  assert.equal(t.totalCentimes, somme([]));
  assert.equal(t.complet, true);
});

// ------------------------------------------------------------------ 2. recherche

test('2. recherche « bavarois » : le Bavarois sur commande (régime C par personne) passe EN PREMIER', () => {
  const fiches = fichesVisibles(catalogue, 'bavarois', null);
  assert.ok(fiches.length > 5);
  assert.equal(fiches[0]?.produit.id, BAVAROIS);
  // Le reste garde l'ordre du catalogue.
  const sansLui = fiches.slice(1).map((f) => f.produit.id);
  const ordre = catalogue.fiches.map((f) => f.produit.id).filter((id) => sansLui.includes(id));
  assert.deepEqual(sansLui, ordre);
});

test('2. ordre décidé par les DONNÉES (régime C, base personne), jamais par le nom ; hors recherche : inchangé', () => {
  // Ordre du catalogue, le Bavarois sur commande passé en régime A : rien ne bouge.
  const brut = catalogue.fiches
    .filter((f) => f.produit.produit.toLowerCase().includes('bavarois'))
    .map((f) => (f.produit.id === BAVAROIS ? { ...f, produit: { ...f.produit, regimePrix: 'A' as const } } : f));
  assert.notEqual(brut[0]?.produit.id, BAVAROIS);
  assert.deepEqual(
    ordonnerResultatsRecherche(brut, 'bavarois').map((f) => f.produit.id),
    brut.map((f) => f.produit.id),
    'même nom, régime A : pas en tête',
  );
  const sans = fichesVisibles(catalogue, '', null).map((f) => f.produit.id);
  assert.deepEqual(sans, ordonnerResultatsRecherche(fichesVisibles(catalogue, '', null), '').map((f) => f.produit.id));
});

// ------------------------------------------------------------------ 3. date vide

test('3. date vide : champ à remplir (ERR_CHAMP_OBLIGATOIRE, discret), pas « incomplet ou mal rempli »', () => {
  const r = validerDateRetrait('', [], DATE);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, 'ERR_CHAMP_OBLIGATOIRE');
  assert.equal(r.champ, 'dateRetrait');
  assert.equal(r.message, 'Choisissez le jour de retrait.');
  assert.ok(MANQUE_SIMPLE.has(r.code), 'mot-clé seul dans « Il manque »');
  assert.deepEqual(libelleManque(r, [], catalogue), { titre: 'DATE de retrait', detail: null });
  assert.equal(texteChampVide(r), 'Choisissez le jour de retrait.');
  // Les vrais refus restent, avec leur sortie.
  const passee = validerDateRetrait('2026-10-14', [], DATE);
  assert.equal(passee.ok ? null : passee.code, 'ERR_DATE_PASSEE');
  assert.equal(validerDateRetrait('2026-02-30', [], DATE).ok ? null : 'refus', 'refus');
});

test('3. commande sans date ni client : phrases courtes sous chaque champ', () => {
  const saisie = versCommandeSaisie(
    { client: '', telephone: '', dateRetrait: null, heureRetrait: '', lignes: [], acompteCentimes: null, totalConvenuCentimes: null, remise: null, texteGateau: '', sansEcriture: false, demandeInhabituelle: false },
    catalogue,
    { datePrise: DATE, heurePrise: '10:00' },
  );
  const textes: Record<string, string> = Object.fromEntries(blocagesCommande(saisie, { ...ctx, aujourdhui: DATE }).map((b) => [b.champ, texteChampVide(b)]));
  assert.equal(textes.client, 'Indiquez le nom du client.');
  assert.equal(textes.telephone, 'Indiquez un numéro de téléphone.');
  assert.equal(textes.dateRetrait, 'Choisissez le jour de retrait.');
  assert.equal(textes.heureRetrait, 'Choisissez l’heure de retrait.');
  for (const t of Object.values(textes)) assert.doesNotMatch(t, /▲|[A-ZÉÈ]{3,}/, t);
});

// ------------------------------------------------------------------ 4. autre demande

test('4. « Autre demande » pas encore décrite : à remplir (pas « n’a pas de produit », pas « supprimer »)', () => {
  const libre = ligneVide(null);
  const [s] = saisies([libre]);
  assert.equal(s?.ligneLibre, true);
  const t = totalEnCours(saisies([libre]), DATE, ctx);
  assert.equal(t.complet, false);
  const r = blocagesCommande(
    versCommandeSaisie(
      { client: 'A', telephone: '0470123456', dateRetrait: '2026-10-16', heureRetrait: '10:00', lignes: [libre], acompteCentimes: null, totalConvenuCentimes: null, remise: null, texteGateau: '', sansEcriture: false, demandeInhabituelle: false },
      catalogue,
      { datePrise: DATE, heurePrise: '09:00' },
    ),
    { ...ctx, aujourdhui: DATE },
  ).find((b) => b.champ === 'lignes[0].libelle');
  assert.ok(r, 'refus sur la description');
  assert.equal(r.code, 'ERR_CHAMP_OBLIGATOIRE');
  assert.equal(r.message, 'Décrivez ce que veut le client.');
  assert.equal(texteChampVide(r), 'À remplir : décrivez la demande');
  assert.deepEqual(libelleManque(r, [libre], catalogue), { titre: 'Décrivez ce que veut le client.', detail: null });
});

test('4. ligne catalogue sans produit : « n’a pas de produit » reste', () => {
  const r = totalEnCours([{ produitId: null, quantite: 1 }], DATE, ctx);
  assert.equal(r.complet, false);
  const b = blocagesCommande(
    { client: 'A', telephone: '0470123456', datePrise: DATE, heurePrise: '09:00', dateRetrait: '2026-10-16', heureRetrait: '10:00', lignes: [{ produitId: null, quantite: 1 }] },
    { ...ctx, aujourdhui: DATE },
  ).find((x) => x.champ?.startsWith('lignes[0]'));
  assert.equal(b?.code, 'ERR_LIGNE_SANS_PRODUIT');
});

// ------------------------------------------------------------------ 5. annuler

test('5. « Annuler » : confirmation seulement s’il y a quelque chose à perdre', () => {
  const vide = { client: '', telephone: '', lignes: [], remarques: '' };
  assert.equal(saisieEntamee(vide), false);
  assert.equal(saisieEntamee({ ...vide, client: 'Mariam' }), true);
  assert.equal(saisieEntamee({ ...vide, telephone: '0470' }), true);
  assert.equal(saisieEntamee({ ...vide, lignes: [ligneVide(BURGER)] }), true);
  assert.equal(saisieEntamee({ ...vide, remarques: 'sans noix' }), true);
  assert.equal(saisieEntamee({ ...vide, client: '   ' }), false);
  // Modification : même saisie relue (clés locales différentes) = inchangée.
  const a = { ...ligneVide(BURGER), quantite: 10 };
  const b = { ...a, cle: 'autre' };
  assert.equal(empreinteSaisie({ client: 'A', lignes: [a] }), empreinteSaisie({ client: 'A', lignes: [b] }));
  assert.notEqual(empreinteSaisie({ client: 'A', lignes: [a] }), empreinteSaisie({ client: 'A', lignes: [{ ...a, quantite: 11 }] }));
});

// ------------------------------------------------------------------ 6. photo en attente

test('6. photo en attente : la validation est refusée, avec la sortie « Retirer la photo »', () => {
  assert.equal(validerPhotoEnAttente(null).ok, true);
  assert.equal(validerPhotoEnAttente('').ok, true);
  const r = validerPhotoEnAttente('G047');
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, 'ERR_PHOTO_EN_ATTENTE');
  assert.equal(r.champ, 'photoEnAttente');
  assert.equal(r.message, 'Photo G047 : touchez le produit à qui l’attribuer, ou retirez la photo.');
  assert.deepEqual(libelleManque(r, [], catalogue), { titre: r.message, detail: null });
});
