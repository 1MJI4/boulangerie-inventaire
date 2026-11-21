'use client';

// Écran du fournil : ce que le manager a demandé pour la journée en cours.
//
// Deux exigences propres à ce poste. La journée affichée est la journée de
// production (bascule à 14h) et non « demain » : ouverte à 3h du matin, la
// page cherchait auparavant les prévisions du surlendemain et restait vide.
// Et l'écran reste allumé des heures sur un plan de travail : il va donc
// chercher les nouvelles quantités tout seul, et signale ce qui vient
// d'arriver plutôt que de les glisser silencieusement dans la liste.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alerte, Bouton, Carte, Chargement, Entete, EtatVide, Progression, Puce } from '@/components/ui';
import { SelecteurJournee } from '@/components/SelecteurJournee';
import { formatDateLong, journeeProduction } from '@/lib/dateProduction';
import { useProfil } from '@/components/ProfilAppareil';
import { useMemoireLocale } from '@/lib/memoireLocale';
import { DEFINITIONS } from '@/lib/profils';
import { DESCRIPTION_POSTE, LIBELLE_POSTE, POSTES, estPoste, type Poste } from '@/lib/postes';
import { enPlateaux, formaterPlateaux, sePlanifieEnPlateaux } from '@/domaine/plateaux';
import { formaterDerives, preremplirCommandes, totalAProduire } from '@/domaine/commandesFournil';
import { construireFeuille } from '@/domaine/feuillePrevisions';
import type { FeuillePrevisions } from '@/domaine/feuillePrevisions';
import { FenetreImpressionFeuille } from '@/components/FenetreImpressionFeuille';
import type { PartCommandeeJournee, PartFournil } from '@/lib/serveur/partCommandee';

/**
 * Croissant, Couque au chocolat : le pâtissier sort des PLATEAUX. Le gros
 * chiffre est le nombre de plateaux ; dessous, l'équivalent en pièces, puis
 * la part commandée par des clients, qui reste en pièces.
 */
function QuantiteEnPlateaux({
  prevue,
  commandee,
  parPlateau,
  fait,
  derives,
}: {
  prevue: number;
  /** Part commandée en pièces : le « + » du manager et les commandes de l'application. */
  commandee: number;
  parPlateau: number;
  fait: boolean;
  /** « dont 7 Croissant à la pâte d'amande » (R72) ; vide s'il n'y a pas de dérivé. */
  derives: string;
}) {
  const base = Math.max(0, prevue);
  const { plateaux, reste } = enPlateaux(base, parPlateau);
  return (
    <span className={`shrink-0 text-right ${fait ? 'text-ink-3' : 'text-ink'}`}>
      <span className="flex items-baseline justify-end gap-1.5 leading-none">
        <span className="chiffres text-3xl font-semibold tabular-nums">{plateaux}</span>
        <span className="text-sm font-medium">plateau{plateaux > 1 ? 'x' : ''}</span>
      </span>
      <span className="chiffres mt-0.5 block text-xs text-ink-3">
        {reste > 0 ? `${formaterPlateaux(base, parPlateau)} · ` : ''}= {base} pièces
      </span>
      {commandee > 0 ? (
        <span className="chiffres mt-0.5 block text-xs font-medium text-accent">
          + {commandee} pièce{commandee > 1 ? 's' : ''} commandée{commandee > 1 ? 's' : ''}
        </span>
      ) : null}
      {derives !== '' ? (
        <span className="mt-0.5 block text-xs font-medium text-accent">{derives}</span>
      ) : null}
    </span>
  );
}

type LigneFournil = {
  produitId: number;
  quantitePrevue: number | null;
  quantiteCommande: number | null;
  /** R72 — pièces commandées dans l'application (dérivés compris) et pièces à sortir en plus. */
  commandeAuto?: number | null;
  plateauCommandes?: number | null;
  quantiteProduite: number | null;
  faitLe: string | null;
  produit: {
    id: number;
    nom: string;
    categorie: string;
    poste: Poste;
    ordre: number;
    /** Demandé en plateaux entiers de N pièces (domaine/plateaux) ; null = à la pièce. */
    piecesParPlateau?: number | null;
  };
};

/** Le manager saisit pendant que le fournil regarde : on va rechercher souvent. */
const INTERVALLE_RAFRAICHISSEMENT_MS = 45_000;

export default function Fournil() {
  const [date, setDate] = useState(() => journeeProduction());
  const { profil } = useProfil();
  const [posteMemorise, setPosteMemorise] = useMemoireLocale<string>(
    'boulangerie:poste-fournil',
    'patissier'
  );

  // Sur la tablette du pâtissier, le poste n'est pas un choix : il ne doit
  // jamais tomber sur la liste du boulanger. Seul le manager garde les onglets.
  const posteImpose = profil ? DEFINITIONS[profil].posteImpose : undefined;
  const poste: Poste =
    posteImpose ?? (estPoste(posteMemorise) ? posteMemorise : 'patissier');

  const [lignes, setLignes] = useState<LigneFournil[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<Set<number>>(new Set());
  const [actualiseA, setActualiseA] = useState<Date | null>(null);
  const [nouveautes, setNouveautes] = useState<Set<number>>(new Set());

  // R72 — détail des commandes clients par produit et phrase du plateau en plus.
  const [part, setPart] = useState<PartCommandeeJournee | null>(null);

  // Ce que le fournil avait déjà sous les yeux, pour ne signaler que le neuf.
  const dejaVus = useRef<Map<number, number | null> | null>(null);

  const charger = useCallback(
    async (silencieux = false) => {
      if (!silencieux) setChargement(true);
      try {
        // D'abord la part des commandes (elle recalcule et enregistre), puis la
        // feuille : les deux lectures racontent la même chose. Si elle échoue,
        // la feuille s'affiche quand même avec la dernière part enregistrée.
        const partLue: PartCommandeeJournee | null = await fetch(`/api/inventaires/commandes?date=${date}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (partLue) setPart(partLue);
        const reponse = await fetch(`/api/inventaires?date=${date}&poste=${poste}&avecPrevision=1`);
        if (!reponse.ok) throw new Error('chargement impossible');
        const donnees: LigneFournil[] = await reponse.json();

        const precedent = dejaVus.current;
        if (precedent) {
          const neuf = new Set<number>();
          for (const ligne of donnees) {
            const avant = precedent.get(ligne.produitId);
            if (avant === undefined || avant !== totalAProduire(ligne.quantitePrevue, ligne.plateauCommandes)) neuf.add(ligne.produitId);
          }
          if (neuf.size > 0) setNouveautes((prec) => new Set([...prec, ...neuf]));
        }

        dejaVus.current = new Map(donnees.map((l) => [l.produitId, totalAProduire(l.quantitePrevue, l.plateauCommandes)]));
        setLignes(donnees);
        setActualiseA(new Date());
        setErreur(null);
      } catch {
        if (!silencieux) setErreur('Impossible de charger la feuille de production.');
      } finally {
        setChargement(false);
      }
    },
    [date, poste]
  );

  // Changer de poste ou de journée remet le compteur de nouveautés à zéro.
  useEffect(() => {
    dejaVus.current = null;
    setNouveautes(new Set());
    setPart(null);
    void charger();
  }, [charger]);

  // Relecture régulière, mise en pause quand l'écran n'est pas regardé.
  useEffect(() => {
    const tic = setInterval(() => {
      if (document.visibilityState === 'visible') void charger(true);
    }, INTERVALLE_RAFRAICHISSEMENT_MS);

    const auReveil = () => {
      if (document.visibilityState === 'visible') void charger(true);
    };
    document.addEventListener('visibilitychange', auReveil);

    return () => {
      clearInterval(tic);
      document.removeEventListener('visibilitychange', auReveil);
    };
  }, [charger]);

  const basculerFait = async (ligne: LigneFournil) => {
    const faitMaintenant = ligne.faitLe === null;
    const horodatage = faitMaintenant ? new Date().toISOString() : null;

    setLignes((prec) =>
      prec.map((l) => (l.produitId === ligne.produitId ? { ...l, faitLe: horodatage } : l))
    );
    setEnCours((prec) => new Set(prec).add(ligne.produitId));

    try {
      const reponse = await fetch('/api/inventaires', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateInventaire: date,
          inventaires: [{ produitId: ligne.produitId, faitLe: horodatage }],
        }),
      });
      if (!reponse.ok) throw new Error();
    } catch {
      setLignes((prec) =>
        prec.map((l) => (l.produitId === ligne.produitId ? { ...l, faitLe: ligne.faitLe } : l))
      );
      setErreur("La coche n'a pas pu être enregistrée. Vérifiez la connexion.");
    } finally {
      setEnCours((prec) => {
        const suivant = new Set(prec);
        suivant.delete(ligne.produitId);
        return suivant;
      });
    }
  };

  // Feuille à cocher sur le ticket de l'imprimante Star (propriétaire, 20/11/2026) :
  // même chemin que les bons de commande. En cas de panne, « Imprimer sur papier ».
  const [feuilleOuverte, setFeuilleOuverte] = useState<{ feuille: FeuillePrevisions; numero: string } | null>(null);

  const parCategorie = useMemo(() => {
    const groupes = new Map<string, LigneFournil[]>();
    for (const ligne of [...lignes].sort((a, b) => a.produit.ordre - b.produit.ordre)) {
      const liste = groupes.get(ligne.produit.categorie) ?? [];
      liste.push(ligne);
      groupes.set(ligne.produit.categorie, liste);
    }
    return [...groupes.entries()];
  }, [lignes]);

  const imprimerSurTicket = () => {
    const partDeJour = new Map<number, PartFournil>(
      (part && part.journee === date ? part.bases : []).map((b) => [b.produitId, b]),
    );
    const feuille = construireFeuille({
      titre: `Feuille ${LIBELLE_POSTE[poste].toLowerCase()}`,
      dateLongue: formatDateLong(date),
      sections: parCategorie.map(([categorie, liste]) => ({
        titre: categorie,
        lignes: liste.map((l) => ({
          nom: l.produit.nom,
          quantitePrevue: l.quantitePrevue,
          quantiteCommande: l.quantiteCommande,
          commandeAuto: l.commandeAuto ?? null,
          plateauCommandes: l.plateauCommandes ?? null,
          piecesParPlateau: l.produit.piecesParPlateau ?? null,
          derives: formaterDerives(partDeJour.get(l.produitId)?.detail ?? []),
        })),
      })),
    });
    // La fenêtre se charge du reste : préparer, déposer dans la file, suivre la sortie.
    setFeuilleOuverte({ feuille, numero: `Prévisions ${date} ${poste}` });
  };

  const faits = lignes.filter((l) => l.faitLe !== null).length;
  const total = lignes.reduce((somme, l) => somme + totalAProduire(l.quantitePrevue, l.plateauCommandes), 0);
  const partDe = new Map<number, PartFournil>(
    (part && part.journee === date ? part.bases : []).map((b) => [b.produitId, b])
  );
  // Les commandes PRÉREMPLISSENT la prévision du manager (21/11/2026) : tant qu'il n'a pas ouvert
  // « Prévisions », elles n'y sont pas. Le pâtissier le voit ici plutôt que de produire trop peu.
  // Jusqu'à 4 pièces d'un produit à plateaux : tolérance, rien à signaler.
  const commandesNonComptees = (l: (typeof lignes)[number]): number | null => {
    const live = partDe.get(l.produitId)?.commandeAuto ?? 0;
    // quantiteCommande renseignée (même à 0) = le manager a ouvert les prévisions : préremplissage fait.
    if (live <= 0 || l.quantiteCommande != null) return null;
    const { plateaux, plus } = preremplirCommandes(live, l.produit.piecesParPlateau ?? 0);
    return plateaux > 0 || plus > 0 ? live : null;
  };
  // Le plateau des commandes ne concerne que les produits de ce poste.
  const resumesCommandes =
    part && part.journee === date && lignes.some((l) => (l.commandeAuto ?? 0) > 0) ? part.resumes : [];

  return (
    <>
      <Entete
        titre={`Feuille ${LIBELLE_POSTE[poste].toLowerCase()}`}
        sousTitre={
          <>
            À produire pour le{' '}
            <span className="font-medium capitalize text-ink">{formatDateLong(date)}</span>
          </>
        }
        actions={
          <div className="sans-impression flex flex-wrap items-center gap-2">
            <SelecteurJournee date={date} onChange={setDate} libelle="Fournée" />
            <Bouton variante="principal" onClick={imprimerSurTicket} disabled={lignes.length === 0}>
              Imprimer le ticket
            </Bouton>
            {/* Secours : imprimante de bureau, quand le ticket ne sort pas. */}
            <Bouton variante="secondaire" onClick={() => window.print()} disabled={lignes.length === 0}>
              Sur papier
            </Bouton>
          </div>
        }
      />

      <div className="sans-impression mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {posteImpose ? (
            <span className="text-xs text-ink-3">{DESCRIPTION_POSTE[poste]}</span>
          ) : (
            <>
              <div role="tablist" aria-label="Poste" className="flex gap-1 rounded-xl border border-transparent bg-surface p-1">
                {POSTES.map((p) => (
                  <button
                    key={p}
                    role="tab"
                    aria-selected={poste === p}
                    onClick={() => setPosteMemorise(p)}
                    className={`min-h-9 rounded-lg px-3 text-sm font-medium transition-colors ${
                      poste === p ? 'bg-accent-doux text-accent' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                    }`}
                  >
                    {LIBELLE_POSTE[p]}
                  </button>
                ))}
              </div>
              <span className="text-xs text-ink-3">{DESCRIPTION_POSTE[poste]}</span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => void charger(true)}
          className="text-xs text-ink-3 underline underline-offset-2 hover:text-ink-2"
          title="Relancer la lecture maintenant"
        >
          {actualiseA
            ? `actualisé à ${actualiseA.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}`
            : 'actualiser'}
        </button>
      </div>

      {nouveautes.size > 0 ? (
        <div className="sans-impression mb-4">
          <Alerte ton="ok">
            <span className="font-medium">
              {nouveautes.size} quantité{nouveautes.size > 1 ? 's' : ''} vient
              {nouveautes.size > 1 ? 'nent' : ''} d&apos;arriver du manager.
            </span>{' '}
            <button
              onClick={() => setNouveautes(new Set())}
              className="underline underline-offset-2"
            >
              J&apos;ai vu
            </button>
          </Alerte>
        </div>
      ) : null}

      {erreur ? (
        <div className="sans-impression mb-4">
          <Alerte>
            {erreur}{' '}
            <button onClick={() => void charger()} className="underline underline-offset-2">
              Réessayer
            </button>
          </Alerte>
        </div>
      ) : null}

      {chargement ? (
        <Chargement libelle="Chargement de la feuille…" />
      ) : lignes.length === 0 ? (
        <Carte>
          <EtatVide
            titre="Le manager n'a pas encore envoyé de quantités"
            detail={`Rien n'est demandé au ${LIBELLE_POSTE[poste].toLowerCase()} pour le ${formatDateLong(date)}. Cet écran se met à jour tout seul : laissez-le ouvert, les quantités apparaîtront dès la saisie.`}
          />
        </Carte>
      ) : (
        <div className="zone-impression feuille-previsions space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Puce ton="accent">
                <span className="chiffres">{total}</span> pièces au total
              </Puce>
              <Puce ton={faits === lignes.length ? 'ok' : 'neutre'}>
                <span className="chiffres">{lignes.length}</span> références
              </Puce>
            </div>
            <div className="sans-impression">
              <Progression fait={faits} total={lignes.length} />
            </div>
          </div>

          {resumesCommandes.length > 0 ? (
            <Carte className="border-accent/40 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Commandes clients</p>
              {resumesCommandes.map((resume) => (
                <p key={resume} className="chiffres mt-1 text-base font-medium text-ink">
                  {resume}
                </p>
              ))}
            </Carte>
          ) : null}

          {parCategorie.map(([categorie, liste]) => (
            <Carte key={categorie}>
              <h2 className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">
                {categorie}
              </h2>

              <ul>
                {liste.map((ligne) => {
                  const fait = ligne.faitLe !== null;
                  const nouveau = nouveautes.has(ligne.produitId);
                  // « + » du manager (déjà dans quantitePrevue) et commandes de l'application.
                  const commandeManuelle = ligne.quantiteCommande ?? 0;
                  const commandeTotale = commandeManuelle + (ligne.commandeAuto ?? 0);
                  const derives = formaterDerives(partDe.get(ligne.produitId)?.detail ?? []);

                  return (
                    <li
                      key={ligne.produitId}
                      className={`ligne-impression flex items-center gap-4 border-b border-line px-4 py-3 last:border-b-0 ${
                        nouveau ? 'bg-ok-doux' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void basculerFait(ligne)}
                        disabled={enCours.has(ligne.produitId)}
                        aria-pressed={fait}
                        aria-label={`Marquer ${ligne.produit.nom} comme produit`}
                        className={`sans-impression flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm transition-colors ${
                          fait
                            ? 'border-ok bg-ok text-white'
                            : 'border-line-fort text-transparent hover:bg-accent-doux'
                        }`}
                      >
                        ✓
                      </button>

                      <span
                        aria-hidden
                        className="ligne-impression hidden h-5 w-5 shrink-0 border border-black print:block"
                      />

                      <span
                        className={`min-w-0 flex-1 truncate text-lg ${
                          fait ? 'text-ink-3 line-through' : 'text-ink'
                        }`}
                      >
                        {ligne.produit.nom}
                        {commandesNonComptees(ligne) ? (
                          <span className="sans-impression ml-2 text-xs font-semibold text-attention">
                            {commandesNonComptees(ligne)} commandé{(commandesNonComptees(ligne) ?? 0) > 1 ? 's' : ''} pas encore dans la prévision
                          </span>
                        ) : null}
                        {nouveau ? (
                          <span className="sans-impression ml-2 text-xs font-medium text-ok">
                            nouveau
                          </span>
                        ) : null}
                      </span>

                      {ligne.quantiteProduite != null ? (
                        <span className="sans-impression chiffres shrink-0 text-xs text-ink-3">
                          {ligne.quantiteProduite} produits
                        </span>
                      ) : null}

                      {/* « 12 + 5 » : ce qui sort normalement, et ce qu'une
                          commande ajoute. Le total reste le chiffre à produire,
                          mais le pâtissier voit d'où vient le surplus. */}
                      {sePlanifieEnPlateaux(ligne.produit.piecesParPlateau) ? (
                        <QuantiteEnPlateaux
                          prevue={Math.max(0, (ligne.quantitePrevue ?? 0) - commandeManuelle)}
                          commandee={commandeTotale}
                          parPlateau={ligne.produit.piecesParPlateau}
                          fait={fait}
                          derives={derives}
                        />
                      ) : (
                      <span
                        className={`shrink-0 text-right ${fait ? 'text-ink-3' : 'text-ink'}`}
                      >
                        <span className="chiffres block text-3xl font-semibold tabular-nums leading-none">
                          {totalAProduire(ligne.quantitePrevue, ligne.plateauCommandes)}
                        </span>
                        {commandeTotale > 0 ? (
                          <span className="chiffres mt-0.5 block text-xs font-medium text-accent">
                            dont {commandeTotale} commandé
                            {commandeTotale > 1 ? 's' : ''}
                          </span>
                        ) : null}
                        {derives !== '' ? (
                          <span className="mt-0.5 block text-xs font-medium text-accent">{derives}</span>
                        ) : null}
                      </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Carte>
          ))}
        </div>
      )}
      {feuilleOuverte ? (
        <FenetreImpressionFeuille
          feuille={feuilleOuverte.feuille}
          numero={feuilleOuverte.numero}
          onFermer={() => setFeuilleOuverte(null)}
        />
      ) : null}
    </>
  );
}
