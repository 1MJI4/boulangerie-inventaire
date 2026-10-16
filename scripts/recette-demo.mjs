// scripts/recette-demo.mjs — agent `deploiement`
//
// Commandes de DÉMONSTRATION pour la recette locale. Appelé UNIQUEMENT par
// `npm run recette:demo` (scripts/recette.mjs), après le garde-fou « base de
// recette locale » et avec les codes de .env.recette.
//
// Rien n'est écrit directement en base : chaque commande passe par la vraie
// route POST /api/commandes du serveur recette:dev, donc par les règles du
// domaine, rejouées côté serveur. Aucun prix ni jour n'est décidé ici :
//   - les prix sont lus dans /api/tarifs (catalogue) ;
//   - les dates sont essayées l'une après l'autre ; un jour fermé est refusé
//     par le serveur (ERR_JOUR_FERME) et on passe au suivant ;
//   - l'acompte est celui que propose le refus ERR_ACOMPTE_INSUFFISANT.

import { cleDeSignature, creerJeton, nouvelAppareil, signerJeton } from '../src/lib/auth/session.ts';
import { decalerJours } from '../src/domaine/calendrier.ts';

const NOM_COOKIE_TABLETTE = 'pp_tablette';
const VENDEUR = 'Recette (démo)';

function cookieTablette() {
  const cle = cleDeSignature('tablette', process.env.SESSION_SECRET, process.env.CODE_TABLETTE);
  if (!cle) throw new Error('SESSION_SECRET ou CODE_TABLETTE invalides dans .env.recette.');
  return `${NOM_COOKIE_TABLETTE}=${signerJeton(creerJeton('tablette', nouvelAppareil(), Date.now()), cle)}`;
}

function trouver(fiches, regime, motif) {
  return fiches.find((f) => f.produit.regimePrix === regime && motif.test(f.produit.produit));
}

/** Ligne au minimum exigé par le catalogue (parts, pièces, ou grammes pour le kilo). */
function ligne(fiche, quantite) {
  return {
    produitId: fiche.produit.id,
    quantite: quantite ?? fiche.prix.minQuantite ?? 1,
    // Régime C : vide = plancher. A et B : le prix affiché, contrôlé par le serveur.
    prixUnitaireCentimes: fiche.produit.regimePrix === 'C' ? null : fiche.prix.prixCentimes,
  };
}

export async function lancerDemo({ base }) {
  const cookie = cookieTablette();
  const entetes = { cookie, origin: base, 'content-type': 'application/json' };

  let reponse;
  try {
    reponse = await fetch(`${base}/api/tarifs`, { headers: { cookie } });
  } catch {
    throw new Error(`le serveur ne répond pas sur ${base}. Lancez d’abord npm run recette:dev dans un autre terminal.`);
  }
  if (!reponse.ok) throw new Error(`/api/tarifs a répondu ${reponse.status}.`);
  const { date: aujourdhui, fiches } = await reponse.json();
  console.log(`[démo] catalogue du ${aujourdhui} : ${fiches.length} produits.`);

  const burger = trouver(fiches, 'B', /mini burger/i);
  const wrap = trouver(fiches, 'B', /mini wrap/i);
  const layer = trouver(fiches, 'C', /layer/i);
  const kilo = fiches.find((f) => f.produit.unite === 'kg');
  const comptoir = fiches.find((f) => f.produit.regimePrix === 'A' && f.produit.unite === 'piece' && f.produit.famille === 'sale');

  const modeles = [
    { client: 'Démo Dupont', telephone: '0470000001', lignes: [ligne(burger), ligne(wrap)] },
    { client: 'Démo Martin', telephone: '0470000002', lignes: [ligne(layer)], texteGateau: 'Joyeux anniversaire' },
    { client: 'Démo Janssens', telephone: '0470000003', lignes: [ligne(kilo, 500), ligne(comptoir, 4)] },
    { client: 'Démo Peeters', telephone: '0470000004', lignes: [ligne(burger, 20)] },
    { client: 'Démo Lambert', telephone: '0470000005', lignes: [ligne(layer, 30)], sansEcriture: true },
  ].filter((m) => m.lignes.every((l) => l.produitId));

  let decalage = 3; // laisse le délai de commande en jours ouvrés
  let creees = 0;
  for (const modele of modeles) {
    for (let essai = 0; essai < 4; essai++, decalage++) {
      const corps = {
        ...modele,
        vendeur: VENDEUR,
        origine: 'comptoir',
        modePaiement: 'especes',
        dateRetrait: decalerJours(aujourdhui, decalage),
        heureRetrait: '14:00',
        acompteCentimes: 0,
      };
      let r = await fetch(`${base}/api/commandes`, { method: 'POST', headers: entetes, body: JSON.stringify(corps) });
      let j = await r.json();
      if (!r.ok && j.code === 'ERR_ACOMPTE_INSUFFISANT' && j.valeurProposee != null) {
        corps.acompteCentimes = Number(j.valeurProposee);
        r = await fetch(`${base}/api/commandes`, { method: 'POST', headers: entetes, body: JSON.stringify(corps) });
        j = await r.json();
      }
      if (r.ok) {
        creees++;
        console.log(`[démo] ${j.numero} — ${modele.client}, retrait le ${corps.dateRetrait} : créée.`);
        decalage++;
        break;
      }
      console.log(`[démo] ${modele.client}, retrait le ${corps.dateRetrait} : refusée (${j.code}) — ${j.message}`);
    }
  }
  console.log(`[démo] ${creees} commande(s) de démonstration créée(s).`);
}
