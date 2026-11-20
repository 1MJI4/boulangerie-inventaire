'use client';

// src/components/FenetreImpressionFeuille.tsx
//
// La fenêtre qui suit l'impression de la feuille de prévisions (propriétaire,
// 20/11/2026 : « une pop-up d'animation de ticket pour bien suivre
// l'impression »). Même imprimante animée que pour les bons de commande :
// le papier qui sort à l'écran est le PNG qui part à l'imprimante, au rythme
// mesuré de la vraie imprimante.
//
// Déroulé : préparation du ticket → dépôt dans la file → « Ça imprime » dès que
// l'imprimante le prend → « Sorti » à sa confirmation. Rien ne bloque : on peut
// fermer, l'imprimante finit toute seule. Sans nouvelle depuis un moment, on
// dit quoi vérifier (papier, capot) et on propose de relancer. Aucun message
// technique (LOI 9).

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bouton } from '@/components/ui';
import { ImprimanteTicket, type LotImprime } from '@/components/ImprimanteTicket';
import type { FeuillePrevisions } from '@/domaine/feuillePrevisions';
import { messagePour } from '@/domaine/messages';
import { feuilleEnPng } from '@/lib/feuilleCanvas';
import { apprendreVitesse, lireMsParLigne } from '@/lib/vitesseImpression';

type Travail = { id: number; destination: string; statut: string; erreur: string | null };
type EtatImprimante = { statusCode: string; vueLe: string } | null;

/** Sans progrès pendant ce délai, on rend la main pour relancer. */
const BLOQUE_APRES_MS = 45_000;
/** Sans nouvelle de l'imprimante depuis ce délai, on la dit injoignable. */
const INJOIGNABLE_APRES_MS = 45_000;

type Phase = 'preparation' | 'envoi' | 'suivi' | 'refuse';

export function FenetreImpressionFeuille({
  feuille,
  numero,
  onFermer,
}: {
  feuille: FeuillePrevisions;
  /** Identifie le travail dans la file (« Prévisions 2026-11-21 patissier »). */
  numero: string;
  onFermer: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('preparation');
  const [erreur, setErreur] = useState<string | null>(null);
  const [papier, setPapier] = useState<{ image: string; hauteur: number } | null>(null);
  const [travail, setTravail] = useState<Travail | null>(null);
  const [imprimante, setImprimante] = useState<EtatImprimante>(null);
  const [lot, setLot] = useState<LotImprime | null>(null);
  const lotRef = useRef<{ debut: number; fini: boolean } | null>(null);
  const [dernierProgres, setDernierProgres] = useState(() => Date.now());
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [tentative, setTentative] = useState(0);
  const statutVu = useRef<string>('');

  // Préparer le ticket, le déposer dans la file. Relancé à chaque tentative.
  useEffect(() => {
    let annule = false;
    setPhase('preparation');
    setErreur(null);
    setTravail(null);
    setLot(null);
    lotRef.current = null;
    statutVu.current = '';
    (async () => {
      try {
        const { png, hauteur } = await feuilleEnPng(
          feuille,
          new Date().toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' }),
        );
        if (annule) return;
        setPapier({ image: `data:image/png;base64,${png}`, hauteur });
        setPhase('envoi');
        const reponse = await fetch('/api/impression', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ numero, tickets: [{ destination: 'PREVISIONS', png }] }),
        });
        if (annule) return;
        if (!reponse.ok) throw new Error('refus');
        setDernierProgres(Date.now());
        setPhase('suivi');
      } catch {
        if (annule) return;
        setErreur(messagePour('ERR_FEUILLE_NON_ENVOYEE', {}));
        setPhase('refuse');
      }
    })();
    return () => {
      annule = true;
    };
  }, [feuille, numero, tentative]);

  const lire = useCallback(async (): Promise<Travail | null> => {
    try {
      const r = await fetch(`/api/impression?numero=${encodeURIComponent(numero)}`, { cache: 'no-store' });
      const d = await r.json();
      setImprimante(d.imprimante ?? null);
      return Array.isArray(d.travaux) && d.travaux.length > 0 ? (d.travaux[d.travaux.length - 1] as Travail) : null;
    } catch {
      return null;
    }
  }, [numero]);

  // Tant que le ticket n'est pas sorti, on regarde souvent : l'animation se cale
  // sur le moment où l'imprimante le prend et sur celui où elle confirme.
  const hauteur = papier?.hauteur ?? 1000;
  useEffect(() => {
    if (phase !== 'suivi' || !papier) return;
    const minuteur = setInterval(async () => {
      const t = await lire();
      const maint = Date.now();
      setMaintenant(maint);
      if (!t) return;
      setTravail(t);
      if (t.statut !== statutVu.current) {
        statutVu.current = t.statut;
        setDernierProgres(maint);
      }
      const courant = lotRef.current;
      if (t.statut === 'remis' && !courant) {
        lotRef.current = { debut: maint, fini: false };
        setLot({
          cle: `feuille-${t.id}`,
          tickets: [{ image: papier.image, hauteur }],
          debut: maint,
          dureeMs: hauteur * lireMsParLigne(),
          fini: false,
        });
      } else if (t.statut === 'imprime') {
        if (courant && !courant.fini) {
          apprendreVitesse(maint - courant.debut, hauteur);
          lotRef.current = { ...courant, fini: true };
          setLot((l) => (l ? { ...l, fini: true } : l));
        } else if (!courant) {
          // Sorti plus vite qu'un tour de relevé : on le montre quand même.
          lotRef.current = { debut: maint, fini: true };
          setLot({ cle: `feuille-${t.id}`, tickets: [{ image: papier.image, hauteur }], debut: maint, dureeMs: 1, fini: true });
        }
      }
    }, 600);
    return () => clearInterval(minuteur);
  }, [phase, papier, hauteur, lire]);

  const sorti = travail?.statut === 'imprime';
  const enImpression = travail?.statut === 'remis';
  const suiviEnCours = phase === 'suivi' && !sorti;
  const bloque = suiviEnCours && maintenant - dernierProgres > BLOQUE_APRES_MS;
  const enLigne = imprimante ? maintenant - Date.parse(imprimante.vueLe) < INJOIGNABLE_APRES_MS : false;
  const probleme = !!imprimante && !!imprimante.statusCode && !/^200/.test(imprimante.statusCode);

  const libelleMachine =
    phase === 'preparation'
      ? 'Préparation…'
      : phase === 'envoi'
        ? 'Envoi…'
        : sorti
          ? 'Ticket sorti'
          : bloque
            ? 'Vérifiez le papier'
            : enImpression
              ? 'Imprime la feuille'
              : 'En file';
  const etatMachine = sorti ? 'fini' : bloque || phase === 'refuse' ? 'bloque' : phase === 'suivi' && enImpression ? 'impression' : 'envoi';

  // Barre qui ne s'arrête jamais mais ne promet pas plus que ce qui est vrai.
  const remplissage = sorti ? 1 : enImpression ? 0.6 : phase === 'suivi' ? 0.25 : phase === 'envoi' ? 0.12 : 0.04;

  // Échap ferme la fenêtre : l'impression continue toute seule.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [onFermer]);

  return (
    <div className="sans-impression fixed inset-0 z-[60] flex items-center justify-center bg-voile p-4" onClick={onFermer}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-impression-feuille"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-3xl bg-surface p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
      >
        <h2 id="titre-impression-feuille" className="text-center text-lg font-semibold text-ink">
          {feuille.titre}
        </h2>
        <p className="mb-3 text-center text-sm text-ink-2">{feuille.sousTitre}</p>

        <div role="status" aria-live="polite">
          <ImprimanteTicket
            etat={etatMachine}
            libelle={libelleMachine}
            sortis={sorti ? 1 : 0}
            total={phase === 'suivi' || sorti ? 1 : 0}
            lot={lot}
          />

          <div className="mx-auto mt-3 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-segment-fond">
            <div
              className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${sorti ? 'bg-ok' : 'bg-accent'}`}
              style={{ width: `${Math.round(remplissage * 100)}%` }}
            />
          </div>

          <p className="mt-3 text-center text-base font-semibold text-ink">
            {phase === 'refuse'
              ? 'Le ticket n’est pas parti'
              : sorti
                ? '✓ La feuille est sortie'
                : bloque
                  ? 'L’impression n’avance plus'
                  : enImpression
                    ? 'Ça imprime…'
                    : phase === 'suivi'
                      ? '✓ Envoyé à l’imprimante'
                      : 'Préparation du ticket…'}
          </p>
          {phase === 'refuse' && erreur ? <p className="mt-1 text-center text-sm text-ink-2">{erreur}</p> : null}
          {bloque ? (
            <p className="mt-1 text-center text-sm text-ink-2">
              Vérifiez le papier et le capot de l’imprimante, puis touchez «&nbsp;Relancer&nbsp;».
            </p>
          ) : null}
          {suiviEnCours && !bloque ? (
            <p className="mt-1 text-center text-sm text-ink-2">
              Vous pouvez fermer : le ticket sort tout seul.
            </p>
          ) : null}
          {probleme ? (
            <p className="mt-2 rounded-xl bg-avertissement-doux px-3 py-2 text-center text-sm text-ink">
              L’imprimante signale un problème, le plus souvent plus de papier ou le capot ouvert. Le ticket
              restera en file et sortira une fois réglé.
            </p>
          ) : imprimante && !enLigne && phase === 'suivi' && !sorti ? (
            <p className="mt-2 rounded-xl bg-avertissement-doux px-3 py-2 text-center text-sm text-ink">
              L’imprimante ne répond pas pour l’instant. Vérifiez qu’elle est allumée et sur le réseau du magasin.
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {phase === 'refuse' || bloque || sorti ? (
            <Bouton variante="secondaire" onClick={() => setTentative((n) => n + 1)}>
              {sorti ? 'Réimprimer' : phase === 'refuse' ? 'Réessayer' : 'Relancer'}
            </Bouton>
          ) : null}
          <Bouton variante={sorti ? 'principal' : 'secondaire'} onClick={onFermer} autoFocus>
            {sorti ? 'Terminé' : 'Fermer'}
          </Bouton>
        </div>
      </div>
    </div>
  );
}
