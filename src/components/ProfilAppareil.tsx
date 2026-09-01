'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useMemoireLocale } from '@/lib/memoireLocale';
import { DEFINITIONS, PROFILS, estProfil, type Profil } from '@/lib/profils';

type ContexteProfil = {
  profil: Profil | null;
  prete: boolean;
  definir: (profil: Profil) => void;
  ouvrirSelecteur: () => void;
};

const Contexte = createContext<ContexteProfil>({
  profil: null,
  prete: false,
  definir: () => {},
  ouvrirSelecteur: () => {},
});

export const useProfil = () => useContext(Contexte);

export function FournisseurProfil({ children }: { children: React.ReactNode }) {
  const [brut, enregistrer, prete] = useMemoireLocale<string | null>(
    'boulangerie:profil-appareil',
    null
  );
  const [selecteurOuvert, setSelecteurOuvert] = useState(false);

  const profil = estProfil(brut) ? brut : null;

  const definir = useCallback(
    (suivant: Profil) => {
      enregistrer(suivant);
      setSelecteurOuvert(false);
    },
    [enregistrer]
  );

  const valeur = useMemo(
    () => ({ profil, prete, definir, ouvrirSelecteur: () => setSelecteurOuvert(true) }),
    [profil, prete, definir]
  );

  return (
    <Contexte.Provider value={valeur}>
      {children}
      {/* Premier démarrage : on demande à qui sert cette tablette. */}
      {prete && (profil === null || selecteurOuvert) ? (
        <SelecteurProfil
          profilActuel={profil}
          onChoisir={definir}
          onFermer={profil ? () => setSelecteurOuvert(false) : undefined}
        />
      ) : null}
    </Contexte.Provider>
  );
}

function SelecteurProfil({
  profilActuel,
  onChoisir,
  onFermer,
}: {
  profilActuel: Profil | null;
  onChoisir: (profil: Profil) => void;
  onFermer?: () => void;
}) {
  const [codeDemande, setCodeDemande] = useState<Profil | null>(null);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [verification, setVerification] = useState(false);

  const choisir = (profil: Profil) => {
    setErreur(null);
    // Seule l'élévation est protégée : passer de vendeur à pâtissier est libre,
    // c'est un changement de poste, pas une prise de pouvoir.
    if (DEFINITIONS[profil].protege && profilActuel !== profil) {
      setCodeDemande(profil);
      setCode('');
      return;
    }
    onChoisir(profil);
  };

  const verifier = async () => {
    if (!codeDemande || !code.trim()) return;
    setVerification(true);
    setErreur(null);
    try {
      const reponse = await fetch('/api/gestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const donnees = await reponse.json();
      if (donnees.valide) onChoisir(codeDemande);
      else setErreur(donnees.erreur ?? 'Code incorrect.');
    } catch {
      setErreur('Vérification impossible. Réessayez.');
    } finally {
      setVerification(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ground/95 p-4 backdrop-blur">
      <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-6 shadow-lg">
        {codeDemande ? (
          <>
            <h2 className="text-lg font-semibold text-ink">Profil manager</h2>
            <p className="mt-1.5 text-sm text-ink-2 text-pretty">
              Ce profil donne accès aux prévisions, au catalogue produits et aux statistiques.
            </p>

            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void verifier()}
              placeholder="Code de gestion"
              aria-label="Code de gestion"
              autoFocus
              className="mt-5 h-12 w-full rounded-lg border border-line bg-surface-2 px-3 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
            />

            {erreur ? <p className="mt-2 text-sm text-alerte">{erreur}</p> : null}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => void verifier()}
                disabled={verification || !code.trim()}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-fort disabled:opacity-60"
              >
                {verification ? 'Vérification…' : 'Valider'}
              </button>
              <button
                type="button"
                onClick={() => setCodeDemande(null)}
                className="inline-flex min-h-11 items-center rounded-lg border border-line-fort px-4 text-sm text-ink hover:bg-surface-2"
              >
                Retour
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-ink">
              {profilActuel ? 'Changer de profil' : 'Qui utilise cette tablette ?'}
            </h2>
            <p className="mt-1.5 text-sm text-ink-2 text-pretty">
              {profilActuel
                ? 'Le profil ne concerne que cet appareil.'
                : 'Cet appareil n’affichera que les écrans du poste choisi. Le réglage est retenu, il n’y a rien à ressaisir ensuite.'}
            </p>

            <ul className="mt-5 space-y-2">
              {PROFILS.map((p) => {
                const definition = DEFINITIONS[p];
                const actuel = p === profilActuel;
                return (
                  <li key={p}>
                    <button
                      type="button"
                      onClick={() => choisir(p)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                        actuel
                          ? 'border-accent bg-accent-doux'
                          : 'border-line hover:border-line-fort hover:bg-surface-2'
                      }`}
                    >
                      <span className="min-w-0">
                        <span
                          className={`block text-sm font-medium ${actuel ? 'text-accent' : 'text-ink'}`}
                        >
                          {definition.libelle}
                          {actuel ? ' — profil actuel' : ''}
                        </span>
                        <span className="block text-xs text-ink-2 text-pretty">
                          {definition.description}
                        </span>
                      </span>
                      {definition.protege && !actuel ? (
                        <span className="shrink-0 text-xs text-ink-3">code requis</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>

            {onFermer ? (
              <button
                type="button"
                onClick={onFermer}
                className="mt-4 text-sm text-ink-3 underline underline-offset-2 hover:text-ink-2"
              >
                Annuler
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
