// node --test src/catalogue/comptoirJusqua8.test.ts
//
// R60, décision du propriétaire du 19/11/2026 : le prix du COMPTOIR s'arrête à
// 8 parts ; au-dessus, prix par personne. Forêt noire : comme le Bavarois.
// Vrai catalogue : aucun prix en dur (LOI 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogueDepuisDossier } from './chargerFichiers.ts';
import { creerApiCatalogue } from './catalogue.ts';
import { CORRESPONDANCES_COMPTOIR, controlerCorrespondancesComptoir } from './correspondancesComptoir.ts';
import { LIBELLES_SELON_GOUT } from './libellesSelonGout.ts';
import { GOUTS_SUR_COMMANDE } from './goutsSurCommande.ts';
import { produitComptoirPourTaille, validerComptoirSelonGout } from '../domaine/prixComptoir.ts';
import { libelleSelonGout } from '../domaine/libelles.ts';
import { controlerLigne, type ContexteCommande } from '../domaine/commande.ts';
import { DELAIS_PAR_DEFAUT, REGLEMENT_COMMANDE } from '../domaine/constantes.ts';
import {
  ficheDe,
  ligneVide,
  resoudreLocal,
  versLigneSaisie,
  SUPPLEMENT_ECRITURE,
  SUPPLEMENT_PHOTO,
  type CatalogueCommande,
  type FicheCatalogue,
  type LigneEcran,
} from '../components/commande/modele.ts';

const DATE = '2026-11-20';
const BAV = 'gateaux-sur-commande/bavarois';
const BAV_10P = 'gateaux-et-tartes/bavarois/10p';
const T = CORRESPONDANCES_COMPTOIR;
const api = creerApiCatalogue(chargerCatalogueDepuisDossier().catalogue);

function fiche(id: string): FicheCatalogue {
  const p = api.getProduit(id);
  const x = api.getPrix(id, DATE);
  assert.ok(p.ok && x.ok, `${id} absent du catalogue`);
  return { produit: p.donnees, prix: x.donnees } as unknown as FicheCatalogue;
}
const catalogue: CatalogueCommande = { date: DATE, fiches: [BAV, BAV_10P, SUPPLEMENT_PHOTO, SUPPLEMENT_ECRITURE].map(fiche) };
const ctx: ContexteCommande = {
  resoudre: resoudreLocal(catalogue),
  joursFermes: [],
  delais: DELAIS_PAR_DEFAUT,
  reglement: { ...REGLEMENT_COMMANDE, acomptePourcentageMin: 0 },
  correspondancesComptoir: T,
  supplementEcriture: SUPPLEMENT_ECRITURE,
  supplementPhoto: SUPPLEMENT_PHOTO,
};
const controler = (l: LigneEcran) => controlerLigne(versLigneSaisie(l, ficheDe(catalogue, l.produitId)), 0, DATE, ctx);

test('R60 : au-dessus de 8 parts, plus de prix du comptoir', () => {
  for (const g of [null, 'Fraisier', 'Matadi chocolat', 'Forêt noire']) {
    assert.equal(produitComptoirPourTaille(BAV, 10, T, g), null, `10 parts, goût ${g ?? '(aucun)'}`);
  }
  assert.ok(T.every((c) => c.parts <= 8), 'aucune correspondance au-dessus de 8 parts');
});

test('Forêt noire : 4, 6, 8 parts = le gâteau du comptoir ; goût proposé en tête', () => {
  for (const n of [4, 6, 8]) {
    assert.equal(produitComptoirPourTaille(BAV, n, T, 'Forêt noire'), `gateaux-et-tartes/foret-noire/${n}p`);
  }
  const choix = GOUTS_SUR_COMMANDE[BAV];
  assert.ok(choix.liste === 'parfum' && choix.goutsEnTete?.includes('Forêt noire'));
});

test('la table reste valide sur le vrai catalogue', () => {
  const lire = (cle: string) => {
    const p = api.getProduit(cle);
    if (!p.ok) return null;
    const x = api.getPrix(cle, DATE);
    return { produit: p.donnees, prix: x.ok ? x.donnees : null };
  };
  assert.deepEqual(controlerCorrespondancesComptoir(T, lire, REGLEMENT_COMMANDE.taillesGateau), []);
});

test('10 parts au goût Fraisier : prix par personne du Bavarois, libellé « Fraisier »', () => {
  const l: LigneEcran = { ...ligneVide(BAV), quantite: 10, gouts: ['Fraisier'], sansEcriture: true, forme: 'carre' };
  const r = controler(l);
  assert.ok(r.ok, JSON.stringify(r));
  const parPersonne = fiche(BAV).prix.prixCentimes;
  assert.equal(r.donnees.totalCentimes, 10 * parPersonne);
  for (const g of ['Fraisier', 'Matadi chocolat', 'Mousse chocolat', 'Forêt noire']) {
    assert.equal(libelleSelonGout(BAV, [g], LIBELLES_SELON_GOUT), g);
  }
  assert.equal(libelleSelonGout(BAV, ['Vanille'], LIBELLES_SELON_GOUT), null);
});

test('commande ancienne : « Bavarois 10P » issu d’un Bavarois sur commande reste accepté, à son prix', () => {
  assert.equal(validerComptoirSelonGout(BAV_10P, BAV, ['Fraisier'], T, 'Bavarois').ok, true);
  const ancienne: LigneEcran = { ...ligneVide(BAV_10P), quantite: 1, origineSurCommande: BAV, gouts: ['Fraisier'], sansEcriture: true, forme: 'carre' };
  const r = controler(ancienne);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.donnees.totalCentimes, fiche(BAV_10P).prix.prixCentimes);
});
