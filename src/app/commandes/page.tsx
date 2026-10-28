'use client';

// src/app/commandes/page.tsx
//
// L'écran d'où part tout : ce qui reste à imprimer, les virements à vérifier,
// les retraits du jour. Il s'ouvre sur « Qui prend la commande ? » parce que
// la tablette du comptoir est partagée.

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alerte, Bouton, Carte, Chargement, Entete, EtatVide, LienBouton } from '@/components/ui';
import { useEquipe } from '@/lib/vendeurs';
import { depuisApi, typesDeCommande, type Commande, type CommandeApi } from '@/lib/commandes';
import { dateDuJour } from '@/lib/dateProduction';
import { RappelChargement } from '@/components/rappels';
import { echecReseau, lireReponse } from '@/components/commande/modele';
import { FicheCommande } from '@/components/FicheCommande';
import { CelluleCommande, ListeGroupee } from '@/components/fiche/ElementsCommande';
import { chercherCommandes, GROUPES, grouperCommandes, type CleGroupe } from '@/components/fiche/presentationCommande';

/** `useSearchParams` impose une frontière Suspense : l'écran attend l'adresse lue. */
export default function PageCommandes() {
  return (
    <Suspense fallback={<Chargement libelle="Chargement des commandes…" />}>
      <EcranCommandes />
    </Suspense>
  );
}

function EcranCommandes() {
  const { equipe, vendeur, prete, definirVendeur, ajouter, retirer } = useEquipe();
  const [gererNoms, setGererNoms] = useState(false);
  const parametres = useSearchParams();
  const [commandes, setCommandes] = useState<Commande[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // « /commandes?q=2026-0016 » (depuis l'accueil vendeur) : liste déjà filtrée sur la commande.
  const [recherche, setRecherche] = useState(parametres.get('q') ?? '');
  const [nouveauNom, setNouveauNom] = useState('');
  // Filtre sous la recherche (propriétaire, 28/10/2026) : un groupe à la fois, ou tout.
  const [filtre, setFiltre] = useState<CleGroupe | null>(null);
  // Toucher une commande ouvre sa fiche sur place (propriétaire, 28/10/2026).
  const [ouverteId, setOuverteId] = useState<number | null>(null);
  const aujourdhui = dateDuJour();

  const charger = useCallback(async () => {
    try {
      // Ménage au passage : archivage à J+2, anonymisation à 30 jours.
      // Pas de tâche planifiée à surveiller — quelqu'un ouvre cet écran
      // tous les jours, cela suffit.
      void fetch('/api/commandes', { method: 'PUT' }).catch(() => {});

      const r = await lireReponse<CommandeApi[]>(await fetch('/api/commandes?statut=en_cours'));
      if (!r.ok) {
        setErreur(r.message);
        setCommandes([]);
        return;
      }
      setCommandes(r.donnees.map(depuisApi));
      setErreur(null);
    } catch {
      const e = echecReseau();
      setErreur(e.ok ? null : e.message);
      setCommandes([]);
    }
  }, []);

  useEffect(() => {
    if (!vendeur) return;
    let annule = false;
    (async () => {
      await Promise.resolve();
      if (!annule) await charger();
    })();
    return () => {
      annule = true;
    };
  }, [vendeur, charger]);

  const groupes = useMemo(
    () => grouperCommandes(chercherCommandes(commandes ?? [], recherche), aujourdhui),
    [commandes, recherche, aujourdhui],
  );
  const ouverte = (commandes ?? []).find((c) => c.id === ouverteId) ?? null;

  /* ----------------------------------------- Qui prend la commande ? */

  if (!prete)
    return (
      <>
        <Chargement />
        <RappelChargement />
      </>
    );

  if (!vendeur) {
    return (
      <>
        <Entete
          titre="Qui prend la commande ?"
          sousTitre="Le prénom est retenu pour le service et s’affiche en haut de l’écran."
        />
        <Carte className="p-4">
          <div className="flex flex-wrap gap-2">
            {equipe.map((nom) =>
              gererNoms ? (
                // Mode « retirer » : un toucher retire le prénom de cette tablette.
                <Bouton key={nom} variante="danger" onClick={() => retirer(nom)} aria-label={`Retirer ${nom}`}>
                  {nom} ×
                </Bouton>
              ) : (
                <Bouton key={nom} variante="secondaire" className="min-h-14 px-6 text-base" onClick={() => definirVendeur(nom)}>
                  {nom}
                </Bouton>
              ),
            )}
            {equipe.length === 0 ? <p className="text-sm text-ink-2">Aucun prénom : ajoutez le vôtre ci-dessous.</p> : null}
          </div>
          {equipe.length > 0 ? (
            <button
              type="button"
              onClick={() => setGererNoms((v) => !v)}
              className="mt-3 min-h-11 text-sm text-ink-2 underline underline-offset-2"
            >
              {gererNoms ? 'Terminé' : 'Retirer un prénom'}
            </button>
          ) : null}
          <form
            className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              const nom = nouveauNom.trim();
              if (!nom) return;
              ajouter(nom);
              definirVendeur(nom);
              setNouveauNom('');
            }}
          >
            <label htmlFor="nouveau-vendeur" className="text-xs text-ink-3">
              Ajouter un prénom
            </label>
            <input
              id="nouveau-vendeur"
              value={nouveauNom}
              onChange={(e) => setNouveauNom(e.target.value)}
              placeholder="Prénom"
              className="min-h-11 rounded-lg border border-line-fort bg-surface px-3 text-sm text-ink"
            />
            <Bouton type="submit" variante="principal">
              Continuer
            </Bouton>
          </form>
          <p className="mt-4 text-xs text-ink-3">
            Cette liste reste sur cette tablette. L’application ne conserve aucun répertoire du
            personnel.
          </p>
        </Carte>
      </>
    );
  }

  /* ------------------------------------------------------- La liste */

  return (
    <>
      <Entete
        titre="Commandes"
        sousTitre={
          <>
            Prise par <span className="font-medium text-ink">{vendeur}</span>.{' '}
            <button
              type="button"
              onClick={() => definirVendeur(null)}
              className="underline underline-offset-2 hover:text-ink"
            >
              Ce n’est pas moi
            </button>
          </>
        }
        actions={
          <>
            <LienBouton href="/commandes/reglages">Réglages</LienBouton>
            <LienBouton href="/commandes/nouvelle" variante="principal">
              Nouvelle commande
            </LienBouton>
          </>
        }
      />

      {erreur ? <Alerte>{erreur}</Alerte> : null}

      <div className="mb-5">
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          aria-label="Chercher une commande"
          placeholder="Nom, téléphone ou numéro"
          className="min-h-11 w-full rounded-xl bg-segment-fond px-4 text-base text-ink placeholder:text-ink-2"
        />
        {commandes && commandes.length > 0 ? (
          // Sur deux lignes si besoin : tous les filtres visibles, sans barre de défilement.
          <div role="group" aria-label="Filtrer les commandes" className="mt-2 flex flex-wrap gap-1.5">
            <Filtre actif={filtre === null} onClick={() => setFiltre(null)} libelle="Toutes" />
            {GROUPES.map((g) => (
              <Filtre
                key={g.cle}
                actif={filtre === g.cle}
                onClick={() => setFiltre(filtre === g.cle ? null : g.cle)}
                libelle={g.titre}
                nombre={groupes[g.cle].length}
                ton={g.ton}
              />
            ))}
          </div>
        ) : null}
      </div>

      {commandes === null ? (
        <>
          <Chargement />
          <RappelChargement />
        </>
      ) : commandes.length === 0 ? (
        <Carte>
          <EtatVide
            titre="Aucune commande en cours"
            detail="Les commandes retirées par le client ou annulées sortent de cette liste. Elles s’archivent d’elles-mêmes deux jours après le retrait."
            action={<LienBouton href="/commandes/nouvelle" variante="principal">Nouvelle commande</LienBouton>}
          />
        </Carte>
      ) : (
        <div className="grid gap-6">
          {GROUPES.filter((g) => filtre === null || filtre === g.cle).map((g) => (
            <Groupe
              key={g.cle}
              titre={g.titre}
              commandes={groupes[g.cle]}
              aujourdhui={aujourdhui}
              avecDate={g.cle !== 'duJour'}
              onOuvrir={(c) => setOuverteId(c.id)}
            />
          ))}
          {filtre !== null && groupes[filtre].length === 0 ? (
            <div className="rounded-2xl bg-surface px-4 py-6 text-center">
              <p className="text-base text-ink-2">Aucune commande ici.</p>
              <button type="button" onClick={() => setFiltre(null)} className="mt-2 min-h-11 px-3 text-base font-medium text-accent">
                Voir toutes les commandes
              </button>
            </div>
          ) : null}
        </div>
      )}

      <FicheCommande commande={ouverte} onFermer={() => setOuverteId(null)} onChange={charger} />
    </>
  );
}

/* ------------------------------------------------------------- Les groupes */

const BULLE: Record<'accent' | 'attention' | 'alerte' | 'neutre', string> = {
  accent: 'bg-accent text-accent-texte',
  attention: 'bg-avertissement text-surface',
  alerte: 'bg-bloquant text-surface',
  neutre: 'bg-segment-fond text-ink-2',
};

/** Un filtre en pastille ; la bulle porte le nombre (colorée seulement s'il y a quelque chose). */
function Filtre({
  libelle,
  nombre,
  ton,
  actif,
  onClick,
}: {
  libelle: string;
  nombre?: number;
  ton?: 'accent' | 'attention' | 'alerte';
  actif: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium ${
        actif ? 'border-ink bg-ink text-surface' : 'border-transparent bg-surface text-ink'
      }`}
    >
      {libelle}
      {nombre !== undefined ? (
        <span
          className={`chiffres min-w-5 rounded-full px-1.5 text-center text-xs leading-5 ${
            nombre > 0 ? BULLE[ton ?? 'neutre'] : 'bg-segment-fond text-ink-2'
          }`}
        >
          {nombre}
        </span>
      ) : null}
    </button>
  );
}

/* ------------------------------------------------------------- Un groupe */

/**
 * Un groupe en liste façon iOS : titre discret, cellules blanches arrondies.
 * Chaque cellule dit l'heure et le client d'abord, puis le détail court, puis
 * le statut ; un toucher ouvre la fiche (Modifier, Imprimer le bon, Marquer
 * retirée y sont réunis, au lieu de trois boutons sur chaque carte).
 */
function Groupe({
  titre,
  commandes,
  aujourdhui,
  avecDate,
  onOuvrir,
}: {
  titre: string;
  commandes: Commande[];
  aujourdhui: string;
  avecDate: boolean;
  onOuvrir: (c: Commande) => void;
}) {
  if (commandes.length === 0) return null;

  return (
    <section>
      <h2 className="mb-1.5 px-4 text-sm font-semibold text-ink-2">
        {titre} · <span className="chiffres">{commandes.length}</span>
      </h2>
      <ListeGroupee>
        {commandes.map((commande) => (
          <CelluleCommande
            key={commande.id}
            commande={commande}
            types={typesDeCommande(commande)}
            aujourdhui={aujourdhui}
            avecDate={avecDate}
            avecStatut
            onOuvrir={onOuvrir}
          />
        ))}
      </ListeGroupee>
    </section>
  );
}
