'use client';

// src/components/commande/GaleriePhotos.tsx
//
// Galerie plein écran des photos de modèles (décision du propriétaire,
// 26/10/2026 ; propriétaire : `commandes-traiteur`). Le client montre une
// photo, la vendeuse la touche : `onChoisir` ajoute le produit au bon.
//
// Photos et rayons : gérés par le gérant (table « PhotoModele »,
// écran /commandes/reglages/photos), lus par GET /api/photos-modeles à la
// première ouverture (./photosClient.ts) ; les photos masquées n'y sont pas.
//
// Tablette, mains occupées, réseau faible :
// - montée SEULEMENT quand la galerie est ouverte : aucune image chargée avant ;
// - un rayon à la fois (le premier par défaut), images en `loading="lazy"` :
//   seules les vignettes à l'écran se téléchargent ;
// - rayons en gros boutons en haut (152 photos : il faut un filtre — c'est la
//   seule exception aux « pas d'onglets catégorie », limitée à la galerie) ;
// - fermeture d'un geste : « Fermer » (grand bouton), ou la touche Échap.
// Aucun prix ici : une photo ne porte jamais de prix (src/catalogue/photosModeles.ts).

import { useCallback, useEffect, useState } from 'react';
import type { PhotoModele } from '@/catalogue/photosModeles';
import type { Echec } from '@/domaine/resultat';
import { Chargement } from '@/components/ui';
import { ListeSignalements } from '@/components/signalement';
import { galerieEnCache, lireGalerie, type Galerie } from './photosClient';

export function GaleriePhotos({ onChoisir, onFermer }: { onChoisir: (p: PhotoModele) => void; onFermer: () => void }) {
  const [donnees, setDonnees] = useState<Galerie | null>(() => galerieEnCache());
  const [refus, setRefus] = useState<Echec | null>(null);
  const [choix, setChoix] = useState<string | null>(null);
  const rayons = donnees?.rayons ?? [];
  // Rayon choisi, ou le premier (aussi quand le rayon choisi n'a plus de photo visible).
  const rayon = choix !== null && rayons.includes(choix) ? choix : (rayons[0] ?? '');
  const photos = (donnees?.photos ?? []).filter((p) => p.categorie === rayon && !p.masquee);

  const charger = useCallback(() => {
    lireGalerie().then((r) => {
      if (r.ok) {
        setDonnees(r.donnees);
        setRefus(null);
      } else if (!galerieEnCache()) {
        // Déjà affichée depuis le cache : une relecture manquée ne gêne pas la vendeuse.
        setRefus(r);
      }
    });
  }, []);

  // Lecture à l'ouverture (et relecture en arrière-plan si déjà en cache).
  useEffect(() => {
    charger();
  }, [charger]);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    window.addEventListener('keydown', touche);
    // La page derrière ne défile pas pendant que la galerie est ouverte.
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', touche);
      document.body.style.overflow = avant;
    };
  }, [onFermer]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="galerie-photos-titre"
      className="fixed inset-0 z-50 flex flex-col bg-surface"
    >
      <div className="flex flex-none items-center gap-3 border-b border-line px-3 pb-2 pt-3">
        <h2 id="galerie-photos-titre" className="min-w-0 flex-1 text-xl font-bold text-ink">
          Photos des modèles
          <span className="ml-2 text-base font-normal text-ink-2">Touchez la photo que montre le client</span>
        </h2>
        <button
          type="button"
          onClick={onFermer}
          className="min-h-14 shrink-0 rounded-xl border-2 border-line-fort bg-surface px-6 text-lg font-semibold text-ink"
        >
          ✕ Fermer
        </button>
      </div>

      <div role="group" aria-label="Rayons" className="flex flex-none flex-wrap gap-2 border-b border-line px-3 py-2">
        {rayons.map((r) => {
          const actif = r === rayon;
          return (
            <button
              key={r}
              type="button"
              aria-pressed={actif}
              onClick={() => setChoix(r)}
              className={`min-h-12 rounded-xl border-2 px-4 text-base font-semibold ${
                actif ? 'border-accent bg-accent text-white shadow' : 'border-line-fort bg-surface text-ink'
              }`}
            >
              {r}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        {refus ? (
          <ListeSignalements
            signalements={[refus]}
            autreSortiePour={() => (
              <button
                type="button"
                onClick={() => {
                  setRefus(null);
                  charger();
                }}
                className="min-h-12 rounded-xl border-2 border-line-fort bg-surface px-4 text-base font-semibold text-ink"
              >
                Réessayer
              </button>
            )}
          />
        ) : donnees === null ? (
          <Chargement libelle="Chargement des photos…" />
        ) : photos.length === 0 ? (
          <p className="py-10 text-center text-lg text-ink-2">Aucune photo pour l’instant : le gérant les ajoute dans Réglages des commandes.</p>
        ) : null}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onChoisir(p)}
                aria-label={`Photo ${p.id}${p.note ? ` — ${p.note}` : ''}`}
                className="block w-full overflow-hidden rounded-xl border-2 border-line bg-surface-2 text-left active:scale-[0.98] active:border-accent"
              >
                {/* Images déjà allégées (640 px) : servies telles quelles, sans passage par l'optimiseur. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full object-cover"
                />
                <span className="flex items-baseline gap-2 px-2 py-1.5">
                  <span className="chiffres shrink-0 text-xs text-ink-2">{p.id}</span>
                  {p.note ? <span className="min-w-0 break-words text-sm leading-tight text-ink">{p.note}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
