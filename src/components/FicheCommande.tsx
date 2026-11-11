'use client';

// src/components/FicheCommande.tsx
//
// La FICHE d'une commande (propriétaire, 28/10/2026), ouverte sur place depuis
// l'accueil vendeur ou la liste des commandes — jamais une autre page.
//
// Sur cet écran, le vendeur doit pouvoir lire toute la commande et la remettre
// au client sans quitter l'écran où il était.
//
// Panneau qui monte du bas sur téléphone, panneau latéral droit sur tablette.
// Se ferme d'un geste : « Fermer », toucher à côté, ou Échap (<dialog> natif :
// focus piégé dans la fiche, rendu au bouton d'origine à la fermeture).
// Les actions sont en bas, à portée du pouce : « Marquer retirée », « Imprimer
// le bon », « Modifier ».
//
// Aucune règle ici : le décompte devant le client (R58) est contrôlé par
// `validerTransitionStatut` (domaine) puis rejoué par le serveur ; les appels
// sont ceux qui existaient déjà (PATCH /api/commandes, actions « remise » et
// « acompte »). Le mot « remise » n'apparaît plus à l'écran : il prêtait à
// confusion avec une réduction de prix.
//
// Lot du 11/11/2026 :
//  - « Annuler la commande » (R68) : réservé au manager. La règle est
//    `validerAnnulation` (domaine), rejouée par le serveur qui vérifie l'accès
//    manager de la tablette. En ligne seulement : jamais dans la file hors ligne.
//  - « Historique » : la dernière action toujours en clair, le reste d'un
//    toucher (mise en mots : src/components/fiche/historiqueCommande.ts).

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { IconeNiveau, ListeSignalements, type SignalementAffichable } from '@/components/signalement';
import { echecReseau, lireReponse } from '@/components/commande/modele';
import { sortieDe } from '@/components/commande/sorties';
import { EtiquetteType, Pastille, PastilleStatut } from '@/components/fiche/ElementsCommande';
import {
  MOTIFS_ANNULATION,
  resumeHistorique,
  texteAnnulation,
  texteModifications,
  titreDepli,
  type EvenementCommande,
  type LigneHistorique,
} from '@/components/fiche/historiqueCommande';
import {
  ecritureDeCommande,
  GESTE_RETRAIT,
  infosParGateau,
  heureLisible,
  lienTelephone,
  ligneAffichee,
  majusculeInitiale,
} from '@/components/fiche/presentationCommande';
import { useEquipe } from '@/lib/vendeurs';
import { attendUnVirement, depuisApi, HISTORIQUE_FICHE, HISTORIQUE_LISTE, typesDeCommande, type Commande, type CommandeApi } from '@/lib/commandes';
import { formatDateLong } from '@/lib/dateProduction';
import { formaterEuros, resteDu } from '@/domaine/argent';
import { totalLigne } from '@/domaine/unites';
import { validerAnnulation, validerTransitionStatut } from '@/domaine/coherence';
import type { Echec, Signalement } from '@/domaine/resultat';

type Props = {
  /** La commande à montrer ; null : fiche fermée. */
  commande: Commande | null;
  onFermer: () => void;
  /** Recharger la liste après un changement (retrait, virement reçu). */
  onChange: () => void | Promise<void>;
};

const cleArticle = (l: { id?: number }, k: number) => String(l.id ?? k);

export function FicheCommande({ commande, onFermer, onChange }: Props) {
  const dialogue = useRef<HTMLDialogElement>(null);
  // Commande qui vient d'être annulée ici : elle sort de la liste « en cours »
  // (le parent ne la fournit plus), mais la fiche reste ouverte sur elle tant
  // que la vendeuse ne l'a pas fermée (avertissements acompte / bon à lire).
  const [gardee, setGardee] = useState<Commande | null>(null);
  const montree = gardee ?? commande;
  const ouverte = montree !== null;

  useEffect(() => {
    const d = dialogue.current;
    if (!d) return;
    if (ouverte && !d.open) d.showModal();
    if (!ouverte && d.open) d.close();
    if (!ouverte) return;
    // La page derrière ne défile pas pendant que la fiche est ouverte.
    const avant = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = avant;
    };
  }, [ouverte]);

  return (
    <dialog
      ref={dialogue}
      aria-labelledby="fiche-commande-titre"
      // « close » de la fiche elle-même (pas celui de la fenêtre d'annulation, posée dedans).
      onClose={(e) => {
        if (e.target !== e.currentTarget) return;
        setGardee(null);
        onFermer();
      }}
      // Toucher à côté (sur le voile) : la cible est le <dialog> lui-même.
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="fiche-commande fixed inset-x-0 bottom-0 top-auto m-0 max-h-none w-full max-w-none border-0 bg-transparent p-0 text-ink md:inset-y-0 md:left-auto md:right-0 md:h-dvh md:max-h-none md:w-[32rem]"
    >
      {/* Clé : un état propre (décompte, refus) pour chaque commande ouverte. */}
      {montree ? (
        <Contenu key={montree.id} commande={montree} onChange={onChange} onAnnulee={setGardee} fermer={() => dialogue.current?.close()} />
      ) : null}
    </dialog>
  );
}

/* ----------------------------------------------------------- Le contenu */

/** Commande renvoyée par le PATCH ; une annulation y joint les avertissements du domaine. */
type ReponseAction = CommandeApi & { signalements?: Signalement[] };

function Contenu({
  commande,
  onChange,
  onAnnulee,
  fermer,
}: {
  commande: Commande;
  onChange: () => void | Promise<void>;
  /** La commande vient d'être annulée : la fiche la garde à l'écran. */
  onAnnulee: (c: Commande) => void;
  fermer: () => void;
}) {
  const { equipe, vendeur, definirVendeur } = useEquipe();
  const [occupe, setOccupe] = useState(false);
  const [refus, setRefus] = useState<Echec | null>(null);
  const [derniere, setDerniere] = useState<(() => void) | null>(null);
  // R58 : décompte des articles devant le client, avant « Retirée par le client ».
  const [decompte, setDecompte] = useState<Record<string, boolean> | null>(null);
  const cases = useRef<Record<string, HTMLInputElement | null>>({});
  // Annulation (R68) : fenêtre de confirmation, puis avertissements à lire (acompte, bon).
  const [annulation, setAnnulation] = useState(false);
  const [apresAnnulation, setApresAnnulation] = useState<Signalement[] | null>(null);
  const corps = useRef<HTMLDivElement>(null);
  // Historique complet, lu à la demande (la liste n'en porte que les derniers).
  const [historiqueComplet, setHistoriqueComplet] = useState<EvenementCommande[] | null>(null);
  const [lectureHistorique, setLectureHistorique] = useState(false);
  const [refusHistorique, setRefusHistorique] = useState<Echec | null>(null);

  const reste = resteDu(commande.totalCentimes, commande.acompteCentimes);
  const virement = attendUnVirement(commande);
  const heure = heureLisible(commande.retraitHeure);
  const tel = commande.anonymiseeLe ? null : lienTelephone(commande.telephone);
  const ecriture = ecritureDeCommande(commande);
  // Lot 2 : écriture et photo à imprimer sont dites sous CHAQUE gâteau ; les
  // drapeaux de la commande ne servent plus qu'aux anciennes commandes.
  const parGateau = infosParGateau(commande);
  const sansEcriture = !parGateau && commande.sansEcriture;
  const photoAImprimer = !parGateau && commande.photoImprimee;
  const types = typesDeCommande(commande);
  const vivante = commande.statut === 'a_imprimer' || commande.statut === 'imprimee';
  // Prénom de celui qui agit : retenu pour le service (écran Commandes) ; sinon demandé ici, d'un toucher.
  const manquePrenom = !vendeur && equipe.length > 0;

  /**
   * Envoie une action au serveur. « remise » et « acompte » : le refus s'affiche
   * dans la fiche. « annulation » : le refus est RENDU à la fenêtre d'annulation,
   * qui l'affiche (elle recouvre la fiche) ; toujours en ligne, jamais mise en
   * file hors ligne — sans réseau, la commande n'est pas annulée et on le dit.
   */
  const agir = async (action: 'remise' | 'acompte' | 'annulation', enPlus: Record<string, unknown> = {}): Promise<Echec | null> => {
    const annuler = action === 'annulation';
    setOccupe(true);
    if (!annuler) {
      setRefus(null);
      setDerniere(() => () => void agir(action, enPlus));
    }
    try {
      const r = await lireReponse<ReponseAction>(
        await fetch('/api/commandes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: commande.id, action, auteur: vendeur ?? undefined, ...enPlus }),
        }),
      );
      if (!r.ok) {
        if (!annuler) setRefus(r);
        return r;
      }
      setDecompte(null);
      if (annuler) {
        const { signalements, ...annulee } = r.donnees;
        // Avertissements du domaine (acompte reçu, bon à l'atelier) : à l'écran jusqu'à « C'est noté ».
        setApresAnnulation(Array.isArray(signalements) ? signalements : []);
        setAnnulation(false);
        setRefus(null);
        onAnnulee(depuisApi(annulee));
        corps.current?.scrollTo({ top: 0 });
      }
      if (action === 'remise') fermer();
      await onChange();
      return null;
    } catch {
      const e = echecReseau();
      if (e.ok) return null;
      if (!annuler) setRefus(e);
      return e;
    } finally {
      setOccupe(false);
    }
  };

  /* Historique : ce que la liste a déjà apporté, complété à la demande par la lecture de la commande. */
  const evenements = fusionnerEvenements(commande.evenements, historiqueComplet);
  const historique = resumeHistorique(evenements, { anonymisee: Boolean(commande.anonymiseeLe) });
  // La liste n'apporte que les derniers événements : au plafond, il y en a peut-être d'autres.
  const historiqueACompleter = historiqueComplet === null && (commande.evenements?.length ?? 0) >= HISTORIQUE_LISTE;
  const historiqueTronque = historiqueComplet !== null && historiqueComplet.length >= HISTORIQUE_FICHE;

  const lireToutLHistorique = async () => {
    setLectureHistorique(true);
    setRefusHistorique(null);
    try {
      const r = await lireReponse<CommandeApi>(await fetch(`/api/commandes?id=${commande.id}`));
      if (r.ok) setHistoriqueComplet(r.donnees.evenements ?? []);
      else setRefusHistorique(r);
    } catch {
      const e = echecReseau();
      if (!e.ok) setRefusHistorique(e);
    } finally {
      setLectureHistorique(false);
    }
  };

  const articles = commande.lignes.map((l, k) => ({ id: cleArticle(l, k), remis: decompte?.[cleArticle(l, k)] === true }));
  const cochees = articles.filter((a) => a.remis).length;

  const validerRetrait = () => {
    // Même règle que le serveur (validerTransitionStatut → validerRemise) : refus immédiat.
    const r = validerTransitionStatut(commande.statut, 'remise', { articles });
    if (!r.ok) {
      setRefus(r);
      return;
    }
    void agir('remise', { articles });
  };

  /** Sortie de ERR_DECOMPTE_INCOMPLET : amène le doigt sur la première case pas encore cochée. */
  const allerAuxCases = (restants: unknown) => {
    const ids = Array.isArray(restants) && restants.length ? restants.map(String) : articles.filter((a) => !a.remis).map((a) => a.id);
    const c = cases.current[ids[0] ?? ''];
    c?.scrollIntoView({ block: 'center' });
    c?.focus();
    setRefus(null);
  };

  return (
    <div className="flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl bg-ground shadow-2xl md:h-dvh md:max-h-none md:rounded-none md:rounded-l-2xl">
      {/* ------------------------------------------------ En-tête */}
      <header className="flex items-start gap-3 border-b border-line bg-surface px-4 pb-3 pt-2">
        <div className="min-w-0 flex-1 pt-2">
          <p className="chiffres text-sm text-ink-2">Commande n°&nbsp;{commande.numero}</p>
          <h2 id="fiche-commande-titre" className="text-2xl font-bold leading-tight tracking-tight text-ink">
            {commande.client}
          </h2>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <PastilleStatut commande={commande} />
            {types.map((t) => (
              <EtiquetteType key={t} type={t} />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={fermer}
          className="min-h-11 shrink-0 rounded-full px-3 text-base font-semibold text-accent hover:bg-accent-doux"
        >
          Fermer
        </button>
      </header>

      {/* ------------------------------------------------ Corps */}
      <div ref={corps} className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
        {commande.statut === 'annulee' ? (
          <p className="rounded-2xl bg-bloquant-doux px-4 py-3 text-base font-semibold text-bloquant">{texteAnnulation(commande)}</p>
        ) : null}

        {apresAnnulation ? (
          <section aria-label="Après l’annulation" className="space-y-2">
            {apresAnnulation.length > 0 ? (
              <ListeSignalements signalements={apresAnnulation} />
            ) : (
              <p className="rounded-2xl bg-surface px-4 py-3 text-base text-ink">La commande est annulée. Rien d’autre à faire.</p>
            )}
            <button
              type="button"
              onClick={() => setApresAnnulation(null)}
              className="min-h-12 w-full rounded-2xl bg-segment-fond px-4 text-base font-semibold text-ink"
            >
              C’est noté
            </button>
          </section>
        ) : null}

        <Groupe>
          <Cellule libelle="Retrait">
            <span className="font-semibold">{majusculeInitiale(formatDateLong(commande.retraitLe))}</span>
            <span className="chiffres block text-ink-2">{heure ? `à ${heure}` : 'Heure non précisée'}</span>
          </Cellule>
          <Cellule libelle="Téléphone">
            {tel ? (
              <a href={tel} className="chiffres inline-flex min-h-11 items-center font-semibold text-accent underline-offset-2 hover:underline">
                {commande.telephone}
              </a>
            ) : (
              <span className="text-ink-2">{commande.telephone || 'Non indiqué'}</span>
            )}
          </Cellule>
          <Cellule libelle="Prise">
            <span>
              par {commande.vendeur}
              {commande.origine === 'telephone' ? ', au téléphone' : ', au comptoir'}
            </span>
          </Cellule>
        </Groupe>

        {/* ------------------------------------------- Articles, ou décompte */}
        {decompte ? (
          <section>
            <h3 className="mb-1.5 px-4 text-sm text-ink-2">
              Vérifiez devant le client · <span className="chiffres">{cochees} sur {articles.length}</span> cochés
            </h3>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
              {commande.lignes.map((l, k) => {
                const cle = cleArticle(l, k);
                const a = ligneAffichee(l);
                return (
                  <li key={cle}>
                    <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2.5">
                      <input
                        ref={(el) => {
                          cases.current[cle] = el;
                        }}
                        type="checkbox"
                        checked={decompte[cle] === true}
                        onChange={(e) => setDecompte({ ...decompte, [cle]: e.target.checked })}
                        className="h-7 w-7 shrink-0 accent-[var(--sortie)]"
                      />
                      <span className="min-w-0 flex-1 text-base">
                        <span className="chiffres font-semibold">{a.quantite}</span> {a.libelle}
                        {a.details.length ? <span className="block text-sm text-ink-2">{a.details.join(' · ')}</span> : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <section>
            <h3 className="mb-1.5 px-4 text-sm text-ink-2">
              {commande.lignes.length} article{commande.lignes.length > 1 ? 's' : ''}
            </h3>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
              {commande.lignes.map((l, k) => {
                const a = ligneAffichee(l);
                const total = totalLigne(l.unite ?? 'piece', l.quantite, l.prixCentimes);
                return (
                  <li key={cleArticle(l, k)} className="flex gap-3 px-4 py-3">
                    <span className="chiffres w-20 shrink-0 text-base font-semibold">{a.quantite}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-medium">{a.libelle}</span>
                      {a.details.map((d, i) => (
                        <span key={i} className="block text-sm text-ink-2">
                          {d}
                        </span>
                      ))}
                    </span>
                    {/* Total calculé par le domaine ; incalculable → jamais un montant inventé. */}
                    <span className="chiffres shrink-0 text-sm text-ink-2">{total.ok ? formaterEuros(total.donnees) : 'à confirmer'}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {ecriture || sansEcriture || commande.photoWhatsapp || photoAImprimer ? (
          <Groupe titre="Écriture et photo">
            {ecriture ? (
              <Cellule libelle="Écriture">
                <span className="font-medium">«&nbsp;{ecriture}&nbsp;»</span>
              </Cellule>
            ) : sansEcriture ? (
              <Cellule libelle="Écriture">
                <span className="text-ink-2">Sans écriture</span>
              </Cellule>
            ) : null}
            {commande.photoWhatsapp ? (
              <Cellule libelle="Photo du client">
                <span>Envoyée sur WhatsApp</span>
              </Cellule>
            ) : null}
            {photoAImprimer ? (
              <Cellule libelle="Photo">
                <span>À imprimer sur le gâteau</span>
              </Cellule>
            ) : null}
          </Groupe>
        ) : null}

        {commande.remarques?.trim() ? (
          <Groupe titre="Remarques">
            <li className="whitespace-pre-line px-4 py-3 text-base">{commande.remarques.trim()}</li>
          </Groupe>
        ) : null}

        <Groupe titre="Paiement">
          <Cellule libelle="Total">
            <span className="chiffres font-semibold">{formaterEuros(commande.totalCentimes)}</span>
          </Cellule>
          <Cellule libelle={commande.modePaiement === 'virement' ? 'Acompte (virement)' : 'Acompte (espèces)'}>
            <span className="chiffres">{formaterEuros(commande.acompteCentimes)}</span>
          </Cellule>
          <Cellule libelle="Reste à payer">
            <span className="chiffres text-xl font-bold">{formaterEuros(reste)}</span>
          </Cellule>
          {virement ? (
            <li className="flex flex-wrap items-center gap-3 bg-avertissement-doux px-4 py-3">
              <IconeNiveau niveau="avertissement" className="h-6 w-6 text-avertissement" />
              <span className="min-w-0 flex-1 text-base">
                <span className="block font-semibold text-avertissement">Virement à vérifier</span>
                <span className="block text-sm text-ink">Communication «&nbsp;{commande.numero}&nbsp;»</span>
              </span>
              <button
                type="button"
                disabled={occupe}
                onClick={() => void agir('acompte')}
                className="min-h-11 rounded-full bg-surface px-4 text-base font-semibold text-ink shadow-sm disabled:opacity-60"
              >
                Virement reçu
              </button>
            </li>
          ) : null}
        </Groupe>

        {historique.derniere ? (
          <Groupe titre="Historique">
            <li className="px-4 py-3">
              <p className="text-base font-medium text-ink">{historique.derniere.resume}</p>
              {historique.derniereModification ? (
                <p className="mt-0.5 text-base font-medium text-ink">{historique.derniereModification.resume}</p>
              ) : null}
              {historique.nbModifications > 1 ? (
                <p className="chiffres mt-0.5 text-sm text-ink-2">{texteModifications(historique.nbModifications)}</p>
              ) : null}
            </li>
            <li>
              <details className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-base font-semibold text-accent [&::-webkit-details-marker]:hidden">
                  <span className="chiffres">{titreDepli(historique.lignes.length)}</span>
                  <span aria-hidden className="text-xl text-ink-2 transition-transform group-open:rotate-90">›</span>
                </summary>
                <ol className="divide-y divide-line border-t border-line">
                  {historique.lignes.map((l, k) => (
                    <EntreeHistorique key={k} ligne={l} />
                  ))}
                </ol>
                {historiqueACompleter ? (
                  <div className="border-t border-line px-4 py-3">
                    <button
                      type="button"
                      disabled={lectureHistorique}
                      onClick={() => void lireToutLHistorique()}
                      className="min-h-12 w-full rounded-2xl bg-segment-fond px-4 text-base font-semibold text-ink disabled:opacity-60"
                    >
                      {lectureHistorique ? 'Lecture de l’historique…' : 'Voir l’historique plus ancien'}
                    </button>
                    {refusHistorique ? <p className="mt-2 text-sm text-ink-2">{refusHistorique.message}</p> : null}
                  </div>
                ) : null}
                {historiqueTronque ? (
                  <p className="border-t border-line px-4 py-3 text-sm text-ink-2">L’historique plus ancien n’est pas affiché ici.</p>
                ) : null}
              </details>
            </li>
          </Groupe>
        ) : null}

        {refus ? (
          <ListeSignalements
            signalements={[refus]}
            libelleCorrectionPour={(s) => sortieDe(s).libelle}
            onCorriger={(s, v) => {
              if (s.code === 'ERR_DECOMPTE_INCOMPLET') allerAuxCases(v);
              else {
                setRefus(null);
                void onChange();
              }
            }}
            autreSortiePour={(s) => {
              if (s.valeurProposee !== undefined) return undefined;
              // Panne réseau : un VRAI bouton qui refait la dernière action (audit 28/10/2026, point 2).
              if (s.code === 'ERR_SERVEUR_INDISPONIBLE' && derniere) {
                return (
                  <button
                    type="button"
                    onClick={derniere}
                    className="min-h-11 rounded-full bg-sortie px-4 text-base font-semibold text-sortie-texte"
                  >
                    Réessayer
                  </button>
                );
              }
              const so = sortieDe(s);
              const texte = so.libelle ?? so.autre;
              return texte ? <p className="text-sm text-ink-2">{texte}.</p> : undefined;
            }}
          />
        ) : null}
      </div>

      {/* ------------------------------------------------ Actions, à portée du pouce */}
      <footer className="space-y-2 border-t border-line bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        {manquePrenom && vivante ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm text-ink-2">Qui êtes-vous&nbsp;?</span>
            {equipe.map((nom) => (
              <button
                key={nom}
                type="button"
                onClick={() => definirVendeur(nom)}
                className="min-h-11 rounded-full bg-segment-fond px-4 text-sm font-medium text-ink"
              >
                {nom}
              </button>
            ))}
          </div>
        ) : null}

        {decompte ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDecompte(null);
                setRefus(null);
              }}
              className="min-h-14 rounded-2xl bg-segment-fond px-5 text-base font-semibold text-ink"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={occupe || manquePrenom}
              onClick={validerRetrait}
              className="min-h-14 flex-1 rounded-2xl bg-accent px-4 text-lg font-semibold text-accent-texte disabled:opacity-60"
            >
              Valider le retrait
            </button>
          </div>
        ) : (
          <>
            {commande.statut === 'imprimee' ? (
              <button
                type="button"
                disabled={occupe}
                onClick={() => {
                  setRefus(null);
                  setDecompte({});
                }}
                className="min-h-14 w-full rounded-2xl bg-accent px-4 text-lg font-semibold text-accent-texte disabled:opacity-60"
              >
                {GESTE_RETRAIT}
              </button>
            ) : commande.statut === 'a_imprimer' ? (
              <>
                <Link
                  href={`/commandes/${commande.id}/imprimer`}
                  className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-accent px-4 text-lg font-semibold text-accent-texte"
                >
                  Imprimer le bon
                </Link>
                <p className="text-center text-sm text-ink-2">Imprimez le bon avant le retrait, s’il vous plaît.</p>
              </>
            ) : null}
            <div className="flex gap-2">
              {commande.statut !== 'a_imprimer' && commande.statut !== 'annulee' ? (
                <Link
                  href={`/commandes/${commande.id}/imprimer`}
                  className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-segment-fond px-4 text-base font-semibold text-ink"
                >
                  Imprimer le bon
                </Link>
              ) : null}
              {vivante ? (
                <Link
                  href={`/commandes/${commande.id}/modifier`}
                  className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-segment-fond px-4 text-base font-semibold text-ink"
                >
                  Modifier
                </Link>
              ) : null}
            </div>
            {vivante ? (
              // Discret et destructif : jamais plus gros que « Modifier », confirmé dans une fenêtre.
              <button
                type="button"
                disabled={occupe}
                onClick={() => {
                  setRefus(null);
                  setAnnulation(true);
                }}
                className="min-h-11 w-full rounded-2xl px-4 text-base font-medium text-bloquant hover:bg-bloquant-doux disabled:opacity-60"
              >
                Annuler la commande
              </button>
            ) : null}
          </>
        )}
      </footer>

      {annulation ? (
        <FenetreAnnulation
          commande={commande}
          occupe={occupe}
          onGarder={() => setAnnulation(false)}
          onAnnuler={(motif, gerant, codeGerant) => agir('annulation', { motif, gerant, codeGerant })}
          onPerimee={() => {
            setAnnulation(false);
            void onChange();
          }}
        />
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- Historique */

/** Événements de la liste et de la lecture complète, sans doublon (clé : instant + action). */
function fusionnerEvenements(
  liste: readonly EvenementCommande[] | undefined,
  complet: readonly EvenementCommande[] | null,
): EvenementCommande[] {
  const vus = new Set<string>();
  const tous: EvenementCommande[] = [];
  for (const e of [...(liste ?? []), ...(complet ?? [])]) {
    const cle = `${e.quand}|${e.action}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    tous.push(e);
  }
  return tous;
}

/** Une entrée dépliée : qui, quand, puis un changement par ligne. */
function EntreeHistorique({ ligne }: { ligne: LigneHistorique }) {
  return (
    <li className="px-4 py-3">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-ink">
        <span className="font-medium">{ligne.resume}</span>
        {ligne.aReimprimer ? <Pastille ton="accent">Réimpression demandée</Pastille> : null}
      </p>
      {ligne.changements.length > 0 ? (
        <ul className="mt-1.5 space-y-1.5">
          {ligne.changements.map((c, k) => (
            <li key={k} className="text-sm text-ink">
              <span className="text-ink-2">{c.libelle}&nbsp;: </span>
              {c.avant !== undefined && c.apres !== undefined ? (
                <span className="break-words">
                  <span className="text-ink-2 line-through">{c.avant}</span> → <span className="font-semibold">{c.apres}</span>
                </span>
              ) : null}
              {(c.textes ?? []).map((t, i) => (
                <span key={i} className={`break-words ${(c.textes ?? []).length > 1 ? 'block' : ''}`}>
                  {t}
                </span>
              ))}
            </li>
          ))}
        </ul>
      ) : null}
      {ligne.bloc ? <p className="mt-1.5 whitespace-pre-line break-words text-sm text-ink-2">{ligne.bloc}</p> : null}
    </li>
  );
}

/* ------------------------------------------------- Fenêtre « Annuler la commande » */

const CHAMP_FENETRE = 'min-h-12 w-full rounded-xl border-2 border-line-fort bg-surface px-3 text-lg text-ink placeholder:text-ink-3';


/**
 * Confirmation d'une annulation (R68, propriétaire 11/11/2026). « Garder la
 * commande » est le choix par défaut (focus, Échap, toucher à côté) : rien
 * n'est annulé sans un second geste voulu. Trois choses avant ce geste :
 * le code du manager (ressaisi à chaque annulation), le motif, puis le
 * bouton « Annuler la commande ». AUCUNE règle ici : `validerAnnulation`
 * (domaine) dit ce qui manque, le serveur la rejoue et vérifie l'accès.
 */
function FenetreAnnulation({
  commande,
  occupe,
  onGarder,
  onAnnuler,
  onPerimee,
}: {
  commande: Commande;
  occupe: boolean;
  onGarder: () => void;
  /** Envoie l'annulation ; rend le refus du serveur (ou de la connexion), null si c'est fait. */
  onAnnuler: (motif: string, gerant: string, codeGerant: string) => Promise<Echec | null>;
  /** La commande a changé ailleurs (déjà retirée, déjà annulée) : fermer et recharger. */
  onPerimee: () => void;
}) {
  const fenetre = useRef<HTMLDialogElement>(null);
  const garder = useRef<HTMLButtonElement>(null);
  const champMotif = useRef<HTMLTextAreaElement>(null);
  // Décision du propriétaire (11/11/2026) : le code du manager est saisi à CHAQUE
  // annulation, même si son accès est déjà ouvert sur la tablette. Il n'est gardé
  // nulle part : il part avec la demande et le serveur le vérifie.
  const champCode = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [par, setPar] = useState('');
  const [motif, setMotif] = useState('');
  const [refus, setRefus] = useState<Echec | null>(null);

  useEffect(() => {
    const d = fenetre.current;
    if (d && !d.open) d.showModal();
    garder.current?.focus();
  }, []);

  const confirmer = async () => {
    // Même règle que le serveur : ce qui manque (code du manager, motif) est dit tout de suite.
    const local = validerAnnulation({
      statut: commande.statut,
      motif,
      gerant: code.trim() ? par.trim() || 'manager' : null,
      acompteCentimes: commande.acompteCentimes,
    });
    if (!local.ok) {
      setRefus(local);
      return;
    }
    // En ligne seulement : une annulation ne part jamais dans la file hors ligne.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const e = echecReseau();
      if (!e.ok) setRefus(e);
      return;
    }
    setRefus(null);
    const r = await onAnnuler(local.donnees.motif, par.trim(), code.trim());
    if (!r) return;
    // Code refusé : il est effacé, à ressaisir.
    if (r.champ === 'code' || r.code === 'ERR_DROIT_INSUFFISANT') setCode('');
    setRefus(r);
  };

  const sortieDuRefus = (s: SignalementAffichable) => {
    const bouton = 'min-h-11 rounded-full bg-sortie px-4 text-base font-semibold text-sortie-texte';
    if (s.code === 'ERR_SERVEUR_INDISPONIBLE') {
      return (
        <span className="grid gap-2">
          <span className="text-sm text-ink-2">La commande n’est pas annulée. L’annulation se fait avec le réseau.</span>
          <button type="button" disabled={occupe} onClick={() => void confirmer()} className={`${bouton} disabled:opacity-60`}>
            Réessayer
          </button>
        </span>
      );
    }
    if (s.code === 'ERR_STATUT_INCOHERENT') {
      return (
        <button type="button" onClick={onPerimee} className={bouton}>
          Revoir la commande
        </button>
      );
    }
    if (s.champ === 'motif') {
      return (
        <button type="button" onClick={() => champMotif.current?.focus()} className={bouton}>
          Écrire le motif
        </button>
      );
    }
    if (s.code === 'ERR_DROIT_INSUFFISANT' || s.code === 'ERR_CODE_INCORRECT') {
      return (
        <button type="button" onClick={() => champCode.current?.focus()} className={bouton}>
          Saisir le code du manager
        </button>
      );
    }
    const so = sortieDe(s);
    const texte = so.libelle ?? so.autre;
    return texte ? <p className="text-sm text-ink-2">{texte}.</p> : undefined;
  };

  return (
    <dialog
      ref={fenetre}
      aria-labelledby="annulation-titre"
      aria-describedby="annulation-texte"
      onClose={onGarder}
      // Pendant l'envoi, la fenêtre ne se ferme pas : la réponse doit être lue.
      onCancel={(e) => {
        if (occupe) e.preventDefault();
      }}
      // Toucher à côté (sur le voile) = « Garder la commande ».
      onClick={(e) => {
        if (e.target === e.currentTarget && !occupe) e.currentTarget.close();
      }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md border-0 bg-transparent p-0 text-ink backdrop:bg-voile"
    >
      <div className="max-h-[88dvh] overflow-y-auto overscroll-contain rounded-2xl bg-surface p-5 shadow-xl">
        <h2 id="annulation-titre" className="text-lg font-bold text-ink">
          Annuler la commande n°&nbsp;<span className="chiffres">{commande.numero}</span>&nbsp;?
        </h2>
        <p id="annulation-texte" className="mt-1 text-base text-ink-2">
          La commande de {commande.client} ne sera plus à préparer. Elle reste consultable dans les commandes annulées.
        </p>

        {/* (c) Le choix sûr, en premier et sous le doigt. */}
        <button
          ref={garder}
          type="button"
          disabled={occupe}
          onClick={() => fenetre.current?.close()}
          className="mt-4 min-h-12 w-full rounded-xl bg-accent text-base font-semibold text-accent-texte disabled:opacity-60"
        >
          Garder la commande
        </button>

        {/* (a) Accès manager. */}
        <div className="mt-5">
          <p className="mb-1.5 text-sm text-ink-2">Seul le manager peut annuler une commande.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm text-ink-2">Qui autorise&nbsp;?</span>
              <input
                value={par}
                onChange={(e) => setPar(e.target.value)}
                placeholder="Prénom du manager"
                autoComplete="off"
                maxLength={40}
                className={CHAMP_FENETRE}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-ink-2">Code du manager</span>
              <input
                ref={champCode}
                type="password"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setRefus(null);
                }}
                autoComplete="off"
                maxLength={64}
                className={CHAMP_FENETRE}
              />
            </label>
          </div>
        </div>

        {/* (b) Motif obligatoire : un toucher, ou quelques mots. */}
        <div className="mt-5">
          <p id="annulation-motif" className="mb-1.5 text-sm text-ink-2">
            Pourquoi cette annulation&nbsp;?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {MOTIFS_ANNULATION.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={motif === m}
                onClick={() => {
                  setMotif(m);
                  setRefus(null);
                }}
                className={`min-h-11 rounded-full border px-4 text-base font-medium ${
                  motif === m ? 'border-ink bg-ink text-surface' : 'border-transparent bg-segment-fond text-ink'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <textarea
            ref={champMotif}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            aria-labelledby="annulation-motif"
            placeholder="Ou écrivez le motif"
            rows={2}
            maxLength={200}
            className={`${CHAMP_FENETRE} mt-2 py-2`}
          />
        </div>

        {refus ? <ListeSignalements className="mt-4" signalements={[refus]} autreSortiePour={sortieDuRefus} /> : null}

        {/* (d) Le geste destructif, en dernier. */}
        <button
          type="button"
          disabled={occupe}
          onClick={() => void confirmer()}
          className="mt-4 min-h-12 w-full rounded-xl border-2 border-line-fort bg-surface text-base font-semibold text-bloquant disabled:opacity-60"
        >
          {occupe ? 'Annulation en cours…' : 'Annuler la commande'}
        </button>
      </div>
    </dialog>
  );
}

/* ------------------------------------------------- Liste groupée (fiche) */

function Groupe({ titre, children }: { titre?: string; children: React.ReactNode }) {
  return (
    <section>
      {titre ? <h3 className="mb-1.5 px-4 text-sm text-ink-2">{titre}</h3> : null}
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">{children}</ul>
    </section>
  );
}

function Cellule({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <li className="flex min-h-12 items-center justify-between gap-4 px-4 py-2.5">
      <span className="shrink-0 text-base text-ink-2">{libelle}</span>
      <span className="min-w-0 text-right text-base">{children}</span>
    </li>
  );
}
