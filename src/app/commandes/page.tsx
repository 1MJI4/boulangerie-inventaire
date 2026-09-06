'use client';

// src/app/commandes/page.tsx
//
// L'écran d'où part tout : ce qui reste à imprimer, les virements à vérifier,
// les retraits du jour. Il s'ouvre sur « Qui prend la commande ? » parce que
// la tablette du comptoir est partagée.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alerte, Bouton, Carte, Chargement, Entete, EtatVide, LienBouton, Puce } from '@/components/ui';
import { useEquipe } from '@/lib/vendeurs';
import {
  attendUnVirement,
  formaterEuros,
  LIBELLE_STATUT,
  type Commande,
} from '@/lib/commandes';
import { dateDuJour, formatDateRelative } from '@/lib/dateProduction';

type CommandeApi = Omit<Commande, 'retraitLe' | 'avertissements'> & {
  retraitLe: string;
  avertissements: string | null;
};

function normaliser(c: CommandeApi): Commande {
  return {
    ...c,
    retraitLe: c.retraitLe.slice(0, 10),
    avertissements: c.avertissements ? JSON.parse(c.avertissements) : [],
  };
}

export default function EcranCommandes() {
  const { equipe, vendeur, prete, definirVendeur, ajouter } = useEquipe();
  const [commandes, setCommandes] = useState<Commande[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [nouveauNom, setNouveauNom] = useState('');
  const aujourdhui = dateDuJour();

  const charger = useCallback(async () => {
    try {
      // Ménage au passage : archivage à J+2, anonymisation à 30 jours.
      // Pas de tâche planifiée à surveiller — quelqu'un ouvre cet écran
      // tous les jours, cela suffit.
      void fetch('/api/commandes', { method: 'PUT' }).catch(() => {});

      const reponse = await fetch('/api/commandes?statut=en_cours');
      if (!reponse.ok) throw new Error((await reponse.json()).error ?? 'Erreur');
      const donnees: CommandeApi[] = await reponse.json();
      setCommandes(donnees.map(normaliser));
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Impossible de charger les commandes.');
      setCommandes([]);
    }
  }, []);

  useEffect(() => {
    if (vendeur) void charger();
  }, [vendeur, charger]);

  const groupes = useMemo(() => {
    const liste = commandes ?? [];
    const filtre = recherche.trim().toLowerCase();
    const visibles = filtre
      ? liste.filter(
          (c) =>
            c.client.toLowerCase().includes(filtre) ||
            c.telephone.includes(filtre) ||
            c.numero.toLowerCase().includes(filtre)
        )
      : liste;

    return {
      aImprimer: visibles.filter((c) => c.statut === 'a_imprimer'),
      virements: visibles.filter(attendUnVirement),
      duJour: visibles.filter((c) => c.retraitLe === aujourdhui && c.statut !== 'a_imprimer'),
      aVenir: visibles.filter((c) => c.retraitLe > aujourdhui && c.statut !== 'a_imprimer'),
      enRetard: visibles.filter((c) => c.retraitLe < aujourdhui && c.statut !== 'a_imprimer'),
    };
  }, [commandes, recherche, aujourdhui]);

  /* ----------------------------------------- Qui prend la commande ? */

  if (!prete) return <Chargement />;

  if (!vendeur) {
    return (
      <>
        <Entete
          titre="Qui prend la commande ?"
          sousTitre="Le prénom est retenu pour le service et s’affiche en haut de l’écran."
        />
        <Carte className="p-4">
          <div className="flex flex-wrap gap-2">
            {equipe.map((nom) => (
              <Bouton key={nom} variante="secondaire" onClick={() => definirVendeur(nom)}>
                {nom}
              </Bouton>
            ))}
          </div>
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
              Quelqu’un d’autre
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
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Chercher un nom, un téléphone, un numéro…"
          className="min-h-11 w-full rounded-lg border border-line-fort bg-surface px-3 text-sm text-ink placeholder:text-ink-3"
        />
      </div>

      {commandes === null ? (
        <Chargement />
      ) : commandes.length === 0 ? (
        <Carte>
          <EtatVide
            titre="Aucune commande en cours"
            detail="Les commandes remises ou annulées sortent de cette liste, et s’archivent d’elles-mêmes deux jours après le retrait."
            action={<LienBouton href="/commandes/nouvelle" variante="principal">Nouvelle commande</LienBouton>}
          />
        </Carte>
      ) : (
        <div className="grid gap-6">
          <Groupe titre="À imprimer" ton="accent" commandes={groupes.aImprimer} vendeur={vendeur} onChange={charger} />
          <Groupe titre="Virements à vérifier" ton="attention" commandes={groupes.virements} vendeur={vendeur} onChange={charger} />
          <Groupe titre="Retraits en retard" ton="alerte" commandes={groupes.enRetard} vendeur={vendeur} onChange={charger} />
          <Groupe titre="Retraits d’aujourd’hui" commandes={groupes.duJour} vendeur={vendeur} onChange={charger} />
          <Groupe titre="À venir" commandes={groupes.aVenir} vendeur={vendeur} onChange={charger} />
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------- Un groupe */

function Groupe({
  titre,
  commandes,
  vendeur,
  onChange,
  ton,
}: {
  titre: string;
  commandes: Commande[];
  vendeur: string;
  onChange: () => void;
  ton?: 'accent' | 'attention' | 'alerte';
}) {
  if (commandes.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-3">
        {titre}
        <Puce ton={ton ?? 'neutre'}>{commandes.length}</Puce>
      </h2>
      <ul className="grid gap-2">
        {commandes.map((commande) => (
          <li key={commande.id}>
            <LigneCommandeCarte commande={commande} vendeur={vendeur} onChange={onChange} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LigneCommandeCarte({
  commande,
  vendeur,
  onChange,
}: {
  commande: Commande;
  vendeur: string;
  onChange: () => void;
}) {
  const [occupe, setOccupe] = useState(false);

  const agir = async (action: string) => {
    setOccupe(true);
    try {
      await fetch('/api/commandes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: commande.id, action, auteur: vendeur }),
      });
      onChange();
    } finally {
      setOccupe(false);
    }
  };

  const reste = commande.totalCentimes - commande.acompteCentimes;

  return (
    <Carte className="p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="chiffres text-sm font-semibold text-accent">{commande.numero}</span>
            <span className="text-base font-medium text-ink">{commande.client}</span>
            {commande.origine === 'telephone' ? <Puce>téléphone</Puce> : null}
          </div>
          <p className="mt-1 text-sm text-ink-2">
            {formatDateRelative(commande.retraitLe)} à{' '}
            <span className="chiffres">{commande.retraitHeure}</span> · {commande.lignes.length}{' '}
            ligne{commande.lignes.length > 1 ? 's' : ''} ·{' '}
            <span className="chiffres">{formaterEuros(commande.totalCentimes)}</span>
            {reste > 0 ? (
              <>
                {' '}
                — reste <span className="chiffres">{formaterEuros(reste)}</span>
              </>
            ) : null}
          </p>
          {commande.texteGateau ? (
            <p className="mt-1 text-sm text-ink">« {commande.texteGateau} »</p>
          ) : null}
          {attendUnVirement(commande) ? (
            <p className="mt-1 text-xs text-attention">
              Virement à vérifier — communication « {commande.numero} »
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Puce ton={commande.statut === 'a_imprimer' ? 'accent' : 'neutre'}>
            {LIBELLE_STATUT[commande.statut]}
          </Puce>
          <LienBouton href={`/commandes/${commande.id}/modifier`} variante="secondaire">
            Modifier
          </LienBouton>
          <LienBouton href={`/commandes/${commande.id}/imprimer`} variante="secondaire">
            Imprimer
          </LienBouton>
          {attendUnVirement(commande) ? (
            <Bouton variante="secondaire" disabled={occupe} onClick={() => agir('acompte')}>
              Virement reçu
            </Bouton>
          ) : null}
          {commande.statut === 'imprimee' ? (
            <Bouton variante="principal" disabled={occupe} onClick={() => agir('remise')}>
              Remise
            </Bouton>
          ) : null}
        </div>
      </div>
    </Carte>
  );
}
