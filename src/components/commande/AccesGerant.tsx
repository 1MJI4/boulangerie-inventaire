'use client';

// src/components/commande/AccesGerant.tsx
//
// Saisie du code gérant pour un déverrouillage (prix sous le plancher, ligne
// libre, retrait le lendemain, remise sur le total). Le code est vérifié par
// POST /api/gestion (agent `securite`), qui ouvre l'accès gérant de CETTE
// tablette pour une courte durée ; la route des commandes revérifie cet accès
// avant d'accepter le moindre déverrouillage (jamais la tablette seule).
//
// Le nom saisi est une identité DÉCLARÉE (pas de compte individuel, décision
// du 15/10/2026), tracée avec l'heure du serveur.

import { useState } from 'react';
import { Signalement } from '@/components/signalement';
import type { Echec } from '@/domaine/resultat';
import { echecReseau, lireReponse } from './modele';
import { sortieDe } from './sorties';

const CHAMP =
  'min-h-12 w-full rounded-xl border-2 border-line-fort bg-surface px-3 text-lg text-ink placeholder:text-ink-3';

export function AccesGerant({
  raison,
  onAccorde,
  onAnnuler,
}: {
  /** Ce qui est déverrouillé, dit à l'employé (« Prix sous le plancher : Layer Cake »). */
  raison: string;
  /** Accès ouvert : nom déclaré de la personne qui autorise. */
  onAccorde: (par: string) => void;
  onAnnuler: () => void;
}) {
  const [nom, setNom] = useState('');
  const [code, setCode] = useState('');
  const [refus, setRefus] = useState<Echec | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const valider = async () => {
    setEnvoi(true);
    setRefus(null);
    try {
      const r = await lireReponse<{ valide: boolean }>(
        await fetch('/api/gestion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        }),
      );
      if (!r.ok) {
        setRefus(r);
        setCode('');
        return;
      }
      onAccorde(nom.trim() || 'Gérant');
    } catch {
      const e = echecReseau();
      if (!e.ok) setRefus(e);
    } finally {
      setEnvoi(false);
    }
  };

  const sortie = refus ? sortieDe(refus) : null;

  return (
    <div className="rounded-xl border-2 border-accent bg-accent-doux/40 p-4" role="group" aria-label="Accord du gérant">
      <p className="text-base font-semibold text-ink">Accord du gérant</p>
      <p className="mb-3 text-sm text-ink-2">{raison}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-ink-2">Qui autorise ?</span>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Gérant"
            autoComplete="off"
            className={CHAMP}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-ink-2">Code gérant</span>
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void valider()}
            autoComplete="off"
            className={CHAMP}
          />
        </label>
      </div>
      {refus ? (
        <Signalement
          className="mt-3"
          signalement={refus}
          autreSortie={
            sortie?.libelle || sortie?.autre ? (
              <span className="inline-flex min-h-12 items-center rounded-xl border border-line-fort px-4 text-base text-ink">
                {sortie.libelle ?? sortie.autre}
              </span>
            ) : (
              <span className="inline-flex min-h-12 items-center text-base text-ink-2">Ressaisissez le code.</span>
            )
          }
        />
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={envoi || code === ''}
          onClick={() => void valider()}
          className="min-h-12 rounded-xl bg-accent px-5 text-base font-semibold text-white disabled:opacity-60"
        >
          {envoi ? 'Vérification…' : 'Autoriser'}
        </button>
        <button
          type="button"
          onClick={onAnnuler}
          className="min-h-12 rounded-xl border border-line-fort px-5 text-base text-ink-2"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
