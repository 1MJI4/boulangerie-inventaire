'use client';

// Comptage de la Glory (monnayeur) : combien de pièces et de billets dans la
// machine, coupure par coupure — pièces de 5 cents à 2 euros, billets de
// 5 à 50 euros (propriétaire, 17/11/2026).
//
// Page de TEST, à part : on décidera ensuite où la ranger (en tête de
// l'inventaire, peut-être). Le comptage reste sur cette tablette (brouillon
// local), rien n'est encore enregistré au serveur.
//
// Règles et totaux : src/domaine/caisse.ts (centimes, jamais de flottant).
// Saisie : chiffres seulement ; le nombre déjà affiché est entièrement
// sélectionné quand on touche la case, le premier chiffre tapé le remplace
// (jamais « 1 » + « 12 » = 112). Entrée passe à la coupure suivante.

import { useRef } from 'react';
import { Bouton, Carte, Entete } from '@/components/ui';
import { useMemoireLocale } from '@/lib/memoireLocale';
import { formaterEuros } from '@/domaine/argent';
import {
  COUPURES_CENTIMES,
  libelleCoupure,
  natureCoupure,
  totauxCaisse,
  type ComptageCaisse,
  type NatureCoupure,
} from '@/domaine/caisse';

const CLE_BROUILLON = 'glory:comptage';

/** Brouillon local : nombre tapé par coupure (texte, pour garder la case vide distincte de 0). */
type Brouillon = Record<string, string>;

function versComptage(b: Brouillon): ComptageCaisse {
  const c: Record<number, number | null> = {};
  for (const coupure of COUPURES_CENTIMES) {
    const t = (b[String(coupure)] ?? '').trim();
    c[coupure] = /^\d{1,6}$/.test(t) ? Number(t) : null;
  }
  return c;
}

export default function ComptageGlory() {
  const [brouillon, setBrouillon] = useMemoireLocale<Brouillon>(CLE_BROUILLON, {});
  const champs = useRef<(HTMLInputElement | null)[]>([]);
  const t = totauxCaisse(versComptage(brouillon));

  const changer = (coupure: number, texte: string) => {
    const chiffres = texte.replace(/\D/g, '').slice(0, 6);
    setBrouillon({ ...brouillon, [String(coupure)]: chiffres });
  };

  const toutEffacer = () => {
    if (window.confirm('Effacer tout le comptage de la Glory ?')) setBrouillon({});
  };

  const bloc = (nature: NatureCoupure, titre: string, total: number) => (
    <Carte className="p-3 sm:p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-ink">{titre}</h2>
        <span className="chiffres text-sm text-ink-2">{formaterEuros(total)}</span>
      </div>
      <ul className="divide-y divide-line">
        {t.parCoupure.map((l, i) =>
          natureCoupure(l.coupure) !== nature ? null : (
            <li key={l.coupure} className="flex items-center gap-3 py-2">
              <label htmlFor={`coupure-${l.coupure}`} className="w-24 shrink-0 text-lg font-medium text-ink">
                {libelleCoupure(l.coupure)}
              </label>
              <input
                id={`coupure-${l.coupure}`}
                ref={(el) => {
                  champs.current[i] = el;
                }}
                inputMode="numeric"
                autoComplete="off"
                placeholder="—"
                aria-label={`Nombre de ${nature === 'piece' ? 'pièces' : 'billets'} de ${libelleCoupure(l.coupure)}`}
                value={brouillon[String(l.coupure)] ?? ''}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => changer(l.coupure, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const suivant = champs.current[i + 1];
                    if (suivant) suivant.focus();
                    else e.currentTarget.blur();
                  }
                }}
                className="chiffres h-12 w-24 rounded-xl border border-transparent bg-segment-fond px-3 text-right text-xl font-semibold text-ink focus:border-accent focus:outline-none"
              />
              <span className="text-sm text-ink-3">{nature === 'piece' ? 'pièces' : 'billets'}</span>
              <span className="chiffres ml-auto text-right text-sm text-ink-2">
                {l.montant === null ? '' : formaterEuros(l.montant)}
              </span>
            </li>
          ),
        )}
      </ul>
    </Carte>
  );

  return (
    <>
      <Entete
        titre="Glory — pièces et billets"
        sousTitre="Comptez ce qu’il y a dans la machine, coupure par coupure. Le comptage reste sur cette tablette."
        actions={
          <Bouton variante="discret" onClick={toutEffacer}>
            Tout effacer
          </Bouton>
        }
      />

      {/* En tête : ce qu'il y a dans la Glory. */}
      <Carte className="mb-4 p-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-ink-3">Pièces</div>
            <div className="chiffres text-lg font-semibold text-ink">{formaterEuros(t.totalPieces)}</div>
          </div>
          <div>
            <div className="text-xs text-ink-3">Billets</div>
            <div className="chiffres text-lg font-semibold text-ink">{formaterEuros(t.totalBillets)}</div>
          </div>
          <div>
            <div className="text-xs text-ink-3">Total</div>
            <div className="chiffres text-2xl font-bold text-accent">{formaterEuros(t.total)}</div>
          </div>
        </div>
        <p className="mt-3 text-center text-sm text-ink-2">
          {t.nonComptees.length === 0
            ? 'Toutes les coupures sont comptées.'
            : `Encore à compter : ${t.nonComptees.map(libelleCoupure).join(', ')}.`}
        </p>
      </Carte>

      <div className="grid gap-4 md:grid-cols-2">
        {bloc('piece', 'Pièces', t.totalPieces)}
        {bloc('billet', 'Billets', t.totalBillets)}
      </div>
    </>
  );
}
