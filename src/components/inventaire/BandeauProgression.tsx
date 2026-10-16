'use client';

// src/components/inventaire/BandeauProgression.tsx
//
// « Comment savoir que j'ai fini l'inventaire ? » (retour du propriétaire)
//
// Bandeau toujours visible en haut du comptage :
//   - « 87 / 123 comptés » + barre fine (produits ACTIFS de la liste d'inventaire) ;
//   - « Aller au prochain non compté » ;
//   - « Terminer quand même » : liste ce qui manque (avertissement, jamais
//     blocage — règle de doute : signaler), puis confirmation ;
//   - état de fin : « Inventaire terminé ✓ » SEULEMENT si tout est compté ET
//     enregistré. Sinon on dit ce qui manque (envois en attente, saisie refusée).
// Pas de modale : tout reste dans le flux (interdit de la fiche agent).
// Les calculs sont dans `progression.ts` (purs, testés).
// Propriétaire : `inventaire-scan`.

import type { ReactNode } from 'react';
import { Bouton } from '@/components/ui';
import { IconeNiveau, NIVEAUX } from '@/components/signalement';
import { texteEnAttente, type BilanFin, type Progression } from './progression';

export type PropsBandeauProgression = {
  progression: Progression;
  bilan: BilanFin;
  /** Produits non comptés, dans l'ordre d'affichage (pour la liste « ce qui manque »). */
  manquants: readonly { id: number; nom: string }[];
  panneauOuvert: boolean;
  onOuvrirPanneau: (ouvert: boolean) => void;
  onConfirmerTerminer: () => void;
  onProchain: () => void;
  onAllerA: (produitId: number) => void;
  /** Premier produit portant un avertissement / un refus (bouton « Voir »). */
  premierAvertissement: number | null;
  premierACorriger: number | null;
  onEnvoyer: () => void;
  envoiEnCours: boolean;
  horsLigne: boolean;
  /** Bouton « Chercher » (à gauche) et indicateur de sauvegarde (à droite). */
  avant?: ReactNode;
  apres?: ReactNode;
  /** Rappel d'équipe affiché sous l'état de fin. */
  rappel?: ReactNode;
};


const pluriel = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un);

export function BandeauProgression({
  progression,
  bilan,
  manquants,
  panneauOuvert,
  onOuvrirPanneau,
  onConfirmerTerminer,
  onProchain,
  onAllerA,
  premierAvertissement,
  premierACorriger,
  onEnvoyer,
  envoiEnCours,
  horsLigne,
  avant,
  apres,
  rappel,
}: PropsBandeauProgression) {
  const { comptes, total, pourcent } = progression;
  const restants = progression.restants.length;
  const toutCompte = total > 0 && restants === 0;
  const enCours = bilan.etat === 'en_cours';

  return (
    <div className="sans-impression mb-2 shrink-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {avant}
        <p className="chiffres text-sm text-ink" aria-live="polite">
          <span className="text-base font-semibold">{comptes}</span> / {total} comptés
          {restants > 0 ? (
            <span className="text-ink-3">
              {' '}
              · {restants} {pluriel(restants, 'restant', 'restants')}
            </span>
          ) : null}
        </p>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {restants > 0 ? (
            <Bouton variante="principal" onClick={onProchain} className="shrink-0">
              Aller au prochain non compté ›
            </Bouton>
          ) : null}
          {enCours ? (
            <Bouton variante="secondaire"
              onClick={() => onOuvrirPanneau(!panneauOuvert)}
              aria-expanded={panneauOuvert} className="shrink-0">
              Terminer quand même
            </Bouton>
          ) : null}
          {apres}
        </div>
      </div>

      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={comptes}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${comptes} produits comptés sur ${total}`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${toutCompte ? 'bg-ok' : 'bg-accent'}`}
          style={{ width: `${pourcent}%` }}
        />
      </div>

      {/* « Terminer quand même » : ce qui manque, puis confirmation. Avertissement, jamais blocage. */}
      {enCours && panneauOuvert ? (
        <div role="status" className={`mt-2 rounded-xl p-3 ${NIVEAUX.avertissement.cadre}`}>
          <p className="flex items-start gap-2 text-sm font-medium text-ink">
            <IconeNiveau niveau="avertissement" className={`mt-0.5 h-5 w-5 shrink-0 ${NIVEAUX.avertissement.icone}`} />
            <span>
              Il reste {restants} {pluriel(restants, 'produit non compté', 'produits non comptés')}. Ils
              resteront « pas compté » — ce n&apos;est pas un zéro.
            </span>
          </p>
          <ul className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {manquants.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onAllerA(p.id)}
                  className="min-h-9 rounded-md border border-line bg-surface px-2 text-left text-xs text-ink hover:border-line-fort"
                >
                  {p.nom}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            <Bouton variante="principal" onClick={onProchain} className="shrink-0">
              Compter les manquants
            </Bouton>
            <Bouton variante="secondaire" onClick={onConfirmerTerminer} className="shrink-0">
              Terminer avec {restants} non {pluriel(restants, 'compté', 'comptés')}
            </Bouton>
          </div>
        </div>
      ) : null}

      {bilan.etat === 'termine' ? (
        <div
          role="status"
          className={`mt-2 rounded-xl p-3 ${
            bilan.incomplet ? NIVEAUX.avertissement.cadre : 'border-2 border-ok bg-ok-doux'
          }`}
        >
          <p className="text-lg font-semibold text-ink">
            {bilan.incomplet
              ? `Inventaire terminé — ${bilan.restants} ${pluriel(bilan.restants, 'produit non compté', 'produits non comptés')}`
              : 'Inventaire terminé ✓'}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-ink-2">
            <span className="chiffres">
              {comptes} {pluriel(comptes, 'produit compté', 'produits comptés')} · tout est enregistré
            </span>
            {bilan.avertissements > 0 ? (
              <span>
                · {bilan.avertissements} {pluriel(bilan.avertissements, 'avertissement', 'avertissements')} à revoir
              </span>
            ) : null}
            {bilan.avertissements > 0 && premierAvertissement !== null ? (
              <Bouton variante="secondaire" onClick={() => onAllerA(premierAvertissement)} className="shrink-0">
                Voir
              </Bouton>
            ) : null}
            {bilan.incomplet ? (
              <Bouton variante="secondaire" onClick={onProchain} className="shrink-0">
                Compter les manquants
              </Bouton>
            ) : null}
          </div>
        </div>
      ) : null}

      {bilan.etat === 'attente_envoi' ? (
        <div role="status" className={`mt-2 rounded-xl p-3 ${NIVEAUX.avertissement.cadre}`}>
          <p className="text-base font-semibold text-ink">
            {bilan.incomplet ? 'Comptage arrêté' : 'Tout est compté'} — {texteEnAttente(bilan.enAttente || 1)}.
            Gardez l&apos;écran ouvert.
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-ink-2">
            <span>
              {horsLigne
                ? 'Pas de réseau : l’envoi repartira tout seul dès son retour.'
                : 'L’inventaire sera terminé une fois tout enregistré.'}
            </span>
            <Bouton variante="secondaire" onClick={onEnvoyer} disabled={envoiEnCours} className="shrink-0">
              {envoiEnCours ? 'Envoi…' : 'Envoyer maintenant'}
            </Bouton>
          </div>
        </div>
      ) : null}

      {bilan.etat === 'a_corriger' ? (
        <div role="alert" className={`mt-2 rounded-xl p-3 ${NIVEAUX.bloquant.cadre}`}>
          <p className="flex items-start gap-2 text-base font-semibold text-ink">
            <IconeNiveau niveau="bloquant" className={`mt-0.5 h-5 w-5 shrink-0 ${NIVEAUX.bloquant.icone}`} />
            <span>
              {bilan.aCorriger} {pluriel(bilan.aCorriger, 'saisie refusée n’est pas enregistrée', 'saisies refusées ne sont pas enregistrées')}{' '}
              — corrigez-{pluriel(bilan.aCorriger, 'la', 'les')} pour terminer.
            </span>
          </p>
          {premierACorriger !== null ? (
            <Bouton variante="principal" onClick={() => onAllerA(premierACorriger)} className="mt-2 shrink-0">
              Aller à la ligne à corriger
            </Bouton>
          ) : null}
        </div>
      ) : null}

      {rappel}
    </div>
  );
}
