'use client';

// src/components/SuiviImpression.tsx
//
// Le voyant d'impression en bas d'écran.
//
// L'imprimante Star met une quinzaine de secondes à venir chercher les tickets
// et à les sortir. Plutôt que de retenir le vendeur devant l'écran
// d'impression, on le laisse passer à la suite dès le dépôt dans la file, et
// ce voyant discret suit le travail partout dans l'application : « 2 sur 4 »,
// puis « ✓ imprimé », puis il s'efface tout seul. Il ne se fait remarquer que
// si l'impression n'avance plus.
//
// En bas à gauche : le pavé numérique de saisie est à droite (droitier).

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ImprimanteAnimee } from '@/components/ImprimanteAnimee';
import {
  ecouterImpressionsSuivies,
  lireImpressionsSuivies,
  oublierImpression,
  type ImpressionSuivie,
} from '@/lib/suiviImpression';

type Avancement = { sortis: number; total: number; pas: number; dernierProgres: number };

/** Même seuil que l'écran d'impression : sans progrès, on prévient. */
const BLOQUE_APRES_MS = 45_000;
/** Le « ✓ imprimé » reste visible ce temps-là, puis le voyant s'efface. */
const CONFIRMATION_MS = 4_000;

export function SuiviImpression() {
  const chemin = usePathname();
  const [suivies, setSuivies] = useState<ImpressionSuivie[]>([]);
  const [avancements, setAvancements] = useState<Record<number, Avancement>>({});
  const [horloge, setHorloge] = useState(0);
  const termines = useRef(new Set<number>());

  useEffect(() => {
    const relire = () => setSuivies(lireImpressionsSuivies());
    relire();
    return ecouterImpressionsSuivies(relire);
  }, []);

  useEffect(() => {
    const enCours = suivies.filter((s) => !termines.current.has(s.commandeId));
    if (!enCours.length) return;
    let annule = false;

    const tour = async () => {
      for (const suivie of enCours) {
        try {
          const reponse = await fetch(`/api/impression?commandeId=${suivie.commandeId}`, { cache: 'no-store' });
          if (!reponse.ok) {
            // Session perdue ou commande disparue : on n'insiste pas.
            if (reponse.status === 401 || reponse.status === 403 || reponse.status === 404) {
              oublierImpression(suivie.commandeId);
            }
            continue;
          }
          const donnees = await reponse.json();
          const travaux: { statut: string }[] = Array.isArray(donnees.travaux) ? donnees.travaux : [];
          if (annule || !travaux.length) continue;
          const sortis = travaux.filter((t) => t.statut === 'imprime').length;
          // en file → en train d'imprimer → sorti : chaque pas compte comme un progrès.
          const pas = travaux.reduce((n, t) => n + (t.statut === 'imprime' ? 2 : t.statut === 'remis' ? 1 : 0), 0);
          setAvancements((avant) => {
            const ancien = avant[suivie.commandeId];
            const dernierProgres = !ancien || ancien.pas !== pas ? Date.now() : ancien.dernierProgres;
            return { ...avant, [suivie.commandeId]: { sortis, total: travaux.length, pas, dernierProgres } };
          });
          if (sortis === travaux.length && !termines.current.has(suivie.commandeId)) {
            termines.current.add(suivie.commandeId);
            setTimeout(() => {
              oublierImpression(suivie.commandeId);
              termines.current.delete(suivie.commandeId);
            }, CONFIRMATION_MS);
          }
        } catch {
          // Réseau faible : on réessaie au tour suivant.
        }
      }
      if (!annule) setHorloge(Date.now());
    };

    void tour();
    const minuteur = setInterval(() => void tour(), 1500);
    return () => {
      annule = true;
      clearInterval(minuteur);
    };
  }, [suivies]);

  // Sur l'écran d'impression d'une commande, c'est lui qui montre le détail.
  const visibles = suivies.filter((s) => chemin !== `/commandes/${s.commandeId}/imprimer`);
  if (!visibles.length) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="ecran-seulement pointer-events-none fixed print:hidden bottom-4 left-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {visibles.map((suivie) => {
        const a = avancements[suivie.commandeId];
        const fini = !!a && a.sortis === a.total;
        const depart = a?.dernierProgres ?? suivie.envoyeLe;
        const bloque = !fini && horloge - depart > BLOQUE_APRES_MS;
        const ton = fini
          ? 'border-ok/40 bg-ok-doux text-ok'
          : bloque
            ? 'border-attention/50 bg-attention-doux text-attention'
            : 'border-line bg-surface text-accent';
        return (
          <Link
            key={suivie.commandeId}
            href={`/commandes/${suivie.commandeId}/imprimer`}
            className={`pointer-events-auto flex min-h-12 items-center gap-3 rounded-full border py-1.5 pl-2 pr-4 shadow-lg transition-colors ${ton}`}
          >
            <ImprimanteAnimee active={!fini && !bloque} className="h-8 w-8" />
            <span className="text-sm">
              <span className="font-semibold text-ink">Bon n° {suivie.numero}</span>{' '}
              <span className="text-ink-2">
                {fini
                  ? '— ✓ imprimé'
                  : bloque
                    ? '— l’impression n’avance plus, touchez pour voir'
                    : a
                      ? `— ${a.sortis} sur ${a.total} sortis`
                      : '— en file'}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
