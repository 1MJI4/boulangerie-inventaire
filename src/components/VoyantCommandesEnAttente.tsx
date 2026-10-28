'use client';

// src/components/VoyantCommandesEnAttente.tsx
//
// Le voyant des commandes gardées sur la tablette faute de réseau
// (propriétaire : `data-offline`). Même emplacement et même allure que le
// voyant d'impression (SuiviImpression, en bas à gauche, loin du pavé droitier),
// qui l'affiche au-dessus de ses propres pastilles.
//
//   « 2 commandes en attente d'envoi » → « Envoi… » → « Commande n° … envoyée ✓ »
//   « 1 commande à reprendre » (le magasin l'a refusée) : touchez pour la rouvrir.
//
// Il démarre aussi l'envoi automatique : il est monté sur toutes les pages.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formaterDate } from '@/domaine/calendrier';
import { texteHeureRetrait } from '@/components/commande/saisieEnCours';
import {
  CONFIRMATION_ENVOI_MS,
  FILE_VIDE,
  resumer,
  TEXTES_HORS_LIGNE as T,
  type CommandeEnAttente,
  type FileCommandes,
} from '@/lib/commandesHorsLigne';
import {
  demarrerEnvoiAutomatique,
  ecouterCommandesEnAttente,
  envoyerCommandesEnAttente,
  lireCommandesEnAttente,
  mettreDeCote,
} from '@/lib/envoiHorsLigne';

const PASTILLE = 'pointer-events-auto flex min-h-12 items-center gap-3 rounded-full border py-1.5 pl-2 pr-4 text-left shadow-lg transition-colors';

/** Adresse pour rouvrir une commande refusée, avec sa saisie telle qu'elle a été gardée. */
export function adresseReprise(c: CommandeEnAttente): string {
  const reprise = `reprise=${encodeURIComponent(c.idClient)}`;
  return c.methode === 'PATCH' && c.commandeId !== null ? `/commandes/${c.commandeId}/modifier?${reprise}` : `/commandes/nouvelle?${reprise}`;
}

function Point({ ton, anime = false }: { ton: string; anime?: boolean }) {
  return (
    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2">
      <span className={`h-3 w-3 rounded-full ${ton} ${anime ? 'animate-pulse' : ''}`} />
    </span>
  );
}

export function VoyantCommandesEnAttente() {
  const [file, setFile] = useState<FileCommandes>(FILE_VIDE);
  const [horloge, setHorloge] = useState(0);
  const [ouvert, setOuvert] = useState(false);
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);

  useEffect(() => {
    const relire = () => {
      setFile(lireCommandesEnAttente());
      setHorloge(Date.now());
    };
    relire();
    const arreterEcoute = ecouterCommandesEnAttente(relire);
    const arreterEnvoi = demarrerEnvoiAutomatique();
    return () => {
      arreterEcoute();
      arreterEnvoi();
    };
  }, []);

  const r = resumer(file, horloge);
  const nbRecentes = r.envoyeesRecentes.length;

  // « Envoyée ✓ » s'efface tout seul.
  useEffect(() => {
    if (!nbRecentes) return;
    const t = setTimeout(() => setHorloge(Date.now()), CONFIRMATION_ENVOI_MS);
    return () => clearTimeout(t);
  }, [nbRecentes, horloge]);

  const actives = file.commandes.filter((c) => c.etat === 'en_attente' || c.etat === 'envoi' || c.etat === 'a_reprendre');
  const enCours = r.enAttente + r.enEnvoi;
  if (!actives.length && !nbRecentes) return null;

  return (
    <>
      {ouvert && actives.length ? (
        <div className="pointer-events-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">Commandes gardées sur cette tablette</p>
            <button type="button" className="min-h-10 rounded-lg px-3 text-sm text-accent" onClick={() => setOuvert(false)}>
              Fermer
            </button>
          </div>
          <ul className="grid max-h-[50vh] gap-2 overflow-y-auto">
            {actives.map((c) => (
              <li key={c.idClient} className="rounded-xl border border-line p-2">
                <p className="text-base font-medium text-ink">
                  {c.client || 'Client sans nom'}
                  {c.numero ? <span className="text-ink-2"> · bon n°&nbsp;{c.numero}</span> : null}
                </p>
                <p className="text-sm text-ink-2">
                  {c.dateRetrait ? `Retrait ${formaterDate(c.dateRetrait)}, ${texteHeureRetrait(c.heureRetrait)}` : 'Jour de retrait à fixer'}
                  {' · '}
                  {c.etat === 'a_reprendre' ? 'à reprendre' : c.etat === 'envoi' ? 'envoi…' : 'en attente d’envoi'}
                </p>
                {c.etat === 'a_reprendre' ? (
                  <>
                    {c.refus ? <p className="mt-1 text-sm text-alerte">{c.refus.message}</p> : null}
                    <p className="mt-1 text-sm text-ink-2">{T.aReprendreAide}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link
                        href={adresseReprise(c)}
                        onClick={() => setOuvert(false)}
                        className="inline-flex min-h-12 items-center rounded-xl border-2 border-sortie px-4 text-base font-semibold text-sortie"
                      >
                        {T.rouvrir}
                      </Link>
                      <button
                        type="button"
                        className="min-h-12 rounded-xl border-2 border-line-fort px-4 text-base text-ink-2"
                        onClick={() => {
                          if (aConfirmer !== c.idClient) return setAConfirmer(c.idClient);
                          setAConfirmer(null);
                          mettreDeCote(c.idClient);
                        }}
                      >
                        {aConfirmer === c.idClient ? 'Touchez encore pour confirmer' : T.mettreDeCote}
                      </button>
                    </div>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
          {r.enAttente > 0 ? (
            <button
              type="button"
              className="mt-2 min-h-12 w-full rounded-xl border-2 border-accent text-base font-semibold text-accent"
              onClick={() => void envoyerCommandesEnAttente()}
            >
              {T.envoyerMaintenant}
            </button>
          ) : null}
        </div>
      ) : null}

      {r.envoyeesRecentes.map((c) => (
        <Link
          key={c.idClient}
          href={c.commandeId !== null ? `/commandes/${c.commandeId}/imprimer` : '/commandes'}
          className={`${PASTILLE} border-ok/40 bg-ok-doux text-ok`}
        >
          <Point ton="bg-ok" />
          <span className="text-sm">
            <span className="font-semibold text-ink">{T.envoyee(c.numero)}</span>{' '}
            <span className="text-ink-2">— touchez pour imprimer le bon</span>
          </span>
        </Link>
      ))}

      {r.aReprendre > 0 ? (
        <button type="button" onClick={() => setOuvert((o) => !o)} className={`${PASTILLE} border-attention/50 bg-attention-doux text-attention`}>
          <Point ton="bg-attention" />
          <span className="text-sm font-semibold text-ink">{T.aReprendre(r.aReprendre)}</span>
        </button>
      ) : null}

      {enCours > 0 ? (
        <button type="button" onClick={() => setOuvert((o) => !o)} className={`${PASTILLE} border-line bg-surface text-accent`}>
          <Point ton="bg-accent" anime={r.enEnvoi > 0} />
          <span className="text-sm">
            <span className="font-semibold text-ink">{T.enAttente(enCours)}</span>
            {r.enEnvoi > 0 ? <span className="text-ink-2"> — {T.envoi}</span> : null}
          </span>
        </button>
      ) : null}
    </>
  );
}
