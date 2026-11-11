// node --test src/catalogue/goutsSurCommande.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GOUTS_SUR_COMMANDE, goutsDeLaColonne, goutsPropres } from './goutsSurCommande.ts';
import { ordonnerGouts, type ChoixGout } from '../domaine/gouts.ts';
import { chargerCatalogueDepuisDossier, DOSSIER_DATA_PAR_DEFAUT } from './chargerFichiers.ts';
import { analyserCsv } from './csv.ts';

/** Goûts montrés en premier — une liste propre (bûche, Cœur) n'en a pas. */
const enTete = (c: ChoixGout) => (c.liste === 'propre' ? undefined : c.goutsEnTete);
const BAVAROIS = { goutsEnTete: enTete(GOUTS_SUR_COMMANDE['gateaux-sur-commande/bavarois']) };

/** Les 9 produits « Special fin d'année » à liste propre : libellé du tarif, à la lettre → identifiant. */
const BUCHES_ET_COEURS: Record<string, string> = {
  'Bûches 4P': 'special-fin-dannee/buches-4p',
  'Bûches 6P': 'special-fin-dannee/buches-6p',
  'Bûches 8P': 'special-fin-dannee/buches-8p',
  'Bûches 10P': 'special-fin-dannee/buches-10p',
  'Bûchette': 'special-fin-dannee/buchette',
  'Petit Cœurs': 'special-fin-dannee/petit-coeurs',
  'Cœurs 5P': 'special-fin-dannee/coeurs-5p',
  'Cœurs 7P': 'special-fin-dannee/coeurs-7p',
  'Cœurs 9P': 'special-fin-dannee/coeurs-9p',
};

test('Bavarois sur commande : les goûts du comptoir en premier (propriétaire, 28/10/2026)', () => {
  assert.deepEqual(BAVAROIS.goutsEnTete, ['Mangue', 'Fruits de la passion', 'Framboise', 'Fraisier', 'Matadi chocolat', 'Mousse chocolat']);
});

test('chaque goût en tête du Bavarois est un gâteau du comptoir, libellé à la lettre (LOI 5)', () => {
  const noms = new Set([...chargerCatalogueDepuisDossier().catalogue.produits.values()].map((p) => p.produit));
  for (const g of BAVAROIS.goutsEnTete ?? []) {
    assert.ok(noms.has(g) || noms.has(`Bavarois ${g.toLocaleLowerCase('fr')}`), `${g} absent du comptoir`);
  }
});

test('la liste du manager suit, sans doublon ni casse en double', () => {
  const liste = ['Chocolat', 'Vanille', 'Framboise', 'mousse chocolat', 'Pistache'];
  assert.deepEqual(ordonnerGouts(BAVAROIS.goutsEnTete, liste), [
    'Mangue', 'Fruits de la passion', 'Framboise', 'Fraisier', 'Matadi chocolat', 'Mousse chocolat', 'Chocolat', 'Vanille', 'Pistache',
  ]);
  // Sans goûts en tête : la liste du manager telle quelle.
  assert.deepEqual(ordonnerGouts(undefined, ['Vanille', 'Vanille ', 'Fraise']), ['Vanille', 'Fraise']);
});

test('les autres gâteaux gardent la liste du manager seule', () => {
  for (const [id, choix] of Object.entries(GOUTS_SUR_COMMANDE)) {
    if (id === 'gateaux-sur-commande/bavarois') continue;
    assert.equal(enTete(choix), undefined, id);
    // Une liste propre (bûche, Cœur) ne se mélange jamais à la liste du manager.
    if (choix.liste === 'propre') assert.equal('goutsEnTete' in choix, false, id);
  }
});

// ------------------------------------------------------------ bûches et Cœurs (11/11/2026)

test('chaque bûche et chaque Cœur a sa liste propre, non vide, un seul goût', () => {
  for (const [libelle, id] of Object.entries(BUCHES_ET_COEURS)) {
    const choix = GOUTS_SUR_COMMANDE[id];
    assert.ok(choix, `${libelle} absent de GOUTS_SUR_COMMANDE`);
    assert.equal(choix.liste, 'propre', libelle);
    assert.equal(choix.parEtage, false, libelle);
    const gouts = goutsPropres(id);
    assert.ok(gouts && gouts.length > 0, libelle);
    for (const g of gouts) assert.equal(g, g.trim(), `${libelle} : « ${g} » a un espace en bord`);
    assert.equal(new Set(gouts).size, gouts.length, `${libelle} : goût en double`);
  }
  const propres = Object.entries(GOUTS_SUR_COMMANDE).filter(([, c]) => c.liste === 'propre').map(([id]) => id);
  assert.deepEqual(propres.sort(), Object.values(BUCHES_ET_COEURS).sort());
});

test('les goûts sont ceux DU TARIF, à la lettre et dans son ordre (LOI 5)', () => {
  const csv = readFileSync(join(DOSSIER_DATA_PAR_DEFAUT, 'catalogue_prix_2026-09.csv'), 'utf8');
  const lignes = analyserCsv(csv).slice(1).map((l) => l.champs);
  for (const [libelle, id] of Object.entries(BUCHES_ET_COEURS)) {
    const ligne = lignes.filter((l) => l[1] === libelle);
    assert.equal(ligne.length, 1, `${libelle} : une seule ligne au tarif`);
    assert.deepEqual(goutsPropres(id), goutsDeLaColonne(ligne[0][2]), libelle);
  }
  // Nombre de goûts : 12 pour les bûches, 10 pour la Bûchette.
  for (const t of ['4p', '6p', '8p', '10p']) assert.equal(goutsPropres(`special-fin-dannee/buches-${t}`)?.length, 12);
  assert.equal(goutsPropres('special-fin-dannee/buchette')?.length, 10);
  // Casse du gérant conservée : « crème fraîche » (bûches) / « Crème fraîche » (Cœurs).
  assert.ok(goutsPropres('special-fin-dannee/buches-6p')?.includes('crème fraîche'));
  assert.ok(goutsPropres('special-fin-dannee/coeurs-5p')?.includes('Crème fraîche'));
});

test('aucun identifiant de GOUTS_SUR_COMMANDE n’est absent du catalogue', () => {
  const charge = chargerCatalogueDepuisDossier();
  assert.ok(charge.ok);
  for (const id of Object.keys(GOUTS_SUR_COMMANDE)) {
    assert.ok(charge.catalogue.produits.has(id), `${id} absent du catalogue`);
  }
});

test('un produit sans liste propre : goutsPropres rend null', () => {
  assert.equal(goutsPropres('gateaux-sur-commande/bavarois'), null);
  assert.equal(goutsPropres('inconnu'), null);
});
