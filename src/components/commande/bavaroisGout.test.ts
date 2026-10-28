// node --test src/components/commande/bavaroisGout.test.ts
//
// Propriétaire, 28/10/2026 : le goût du Bavarois sur commande choisit le
// gâteau du COMPTOIR (« Matadi chocolat sur commande = Matadi du comptoir,
// même prix, sur le bon »), et « Bavarois goût Fraisier » se dit « Fraisier ».
// Plus : la photo WhatsApp sur une commande salée.
// Écran (choisirTaille, suivreGout), domaine (controlerLigne, rejoué tel quel
// par le serveur) et bon (formaterLigneTicket), sur le VRAI catalogue : aucun
// prix écrit en dur (LOI 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogueDepuisDossier } from '../../catalogue/chargerFichiers.ts';
import { creerApiCatalogue } from '../../catalogue/catalogue.ts';
import { CORRESPONDANCES_COMPTOIR } from '../../catalogue/correspondancesComptoir.ts';
import { GOUTS_SUR_COMMANDE } from '../../catalogue/goutsSurCommande.ts';
import { LIBELLES_SELON_GOUT } from '../../catalogue/libellesSelonGout.ts';
import { controlerLigne, type ContexteCommande } from '../../domaine/commande.ts';
import { DELAIS_PAR_DEFAUT, REGLEMENT_COMMANDE, REGLES_FORME, TAILLES_INTERDITES } from '../../domaine/constantes.ts';
import { libelleSelonGout } from '../../domaine/libelles.ts';
import {
  appliquerRemplacement,
  remplacementsProposes,
  choisirTaille,
  ficheComptoirPourTaille,
  libelleLigneEcran,
  resoudreLocal,
  suivreGout,
  tailleChoisie,
  toucherProduit,
  versLigneSaisie,
  ligneVide,
  ficheDe,
  type CatalogueCommande,
  type FicheCatalogue,
  type LigneEcran,
} from './modele.ts';
import { formaterLigneTicket } from '../../lib/ticketCanvas.ts';
import type { LigneCommande } from '../../lib/commandes.ts';

const DATE = '2026-10-15';
const api = creerApiCatalogue(chargerCatalogueDepuisDossier().catalogue);
const T = CORRESPONDANCES_COMPTOIR;
const BAVAROIS = 'gateaux-sur-commande/bavarois';

function ficheCatalogue(id: string): FicheCatalogue {
  const p = api.getProduit(id);
  const x = api.getPrix(id, DATE);
  assert.ok(p.ok && x.ok, `${id} absent du catalogue`);
  return { produit: p.donnees, prix: x.donnees } as unknown as FicheCatalogue;
}

// Toutes les clés citées par la table + le gâteau commandé : le catalogue reçu par la tablette.
const IDS = [...new Set([BAVAROIS, ...T.flatMap((c) => [c.surCommande, c.comptoir])])];
const catalogue: CatalogueCommande = { date: DATE, fiches: IDS.map(ficheCatalogue) };
const ctx: ContexteCommande = {
  resoudre: resoudreLocal(catalogue),
  joursFermes: [],
  delais: DELAIS_PAR_DEFAUT,
  reglement: REGLEMENT_COMMANDE,
  correspondancesComptoir: T,
  goutsSurCommande: GOUTS_SUR_COMMANDE,
  formes: REGLES_FORME,
  taillesInterdites: TAILLES_INTERDITES,
};
const prix = (id: string) => ficheCatalogue(id).prix.prixCentimes;
const nom = (id: string) => {
  const f = ficheCatalogue(id);
  return f.produit.sousCategorie ? `${f.produit.produit} ${f.produit.sousCategorie}` : f.produit.produit;
};

/** Bavarois sur commande, goût (éventuel) choisi d'abord, photo / précision / décoration posées. */
function bavarois(gout: string | null): LigneEcran {
  const l = toucherProduit([], ficheCatalogue(BAVAROIS)).lignes[0];
  return { ...l, gouts: gout ? [gout] : [], photoModele: 'G043', precision: 'bien frais', decorations: ['Oreo'], forme: 'carre' };
}

/** Ligne vérifiée par le domaine (tel que le serveur la rejoue). */
function controler(l: LigneEcran) {
  const f = ctx.resoudre(l.produitId ?? '', DATE);
  return controlerLigne(versLigneSaisie(l, f.ok ? f.donnees : null), 0, DATE, ctx);
}

// Le tableau « taille × goût → ligne obtenue » du rapport.
const ATTENDU: { parts: number; gout: string | null; produit: string }[] = [
  { parts: 4, gout: 'Framboise', produit: 'gateaux-et-tartes/bavarois-framboise/4p' },
  { parts: 6, gout: 'Framboise', produit: 'gateaux-et-tartes/bavarois-framboise/6p' },
  { parts: 8, gout: 'Framboise', produit: 'gateaux-et-tartes/bavarois-framboise/8p' },
  { parts: 6, gout: 'Fruits de la passion', produit: 'gateaux-et-tartes/bavarois-fruits-de-la-passion/6p' },
  { parts: 6, gout: 'Mangue', produit: 'gateaux-et-tartes/bavarois-mangue/6p' },
  { parts: 4, gout: 'Fraisier', produit: 'gateaux-et-tartes/fraisier/4p' },
  { parts: 8, gout: 'Fraisier', produit: 'gateaux-et-tartes/fraisier/8p' },
  { parts: 4, gout: 'Matadi chocolat', produit: 'gateaux-et-tartes/matadi-chocolat/4p' }, // refusé par R65
  { parts: 6, gout: 'Matadi chocolat', produit: 'gateaux-et-tartes/matadi-chocolat/6p' },
  { parts: 8, gout: 'Matadi chocolat', produit: 'gateaux-et-tartes/matadi-chocolat/8p' },
  { parts: 4, gout: 'Mousse chocolat', produit: 'gateaux-et-tartes/mousse-chocolat/4p' },
  { parts: 6, gout: 'Mousse chocolat', produit: 'gateaux-et-tartes/mousse-chocolat/6p' },
  { parts: 6, gout: 'Vanille', produit: 'gateaux-et-tartes/bavarois/6p' },
  { parts: 6, gout: null, produit: 'gateaux-et-tartes/bavarois/6p' },
  { parts: 10, gout: 'Framboise', produit: 'gateaux-et-tartes/bavarois/10p' },
  { parts: 10, gout: 'Fraisier', produit: 'gateaux-et-tartes/bavarois/10p' },
  { parts: 15, gout: 'Framboise', produit: BAVAROIS },
  { parts: 20, gout: 'Matadi chocolat', produit: BAVAROIS },
];

test('taille × goût : goût choisi AVANT la taille → bon produit du comptoir, à SON prix du catalogue', () => {
  for (const a of ATTENDU) {
    const l = choisirTaille(bavarois(a.gout), a.parts, catalogue, T);
    const cas = `${a.parts} parts, goût ${a.gout ?? '(aucun)'}`;
    assert.equal(l.produitId, a.produit, cas);
    assert.deepEqual(l.gouts, a.gout ? [a.gout] : [], `${cas} : goût gardé`);
    assert.equal(l.photoModele, 'G043', `${cas} : photo gardée`);
    assert.equal(l.precision, 'bien frais');
    assert.deepEqual(l.decorations, ['Oreo']);
    if (a.produit === BAVAROIS) {
      assert.equal(l.quantite, a.parts, `${cas} : reste sur commande, au prix par personne`);
      assert.equal(l.origineSurCommande ?? null, null);
    } else {
      assert.equal(l.quantite, 1, `${cas} : un gâteau du comptoir`);
      assert.equal(l.origineSurCommande, BAVAROIS);
      assert.equal(tailleChoisie(l, T), a.parts, `${cas} : bouton de taille toujours allumé`);
      assert.equal(
        ficheComptoirPourTaille(BAVAROIS, a.parts, catalogue, T, l.gouts)?.prix.prixCentimes,
        prix(a.produit),
        `${cas} : prix du bouton = prix du comptoir`,
      );
    }
  }
});

test('domaine : chaque ligne obtenue est acceptée au prix du comptoir (sauf Matadi 4P, R65)', () => {
  for (const a of ATTENDU) {
    const l = choisirTaille(bavarois(a.gout ?? 'Au choix du pâtissier'), a.parts, catalogue, T);
    // Sans goût : le domaine l'exige (R62) ; « Au choix du pâtissier » est un goût sans comptoir.
    if (a.gout === null) assert.equal(l.produitId, 'gateaux-et-tartes/bavarois/6p');
    const r = controler(l);
    const cas = `${a.parts} parts, goût ${a.gout ?? 'au choix'}`;
    if (a.produit === 'gateaux-et-tartes/matadi-chocolat/4p') {
      assert.equal(r.ok, false, cas);
      if (!r.ok) assert.equal(r.code, 'ERR_TAILLE_INTERDITE');
      continue;
    }
    assert.ok(r.ok, `${cas} : ${r.ok ? '' : r.message}`);
    if (!r.ok) continue;
    if (a.produit === BAVAROIS) {
      assert.equal(r.donnees.regimePrix, 'C', cas);
    } else {
      assert.equal(r.donnees.regimePrix, 'A', cas);
      assert.equal(r.donnees.totalCentimes, prix(a.produit), `${cas} : même prix que le comptoir`);
      assert.equal(r.donnees.libelle, nom(a.produit), `${cas} : libellé du comptoir à la lettre`);
    }
  }
});

test('goût changé APRÈS la taille : la ligne suit le goût, sans rien perdre', () => {
  let l = choisirTaille(bavarois(null), 6, catalogue, T);
  assert.equal(l.produitId, 'gateaux-et-tartes/bavarois/6p');
  l = suivreGout({ ...l, gouts: ['Framboise'] }, catalogue, T);
  assert.equal(l.produitId, 'gateaux-et-tartes/bavarois-framboise/6p');
  assert.equal(l.quantite, 1);
  assert.equal(l.origineSurCommande, BAVAROIS);
  assert.deepEqual(l.gouts, ['Framboise']);
  assert.equal(l.photoModele, 'G043');
  assert.equal(l.precision, 'bien frais');
  assert.deepEqual(l.decorations, ['Oreo']);
  assert.equal(l.forme, 'carre', 'même gâteau commandé : forme gardée');
  l = suivreGout({ ...l, gouts: ['Matadi chocolat'] }, catalogue, T);
  assert.equal(l.produitId, 'gateaux-et-tartes/matadi-chocolat/6p');
  l = suivreGout({ ...l, gouts: ['Vanille'] }, catalogue, T);
  assert.equal(l.produitId, 'gateaux-et-tartes/bavarois/6p', 'autre goût : retour au Bavarois 6P');
  l = suivreGout({ ...l, gouts: [] }, catalogue, T);
  assert.equal(l.produitId, 'gateaux-et-tartes/bavarois/6p', 'goût retiré : Bavarois 6P');
  // Au prix par personne (15 parts) : rien ne bouge.
  const quinze = choisirTaille(bavarois('Vanille'), 15, catalogue, T);
  assert.equal(suivreGout({ ...quinze, gouts: ['Framboise'] }, catalogue, T).produitId, BAVAROIS);
  // Même produit : la ligne n'est pas recréée (aucun rendu inutile).
  const meme = choisirTaille(bavarois('Mangue'), 8, catalogue, T);
  assert.equal(suivreGout(meme, catalogue, T), meme);
  // Achat au comptoir (sans origine) : jamais touché.
  const vitrine: LigneEcran = { ...toucherProduit([], ficheCatalogue('gateaux-et-tartes/bavarois/6p')).lignes[0], gouts: ['Framboise'] };
  assert.equal(suivreGout(vitrine, catalogue, T), vitrine);
});

test('domaine / serveur : Bavarois sur commande 6 parts goût Framboise → « Bavarois framboise 6P » proposé', () => {
  const sc = controlerLigne({ produitId: BAVAROIS, quantite: 6, gouts: ['Framboise'], forme: 'rond' }, 0, DATE, ctx);
  assert.equal(sc.ok, false);
  if (!sc.ok) {
    assert.equal(sc.code, 'ERR_PRIX_COMPTOIR');
    assert.equal(sc.valeurProposee, 'gateaux-et-tartes/bavarois-framboise/6p');
  }
  // Tablette pas à jour : « Bavarois 6P » au goût Framboise → refusé, bon produit proposé.
  const ancien = controlerLigne(
    { produitId: 'gateaux-et-tartes/bavarois/6p', quantite: 1, origineSurCommande: BAVAROIS, gouts: ['Framboise'], forme: 'rond' },
    0, DATE, ctx,
  );
  assert.equal(ancien.ok, false);
  if (!ancien.ok) {
    assert.equal(ancien.code, 'ERR_PRIX_COMPTOIR');
    assert.equal(ancien.valeurProposee, 'gateaux-et-tartes/bavarois-framboise/6p');
    assert.equal(ancien.champ, 'lignes[0].quantite');
  }
  // Produit d'un goût, goût d'un autre : refusé, le produit du goût proposé.
  const croise = controlerLigne(
    { produitId: 'gateaux-et-tartes/bavarois-framboise/6p', quantite: 1, origineSurCommande: BAVAROIS, gouts: ['Mangue'], forme: 'rond' },
    0, DATE, ctx,
  );
  assert.equal(croise.ok, false);
  if (!croise.ok) assert.equal(croise.valeurProposee, 'gateaux-et-tartes/bavarois-mangue/6p');
  // N'interdit pas : achat du Bavarois framboise 6P en vitrine (sans origine) — un gâteau par ligne (28/10/2026).
  const vitrine = controlerLigne({ produitId: 'gateaux-et-tartes/bavarois-framboise/6p', quantite: 1 }, 0, DATE, ctx);
  assert.ok(vitrine.ok);
});

test('Matadi chocolat 4 parts : R65 refuse, « Passer en Matadi chocolat 6P » garde le gâteau commandé et son goût', () => {
  const l = choisirTaille(bavarois('Matadi chocolat'), 4, catalogue, T);
  const r = controler(l);
  assert.equal(r.ok, false);
  if (r.ok) return;
  const [passer, prendre] = remplacementsProposes(r.valeurProposee);
  assert.equal(passer.produitId, 'gateaux-et-tartes/matadi-chocolat/6p');
  const six = appliquerRemplacement(l, passer, GOUTS_SUR_COMMANDE, T);
  assert.equal(six.origineSurCommande, BAVAROIS);
  assert.deepEqual(six.gouts, ['Matadi chocolat']);
  assert.equal(six.photoModele, 'G043');
  assert.equal(tailleChoisie(six, T), 6);
  assert.ok(controler(six).ok);
  // « Prendre Mousse chocolat 4P » : le goût suit le produit (Mousse chocolat).
  const mousse = appliquerRemplacement(l, prendre, GOUTS_SUR_COMMANDE, T);
  assert.equal(mousse.produitId, 'gateaux-et-tartes/mousse-chocolat/4p');
  assert.deepEqual(mousse.gouts, ['Mousse chocolat']);
  assert.ok(controler(mousse).ok);
});

test('Fraisier : « Bavarois goût Fraisier » s’écrit « Fraisier », à l’écran et sur le bon', () => {
  // 4/6/8 : c'est le Fraisier du comptoir.
  const six = choisirTaille(bavarois('Fraisier'), 6, catalogue, T);
  assert.equal(libelleLigneEcran(six, ficheDe(catalogue, six.produitId)!, LIBELLES_SELON_GOUT), nom('gateaux-et-tartes/fraisier/6p'));
  // 15 parts : reste sur commande, mais se dit « Fraisier ».
  const quinze = choisirTaille(bavarois('Fraisier'), 15, catalogue, T);
  assert.equal(quinze.produitId, BAVAROIS);
  assert.equal(libelleLigneEcran(quinze, ficheDe(catalogue, BAVAROIS)!, LIBELLES_SELON_GOUT), 'Fraisier');
  // 10 parts : Bavarois 10P du comptoir, dit « Fraisier 10P ».
  const dix = choisirTaille(bavarois('Fraisier'), 10, catalogue, T);
  assert.equal(libelleLigneEcran(dix, ficheDe(catalogue, dix.produitId)!, LIBELLES_SELON_GOUT), 'Fraisier 10P');
  // Autre goût : libellé du catalogue, inchangé.
  const vanille = choisirTaille(bavarois('Vanille'), 15, catalogue, T);
  assert.equal(libelleLigneEcran(vanille, ficheDe(catalogue, BAVAROIS)!, LIBELLES_SELON_GOUT), nom(BAVAROIS));
  assert.equal(libelleSelonGout(BAVAROIS, [' fraisier '], LIBELLES_SELON_GOUT), 'Fraisier', 'sans casse ni espaces');
  assert.equal(libelleSelonGout(BAVAROIS, ['Fraisier', 'Vanille'], LIBELLES_SELON_GOUT), null, 'plusieurs goûts : aucun');

  // Le bon : « Fraisier », sans « GOÛT : FRAISIER » en plus.
  const ligneBon: LigneCommande = {
    libelle: nom(BAVAROIS),
    quantite: 15,
    prixCentimes: prix(BAVAROIS),
    unite: 'piece',
    poste: null,
    precision: null,
    gouts: ['Fraisier'],
    produitCatalogue: { cleCatalogue: BAVAROIS, regimePrix: 'C' },
    prixProduit: { basePrix: 'personne' },
  };
  const bon = formaterLigneTicket(ligneBon, 'ATELIER');
  assert.equal(bon.libelle, 'Fraisier');
  assert.equal(bon.gouts, null);
  // Un autre goût : libellé enregistré et ligne de goût, comme avant.
  const autre = formaterLigneTicket({ ...ligneBon, gouts: ['Vanille'] }, 'ATELIER');
  assert.equal(autre.libelle, nom(BAVAROIS));
  assert.equal(autre.gouts?.length, 1);
});

test('commande salée : la « Photo d’exemple envoyée sur WhatsApp » est de la COMMANDE, hors des lignes (lot 2)', () => {
  // Lot 2 (28/10/2026) : écriture et photo à imprimer sont sur les lignes ; la
  // photo WhatsApp n'y est pas — elle part telle quelle, gâteau ou non.
  const s = versLigneSaisie({ ...ligneVide(null), libelleLibre: 'Plateau', quantite: 1 }, null);
  assert.ok(!('photoWhatsapp' in s));
});
