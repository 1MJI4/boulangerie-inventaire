'use client';

// src/components/rappels/RappelApresAction.tsx
//
// Petite carte de rappel après une commande validée ou un inventaire terminé.
// NON BLOQUANTE : pas de modal, pas de voile, pas de focus volé. Elle se
// place dans le flux de la page (jamais en position fixe) : le parent la met
// sous la confirmation, à un endroit qui ne recouvre pas les boutons
// d'action principaux. Elle se ferme d'un geste (toucher la carte ou ×) ou
// seule après ~6 s ; le minuteur est suspendu tant que le focus clavier est
// dedans (lecture au lecteur d'écran).

import { useEffect, useState } from 'react';
import { CarteRappel } from './CarteRappel';
import { lireVus, memoriserVu } from './memoire';
import { choisirRappel, type Rappel } from './rappels';
import { RAPPELS } from './source';

export type PropsRappelApresAction = {
  moment: 'apres_commande' | 'apres_inventaire';
  /**
   * Identifiant de l'action qui vient d'aboutir (id de la commande validée,
   * de l'inventaire terminé). Chaque NOUVELLE valeur non nulle tire un rappel ;
   * null = rien à afficher.
   */
  declencheur: string | number | null;
  /** Fermeture automatique, en ms (défaut 6000). */
  duree?: number;
  /** Appelé à la fermeture (geste ou minuteur). Facultatif. */
  onFerme?: () => void;
  /** Liste de rappels (défaut : `data/rappels-equipe.json`, embarqué au build). */
  rappels?: readonly Rappel[];
  className?: string;
};

type Affiche = { pour: string | number; rappel: Rappel } | null;

export function RappelApresAction({
  moment,
  declencheur,
  duree = 6000,
  onFerme,
  rappels = RAPPELS,
  className = '',
}: PropsRappelApresAction) {
  const [affiche, setAffiche] = useState<Affiche>(null);
  const [enPause, setEnPause] = useState(false);

  // Nouveau déclencheur → nouveau rappel (tiré hors rendu : aléatoire + stockage local).
  useEffect(() => {
    if (declencheur === null) return;
    const t = setTimeout(() => {
      const choisi = choisirRappel(rappels, moment, lireVus());
      if (!choisi) return;
      memoriserVu(choisi.id);
      setAffiche({ pour: declencheur, rappel: choisi });
    }, 0);
    return () => clearTimeout(t);
  }, [declencheur, moment, rappels]);

  const visible = affiche !== null && affiche.pour === declencheur;

  function fermer() {
    setAffiche(null);
    onFerme?.();
  }

  // Fermeture automatique.
  useEffect(() => {
    if (!visible || enPause) return;
    const t = setTimeout(() => {
      setAffiche(null);
      onFerme?.();
    }, duree);
    return () => clearTimeout(t);
  }, [visible, enPause, duree, onFerme]);

  return (
    <div role="status" aria-live="polite" className={className}>
      {visible && affiche ? (
        <div
          onClick={fermer}
          onFocus={() => setEnPause(true)}
          onBlur={() => setEnPause(false)}
          className="cursor-pointer"
        >
          <CarteRappel
            rappel={affiche.rappel}
            action={
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fermer();
                }}
                aria-label="Fermer le rappel"
                className="-mr-2 -mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl text-ink-2 active:bg-surface-2"
              >
                <span aria-hidden>×</span>
              </button>
            }
          />
        </div>
      ) : null}
    </div>
  );
}
