'use client';

// src/components/commande/photosClient.ts
//
// Photos modèles côté TABLETTE (écran de commande) : lecture de la galerie
// (GET /api/photos-modeles) et adresse de l'image d'une photo citée par une
// ligne. Propriétaire : `commandes-traiteur`.
//
// Réseau faible : la liste (quelques Ko de texte, aucune image) est lue à la
// PREMIÈRE ouverture de la galerie puis gardée pour la page ; chaque ouverture
// suivante l'affiche tout de suite et la relit en arrière-plan (une photo
// ajoutée par le gérant apparaît sans recharger). Les images ne se chargent
// qu'à l'écran (`loading="lazy"`), depuis `url`.

import { useEffect, useState } from 'react';
import type { PhotoModele } from '@/catalogue/photosModeles';
import type { Resultat } from '@/domaine/resultat';
import { echecReseau, lireReponse } from './modele';

export type Galerie = { photos: PhotoModele[]; rayons: string[] };

let galerie: Galerie | null = null;
/** Adresse de l'image par identifiant : galerie lue, plus photos lues une à une (masquées comprises). */
const urls = new Map<string, string>();
const enCours = new Map<string, Promise<string | null>>();

function retenir(photos: readonly PhotoModele[]) {
  for (const p of photos) urls.set(p.id, p.url);
}

/** Galerie déjà lue sur cette page (null : jamais lue). */
export function galerieEnCache(): Galerie | null {
  return galerie;
}

/** Lit la galerie (photos visibles + rayons). */
export async function lireGalerie(): Promise<Resultat<Galerie>> {
  try {
    const r = await lireReponse<Galerie>(await fetch('/api/photos-modeles'));
    if (r.ok) {
      galerie = { photos: Array.isArray(r.donnees.photos) ? r.donnees.photos : [], rayons: Array.isArray(r.donnees.rayons) ? r.donnees.rayons : [] };
      retenir(galerie.photos);
      return { ...r, donnees: galerie };
    }
    return r;
  } catch {
    return echecReseau();
  }
}

/** Adresse de l'image d'une photo (même masquée) ; null si elle n'a pas pu être lue. */
function urlDePhoto(id: string): Promise<string | null> {
  const connue = urls.get(id);
  if (connue) return Promise.resolve(connue);
  const deja = enCours.get(id);
  if (deja) return deja;
  const p = fetch(`/api/photos-modeles?id=${encodeURIComponent(id)}`)
    .then((r) => lireReponse<{ photo: PhotoModele }>(r))
    .then((r) => {
      if (!r.ok || !r.donnees.photo) return null;
      retenir([r.donnees.photo]);
      return r.donnees.photo.url;
    })
    .catch(() => null)
    .finally(() => enCours.delete(id));
  enCours.set(id, p);
  return p;
}

/**
 * Adresse de l'image de la photo d'une ligne (« G043 ») : immédiate si la
 * galerie a déjà été lue, sinon demandée une fois au serveur. null tant
 * qu'elle n'est pas connue (l'écran affiche alors l'identifiant seul).
 * À monter avec `key={id}` : un autre identifiant = un autre composant.
 */
export function useUrlPhoto(id: string): string | null {
  const [url, setUrl] = useState<string | null>(() => urls.get(id) ?? null);
  useEffect(() => {
    if (url) return;
    let annule = false;
    urlDePhoto(id).then((u) => {
      if (!annule && u) setUrl(u);
    });
    return () => {
      annule = true;
    };
  }, [id, url]);
  return url;
}
