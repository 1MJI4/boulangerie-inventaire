// src/components/rappels/source.ts
//
// Textes des rappels, importés STATIQUEMENT : embarqués au build, aucun fetch,
// aucun temps d'attente. Fichier tenu par documentation-gerant.
// Validé au chargement du module : un rappel mal formé est écarté (et signalé
// en développement), jamais fatal.

import donnees from '../../../data/rappels-equipe.json';
import { validerRappels, type Rappel } from './rappels';

const { rappels, defauts } = validerRappels(donnees);

if (defauts.length > 0 && process.env.NODE_ENV !== 'production') {
  console.warn('[rappels] data/rappels-equipe.json : entrées écartées', defauts);
}

export const RAPPELS: readonly Rappel[] = rappels;
