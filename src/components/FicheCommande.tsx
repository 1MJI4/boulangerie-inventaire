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

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { IconeNiveau, ListeSignalements } from '@/components/signalement';
import { echecReseau, lireReponse } from '@/components/commande/modele';
import { sortieDe } from '@/components/commande/sorties';
import { EtiquetteType, PastilleStatut } from '@/components/fiche/ElementsCommande';
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
import { attendUnVirement, typesDeCommande, type Commande } from '@/lib/commandes';
import { formatDateLong } from '@/lib/dateProduction';
import { formaterEuros, resteDu } from '@/domaine/argent';
import { totalLigne } from '@/domaine/unites';
import { validerTransitionStatut } from '@/domaine/coherence';
import type { Echec } from '@/domaine/resultat';

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
  const ouverte = commande !== null;

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
      onClose={onFermer}
      // Toucher à côté (sur le voile) : la cible est le <dialog> lui-même.
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="fiche-commande fixed inset-x-0 bottom-0 top-auto m-0 max-h-none w-full max-w-none border-0 bg-transparent p-0 text-ink md:inset-y-0 md:left-auto md:right-0 md:h-dvh md:max-h-none md:w-[32rem]"
    >
      {/* Clé : un état propre (décompte, refus) pour chaque commande ouverte. */}
      {commande ? <Contenu key={commande.id} commande={commande} onChange={onChange} fermer={() => dialogue.current?.close()} /> : null}
    </dialog>
  );
}

/* ----------------------------------------------------------- Le contenu */

function Contenu({ commande, onChange, fermer }: { commande: Commande; onChange: () => void | Promise<void>; fermer: () => void }) {
  const { equipe, vendeur, definirVendeur } = useEquipe();
  const [occupe, setOccupe] = useState(false);
  const [refus, setRefus] = useState<Echec | null>(null);
  const [derniere, setDerniere] = useState<(() => void) | null>(null);
  // R58 : décompte des articles devant le client, avant « Retirée par le client ».
  const [decompte, setDecompte] = useState<Record<string, boolean> | null>(null);
  const cases = useRef<Record<string, HTMLInputElement | null>>({});

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

  const agir = async (action: 'remise' | 'acompte', enPlus: Record<string, unknown> = {}) => {
    setOccupe(true);
    setRefus(null);
    setDerniere(() => () => void agir(action, enPlus));
    try {
      const r = await lireReponse(
        await fetch('/api/commandes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: commande.id, action, auteur: vendeur ?? undefined, ...enPlus }),
        }),
      );
      if (!r.ok) {
        setRefus(r);
        return;
      }
      setDecompte(null);
      if (action === 'remise') fermer();
      await onChange();
    } catch {
      const e = echecReseau();
      if (!e.ok) setRefus(e);
    } finally {
      setOccupe(false);
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
      <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
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
              {commande.statut !== 'a_imprimer' ? (
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
          </>
        )}
      </footer>
    </div>
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
