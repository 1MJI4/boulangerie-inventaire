'use client';

// src/app/commandes/reglages/photos/page.tsx
//
// Photos des modèles, gérées par le GÉRANT (décision du propriétaire,
// 26/10/2026) : ajouter une photo (appareil photo ou galerie de la tablette),
// la ranger (rayon, produit, ordre), modifier sa note, la masquer. Jamais de
// suppression : une photo citée par une commande doit rester lisible.
//
// Accès gérant (code gérant, comme les Réglages des commandes). Données :
// GET / POST / PATCH /api/photos-modeles/gestion ; produits proposés : le
// catalogue de commande du jour (GET /api/tarifs), sans aucun prix affiché.
// Toutes les règles (rayon, note sans prix, produit au tarif, ordre) sont
// celles de src/catalogue/photosModeles.ts, rejouées par le serveur : l'écran
// affiche le refus en français avec sa sortie en un geste.
//
// Tablette : gros boutons, un rayon à la fois (peu de défilement), retour
// visible tout de suite (vignette surlignée, « Enregistré »). Un seul champ
// texte libre obligé : « Nouveau rayon » ; la note et la recherche de produit
// sont des textes courts, aucun champ chiffré.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Bouton, Chargement, Entete, LienBouton, Puce } from '@/components/ui';
import { ListeSignalements } from '@/components/signalement';
import type { SignalementAffichable } from '@/components/signalement/trier';
import { RappelChargement } from '@/components/rappels';
import { AccesGerant } from '@/components/commande/AccesGerant';
import { echecReseau, estSupplement, lireReponse, SUPPLEMENT_PATE_A_SUCRE, type CatalogueCommande, type FicheCatalogue } from '@/components/commande/modele';
import { reduirePhoto } from '@/components/commande/reduirePhoto';
import { ERR_FORMAT_PHOTO, ERR_PHOTO_TROP_LOURDE, refusImageManquante } from '@/components/commande/photosGestion';
import { signaler } from '@/domaine/messages';
import { LONGUEUR_MAX_NOTE, LONGUEUR_MAX_RAYON, rayonsDansLOrdre, trierPhotos, type PhotoModele } from '@/catalogue/photosModeles';
import { SUPPLEMENTS_PAR_PERSONNE } from '@/domaine/constantes';
import { libelleProduitFiche } from '@/domaine/libelles';
import type { Echec } from '@/domaine/resultat';
import { useEquipe } from '@/lib/vendeurs';

type Galerie = { photos: PhotoModele[]; rayons: string[] };
type Edition = { mode: 'ajout' } | { mode: 'modif'; photo: PhotoModele };

const URL_GESTION = '/api/photos-modeles/gestion';
const CHAMP = 'min-h-14 w-full rounded-xl border-2 border-line-fort bg-surface px-3 text-lg text-ink placeholder:text-ink-3';
const GROS = 'min-h-14 rounded-xl border-2 px-4 text-lg font-semibold';
const CHOIX_ACTIF = 'border-accent bg-accent text-white shadow';
const CHOIX = 'border-line-fort bg-surface text-ink';
/** Produits montrés à la fois (la recherche affine). */
const PRODUITS_MAX = 18;

function photosRangees(photos: readonly PhotoModele[]): Galerie {
  const triees = trierPhotos(photos);
  return { photos: triees, rayons: rayonsDansLOrdre(triees) };
}

export default function PhotosModeles() {
  const [acces, setAcces] = useState<'inconnu' | 'ferme' | 'ouvert'>('inconnu');
  const [galerie, setGalerie] = useState<Galerie | null>(null);
  const [fiches, setFiches] = useState<FicheCatalogue[] | null>(null);
  const [choix, setChoix] = useState<string | null>(null);
  const [edition, setEdition] = useState<Edition | null>(null);
  const [refus, setRefus] = useState<Echec | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [eclair, setEclair] = useState<string | null>(null);

  const refuser = useCallback((r: Echec) => {
    setRefus(r);
    // Accès gérant expiré : on redemande le code au lieu de laisser l'écran muet.
    if (r.code === 'ERR_DROIT_INSUFFISANT' || r.code === 'ERR_SESSION_EXPIREE') setAcces('ferme');
  }, []);

  const charger = useCallback(async () => {
    try {
      const [g, t] = await Promise.all([
        fetch(URL_GESTION).then((r) => lireReponse<Galerie>(r)),
        fetch('/api/tarifs').then((r) => lireReponse<CatalogueCommande>(r)),
      ]);
      if (g.ok) setGalerie(photosRangees(Array.isArray(g.donnees.photos) ? g.donnees.photos : []));
      else refuser(g);
      if (t.ok) setFiches(Array.isArray(t.donnees.fiches) ? t.donnees.fiches : []);
      else refuser(t);
    } catch {
      const e = echecReseau();
      if (!e.ok) setRefus(e);
    }
  }, [refuser]);

  // L'accès gérant est-il déjà ouvert sur cette tablette ?
  useEffect(() => {
    let annule = false;
    fetch('/api/calendrier')
      .then((r) => lireReponse<{ gerant: boolean }>(r))
      .then((r) => {
        if (!annule) setAcces(r.ok && r.donnees.gerant ? 'ouvert' : 'ferme');
      })
      .catch(() => {
        if (!annule) setAcces('ferme');
      });
    return () => {
      annule = true;
    };
  }, []);

  useEffect(() => {
    if (acces !== 'ouvert') return;
    let annule = false;
    (async () => {
      await Promise.resolve();
      if (!annule) await charger();
    })();
    return () => {
      annule = true;
    };
  }, [acces, charger]);

  // Surbrillance brève de la photo touchée : elle s'éteint seule.
  useEffect(() => {
    if (!eclair) return;
    const t = window.setTimeout(() => setEclair(null), 1500);
    return () => window.clearTimeout(t);
  }, [eclair]);

  /** Photos reçues du serveur → posées dans la liste locale (aucun rechargement). */
  const poser = useCallback((recues: readonly PhotoModele[], dire = 'Enregistré') => {
    setGalerie((g) => {
      const parId = new Map((g?.photos ?? []).map((p) => [p.id, p]));
      for (const p of recues) parId.set(p.id, { ...parId.get(p.id), ...p });
      return photosRangees([...parId.values()]);
    });
    setRefus(null);
    setMessage(dire);
    window.setTimeout(() => setMessage(null), 2500);
  }, []);

  /** PATCH : la photo (modifier, masquer) ou les photos renumérotées (déplacer). */
  const patcher = useCallback(
    async (corps: Record<string, unknown>): Promise<boolean> => {
      try {
        const r = await lireReponse<PhotoModele | PhotoModele[]>(
          await fetch(URL_GESTION, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }),
        );
        if (!r.ok) {
          refuser(r);
          return false;
        }
        const recues = Array.isArray(r.donnees) ? r.donnees : [r.donnees];
        // Déplacement au bout du rayon : rien ne change, rien à dire.
        poser(recues, recues.length === 0 ? 'Déjà au bout du rayon' : 'Enregistré');
        if (typeof corps.id === 'string') setEclair(corps.id);
        return true;
      } catch {
        const e = echecReseau();
        if (!e.ok) setRefus(e);
        return false;
      }
    },
    [poser, refuser],
  );

  const rayons = galerie?.rayons ?? [];
  const rayon = choix !== null && rayons.includes(choix) ? choix : (rayons[0] ?? '');
  const duRayon = (galerie?.photos ?? []).filter((p) => p.categorie === rayon);
  const parCle = useMemo(() => new Map((fiches ?? []).map((f) => [f.produit.id, f])), [fiches]);

  const refusAffiche = refus && edition === null ? (
    <ListeSignalements
      className="mb-3"
      signalements={[refus]}
      autreSortiePour={() => (
        <Bouton className="min-h-12 px-5 text-base" onClick={() => setRefus(null)}>
          {acces === 'ferme' ? 'Ressaisir le code' : 'Fermer'}
        </Bouton>
      )}
    />
  ) : null;

  if (acces === 'inconnu') {
    return (
      <>
        <Chargement />
        <RappelChargement />
      </>
    );
  }

  if (acces === 'ferme') {
    return (
      <>
        <Entete titre="Photos des modèles" sousTitre="Réservé au gérant." />
        {refusAffiche}
        <div className="max-w-xl">
          <AccesGerant
            raison="Saisissez le code gérant pour gérer les photos des modèles."
            onAccorde={() => {
              setRefus(null);
              setAcces('ouvert');
            }}
            onAnnuler={() => history.back()}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Entete
        titre="Photos des modèles"
        sousTitre="Les photos que la vendeuse montre au client dans l’écran de commande. Une photo masquée n’y apparaît plus."
        actions={
          <>
            {message ? <Puce ton="ok">{message}</Puce> : null}
            <LienBouton href="/commandes/reglages" className="min-h-12 px-4 text-base">
              ← Réglages
            </LienBouton>
            <Bouton variante="principal" className="min-h-14 px-6 text-lg" onClick={() => setEdition({ mode: 'ajout' })} disabled={galerie === null}>
              + Ajouter une photo
            </Bouton>
          </>
        }
      />
      {refusAffiche}

      {galerie === null || fiches === null ? (
        <>
          <Chargement libelle="Chargement des photos…" />
          <RappelChargement />
        </>
      ) : (
        <>
          <div role="group" aria-label="Rayons" className="mb-3 flex flex-wrap gap-2">
            {rayons.map((r) => {
              const n = galerie.photos.filter((p) => p.categorie === r).length;
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={r === rayon}
                  onClick={() => setChoix(r)}
                  className={`min-h-12 rounded-xl border-2 px-4 text-base font-semibold ${r === rayon ? CHOIX_ACTIF : CHOIX}`}
                >
                  {r} <span className="chiffres font-normal opacity-80">({n})</span>
                </button>
              );
            })}
          </div>

          {duRayon.length === 0 ? (
            <p className="py-10 text-center text-lg text-ink-2">Aucune photo : touchez « Ajouter une photo ».</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {duRayon.map((p, i) => (
                <TuilePhoto
                  key={p.id}
                  photo={p}
                  produit={libelleDeCle(p.produit, parCle)}
                  premiere={i === 0}
                  derniere={i === duRayon.length - 1}
                  allumee={eclair === p.id}
                  onDeplacer={(sens) => void patcher({ id: p.id, action: 'deplacer', sens })}
                  onMasquer={() => void patcher({ id: p.id, action: 'masquer', masquee: !p.masquee })}
                  onModifier={() => {
                    setRefus(null);
                    setEdition({ mode: 'modif', photo: p });
                  }}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {edition && galerie && fiches ? (
        <FichePhoto
          key={edition.mode === 'modif' ? edition.photo.id : 'ajout'}
          edition={edition}
          rayons={rayons}
          rayonCourant={rayon}
          fiches={fiches}
          parCle={parCle}
          refus={refus}
          setRefus={setRefus}
          refuser={refuser}
          patcher={patcher}
          onCreee={(p) => {
            poser([p], `Photo ${p.id} ajoutée`);
            setChoix(p.categorie);
            setEclair(p.id);
            setEdition(null);
          }}
          onFermer={() => {
            setRefus(null);
            setEdition(null);
          }}
          onRangee={(categorie) => {
            setChoix(categorie);
            setEdition(null);
          }}
        />
      ) : null}
    </>
  );
}

/** Libellé du produit d'une photo, au catalogue du jour, à la lettre (LOI 5). */
function libelleDeCle(cle: string | null, parCle: ReadonlyMap<string, FicheCatalogue>): string {
  if (cle === null) return 'Produit au choix de la vendeuse';
  const f = parCle.get(cle);
  return f ? libelleProduitFiche(f) : `Hors tarif du jour (${cle})`;
}

/* ================================================================ Tuile */

function TuilePhoto({
  photo,
  produit,
  premiere,
  derniere,
  allumee,
  onDeplacer,
  onMasquer,
  onModifier,
}: {
  photo: PhotoModele;
  produit: string;
  premiere: boolean;
  derniere: boolean;
  allumee: boolean;
  onDeplacer: (sens: 'avant' | 'apres') => void;
  onMasquer: () => void;
  onModifier: () => void;
}) {
  const fleche = 'min-h-12 min-w-12 rounded-xl border-2 border-line-fort bg-surface text-xl font-semibold text-ink disabled:opacity-30';
  return (
    <li
      className={`flex flex-col overflow-hidden rounded-xl border-2 bg-surface ${allumee ? 'border-accent ring-4 ring-accent/30' : 'border-line'}`}
    >
      <div className={`relative ${photo.masquee ? 'opacity-40 grayscale' : ''}`}>
        {/* Images déjà allégées (640 px) : servies telles quelles, sans passage par l'optimiseur. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt="" loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
      </div>
      <div className="flex flex-1 flex-col gap-1 px-2 pt-1.5">
        <p className="flex flex-wrap items-baseline gap-2">
          <span className="chiffres text-sm font-semibold text-ink">{photo.id}</span>
          {photo.masquee ? <Puce ton="attention">Masquée</Puce> : null}
        </p>
        <p className={`text-sm leading-tight ${photo.produit === null ? 'italic text-ink-2' : 'text-ink'}`}>{produit}</p>
        {photo.note ? <p className="text-sm leading-tight text-ink-2">« {photo.note} »</p> : null}
      </div>
      <div className="flex items-center gap-1.5 p-2">
        <button type="button" className={fleche} disabled={premiere} onClick={() => onDeplacer('avant')} aria-label={`Avancer la photo ${photo.id}`}>
          ◀
        </button>
        <button
          type="button"
          onClick={onModifier}
          className="min-h-12 flex-1 rounded-xl border-2 border-line-fort bg-surface px-2 text-base font-semibold text-ink"
        >
          Modifier
        </button>
        <button type="button" className={fleche} disabled={derniere} onClick={() => onDeplacer('apres')} aria-label={`Reculer la photo ${photo.id}`}>
          ▶
        </button>
      </div>
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={onMasquer}
          className={`min-h-12 w-full rounded-xl border-2 px-2 text-base font-semibold ${
            photo.masquee ? 'border-accent bg-accent-doux text-accent' : 'border-line-fort bg-surface text-ink-2'
          }`}
        >
          {photo.masquee ? 'Réafficher' : 'Masquer'}
        </button>
      </div>
    </li>
  );
}

/* ================================================================ Fiche (ajout / modification) */

function FichePhoto({
  edition,
  rayons,
  rayonCourant,
  fiches,
  parCle,
  refus,
  setRefus,
  refuser,
  patcher,
  onCreee,
  onFermer,
  onRangee,
}: {
  edition: Edition;
  rayons: string[];
  rayonCourant: string;
  fiches: FicheCatalogue[];
  parCle: ReadonlyMap<string, FicheCatalogue>;
  refus: Echec | null;
  setRefus: (e: Echec | null) => void;
  refuser: (e: Echec) => void;
  patcher: (corps: Record<string, unknown>) => Promise<boolean>;
  onCreee: (p: PhotoModele) => void;
  onFermer: () => void;
  onRangee: (categorie: string) => void;
}) {
  const avant = edition.mode === 'modif' ? edition.photo : null;
  const { equipe, vendeur, definirVendeur, ajouter } = useEquipe();
  const entreeFichier = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<Blob | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [reduction, setReduction] = useState(false);
  const [categorie, setCategorie] = useState(avant?.categorie ?? rayonCourant);
  const [nouveauRayon, setNouveauRayon] = useState(false);
  const [produit, setProduit] = useState<string | null>(avant?.produit ?? null);
  const [supplements, setSupplements] = useState<string[]>([...(avant?.supplements ?? [])]);
  const [note, setNote] = useState(avant?.note ?? '');
  const [recherche, setRecherche] = useState('');
  const [autrePrenom, setAutrePrenom] = useState('');
  const [envoi, setEnvoi] = useState(false);

  // L'aperçu est une adresse locale : libérée quand il change ou à la fermeture.
  useEffect(() => {
    if (!apercu) return;
    return () => URL.revokeObjectURL(apercu);
  }, [apercu]);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    window.addEventListener('keydown', touche);
    const avantDefilement = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', touche);
      document.body.style.overflow = avantDefilement;
    };
  }, [onFermer]);

  const choisirFichier = async (fichier: File | undefined) => {
    if (!fichier) return;
    setReduction(true);
    const r = await reduirePhoto(fichier);
    setReduction(false);
    if (!r.ok) {
      setRefus(r);
      return;
    }
    setRefus(null);
    setImage(r.donnees);
    setApercu(URL.createObjectURL(r.donnees));
  };

  // Pâte à sucre : proposée seulement si le produit choisi peut la recevoir (donnée du domaine)
  // et si elle est au tarif du jour. Libellé du catalogue, jamais de prix.
  const regle = SUPPLEMENTS_PAR_PERSONNE[SUPPLEMENT_PATE_A_SUCRE];
  const ficheSucre = parCle.get(SUPPLEMENT_PATE_A_SUCRE) ?? null;
  const sucrePossible = !!regle && !!ficheSucre && produit !== null && regle.gateaux.includes(produit);
  const changerProduit = (cle: string | null) => {
    setProduit(cle);
    if (!(cle !== null && regle?.gateaux.includes(cle))) setSupplements((s) => s.filter((x) => x !== SUPPLEMENT_PATE_A_SUCRE));
  };

  const candidats = useMemo(() => {
    const mots = recherche
      .toLocaleLowerCase('fr')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .split(/\s+/)
      .filter(Boolean);
    const simplifier = (t: string) => t.toLocaleLowerCase('fr').normalize('NFD').replace(/\p{M}/gu, '');
    return fiches
      .filter((f) => !estSupplement(f))
      .filter((f) => {
        const t = simplifier(`${libelleProduitFiche(f)} ${f.produit.categorie}`);
        return mots.every((m) => t.includes(m));
      });
  }, [fiches, recherche]);

  const prenom = vendeur;

  const enregistrer = async () => {
    if (envoi) return;
    if (avant) {
      // Seuls les champs changés partent : le serveur ne revérifie que ceux-là.
      const corps: Record<string, unknown> = { id: avant.id, action: 'modifier' };
      if (categorie.trim() !== avant.categorie) corps.categorie = categorie;
      if (produit !== avant.produit) corps.produit = produit;
      if (supplements.join('|') !== (avant.supplements ?? []).join('|')) corps.supplements = supplements;
      if ((note.trim() || null) !== avant.note) corps.note = note;
      if (Object.keys(corps).length === 2) return onFermer();
      setEnvoi(true);
      const ok = await patcher(corps);
      setEnvoi(false);
      if (ok) onRangee(categorie.trim());
      return;
    }
    // Vérifié avant l'envoi (réseau faible) ; le serveur le revérifie.
    if (!image) return setRefus(refusImageManquante());
    if (!prenom) return setRefus(signaler('ERR_CHAMP_OBLIGATOIRE', { champLibelle: 'prénom' }, { champ: 'creePar' }));
    const f = new FormData();
    f.append('image', image, 'photo.jpg');
    f.append('categorie', categorie);
    f.append('produit', produit ?? '');
    f.append('supplements', JSON.stringify(supplements));
    f.append('note', note);
    f.append('creePar', prenom);
    setEnvoi(true);
    try {
      const r = await lireReponse<PhotoModele>(await fetch(URL_GESTION, { method: 'POST', body: f }));
      if (r.ok) onCreee(r.donnees);
      else refuser(r);
    } catch {
      const e = echecReseau();
      if (!e.ok) setRefus(e);
    } finally {
      setEnvoi(false);
    }
  };

  /** Sortie en un geste pour un refus du serveur (valeurProposee du catalogue). */
  const libelleCorrectionPour = (s: SignalementAffichable): string | undefined => {
    if (s.valeurProposee === undefined) return undefined;
    if (s.champ === 'categorie' && typeof s.valeurProposee === 'string') return `Ranger dans « ${s.valeurProposee} »`;
    if (s.champ === 'note' && typeof s.valeurProposee === 'string') return 'Raccourcir la note';
    if (s.champ === 'supplements' && Array.isArray(s.valeurProposee)) return 'Retirer le supplément en trop';
    return undefined;
  };
  const corriger = (s: SignalementAffichable, v: unknown) => {
    if (s.champ === 'categorie' && typeof v === 'string') {
      setCategorie(v);
      setNouveauRayon(false);
    } else if (s.champ === 'note' && typeof v === 'string') setNote(v);
    else if (s.champ === 'supplements' && Array.isArray(v)) setSupplements(v.filter((x): x is string => typeof x === 'string'));
    setRefus(null);
  };
  const autreSortiePour = (s: SignalementAffichable): ReactNode => {
    if (libelleCorrectionPour(s)) return null;
    if (s.code === ERR_FORMAT_PHOTO || s.code === ERR_PHOTO_TROP_LOURDE || s.champ === 'image') {
      return (
        <Bouton className="min-h-12 px-5 text-base" onClick={() => entreeFichier.current?.click()}>
          Reprendre une photo
        </Bouton>
      );
    }
    if (s.champ === 'produit') {
      return (
        <Bouton className="min-h-12 px-5 text-base" onClick={() => changerProduit(null)}>
          Laisser la vendeuse choisir le produit
        </Bouton>
      );
    }
    if (s.champ === 'note') {
      return (
        <Bouton className="min-h-12 px-5 text-base" onClick={() => setNote('')}>
          Effacer la note
        </Bouton>
      );
    }
    if (s.champ === 'creePar') {
      return (
        <Bouton className="min-h-12 px-5 text-base" onClick={() => setRefus(null)}>
          Choisir mon prénom ci-dessous
        </Bouton>
      );
    }
    return (
      <Bouton className="min-h-12 px-5 text-base" onClick={() => setRefus(null)}>
        Fermer
      </Bouton>
    );
  };

  const sansProduit = produit === null;
  const ficheChoisie = produit !== null ? (parCle.get(produit) ?? null) : null;
  const autresSupplements = supplements.filter((s) => s !== SUPPLEMENT_PATE_A_SUCRE);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="fiche-photo-titre" className="fixed inset-0 z-50 flex flex-col bg-surface">
      <div className="flex flex-none items-center gap-3 border-b border-line px-3 pb-2 pt-3">
        <h2 id="fiche-photo-titre" className="min-w-0 flex-1 text-xl font-bold text-ink">
          {avant ? `Photo ${avant.id}` : 'Ajouter une photo'}
        </h2>
        <button type="button" onClick={onFermer} className="min-h-14 shrink-0 rounded-xl border-2 border-line-fort bg-surface px-5 text-lg font-semibold text-ink">
          Annuler
        </button>
        <button
          type="button"
          onClick={() => void enregistrer()}
          disabled={envoi || reduction}
          className="min-h-14 shrink-0 rounded-xl bg-accent px-6 text-lg font-semibold text-white shadow disabled:opacity-60"
        >
          {envoi ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        {refus ? (
          <ListeSignalements
            className="mb-3"
            signalements={[refus]}
            libelleCorrectionPour={libelleCorrectionPour}
            onCorriger={corriger}
            autreSortiePour={autreSortiePour}
          />
        ) : null}

        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* ---- La photo */}
          <section className="flex flex-col gap-2">
            <input
              ref={entreeFichier}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              aria-label="Prendre ou choisir une photo"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = ''; // la même photo peut être reprise
                void choisirFichier(f);
              }}
            />
            {avant ? (
              <div className={avant.masquee ? 'opacity-40 grayscale' : ''}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avant.url} alt="" className="aspect-square w-full rounded-xl border border-line object-cover" />
              </div>
            ) : apercu ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={apercu} alt="Aperçu de la photo" className="aspect-square w-full rounded-xl border border-line object-cover" />
                <button type="button" onClick={() => entreeFichier.current?.click()} className={`${GROS} ${CHOIX}`}>
                  Reprendre la photo
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => entreeFichier.current?.click()}
                disabled={reduction}
                className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border-4 border-dashed border-accent bg-accent-doux text-xl font-semibold text-accent"
              >
                {reduction ? 'Préparation de la photo…' : 'Prendre ou choisir une photo'}
              </button>
            )}
            {avant ? <p className="text-sm text-ink-2">L’image d’une photo ne se remplace pas : pour une autre image, ajoutez une photo et masquez celle-ci.</p> : null}
          </section>

          {/* ---- Rangement */}
          <section className="flex flex-col gap-4">
            <div>
              <h3 className="mb-1.5 text-base font-semibold text-ink">Rayon</h3>
              <div className="flex flex-wrap gap-2">
                {rayons.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={!nouveauRayon && categorie === r}
                    onClick={() => {
                      setNouveauRayon(false);
                      setCategorie(r);
                    }}
                    className={`min-h-12 rounded-xl border-2 px-4 text-base font-semibold ${!nouveauRayon && categorie === r ? CHOIX_ACTIF : CHOIX}`}
                  >
                    {r}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={nouveauRayon}
                  onClick={() => {
                    setNouveauRayon(true);
                    setCategorie('');
                  }}
                  className={`min-h-12 rounded-xl border-2 border-dashed px-4 text-base font-semibold ${nouveauRayon ? CHOIX_ACTIF : CHOIX}`}
                >
                  + Nouveau rayon
                </button>
              </div>
              {nouveauRayon ? (
                <input
                  autoFocus
                  value={categorie}
                  maxLength={LONGUEUR_MAX_RAYON}
                  onChange={(e) => setCategorie(e.target.value)}
                  placeholder="Nom du nouveau rayon"
                  aria-label="Nom du nouveau rayon"
                  className={`${CHAMP} mt-2`}
                />
              ) : null}
            </div>

            <div>
              <h3 className="mb-1.5 text-base font-semibold text-ink">Produit</h3>
              <p className="mb-2 text-base text-ink">
                {sansProduit ? (
                  <span className="italic text-ink-2">Au choix de la vendeuse (bûches, tartes…)</span>
                ) : (
                  <b>{ficheChoisie ? libelleProduitFiche(ficheChoisie) : `Hors tarif du jour (${produit})`}</b>
                )}
              </p>
              <div className="flex gap-2">
                <input
                  type="search"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Chercher un produit (layer, bavarois, number…)"
                  aria-label="Chercher un produit"
                  className={CHAMP}
                />
                {recherche ? (
                  <button type="button" onClick={() => setRecherche('')} className={`${GROS} ${CHOIX} shrink-0`} aria-label="Effacer la recherche">
                    ✕
                  </button>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={sansProduit}
                  onClick={() => changerProduit(null)}
                  className={`min-h-12 rounded-xl border-2 px-3 text-base ${sansProduit ? CHOIX_ACTIF : CHOIX}`}
                >
                  Au choix de la vendeuse
                </button>
                {candidats.slice(0, PRODUITS_MAX).map((f) => (
                  <button
                    key={f.produit.id}
                    type="button"
                    aria-pressed={produit === f.produit.id}
                    onClick={() => changerProduit(f.produit.id)}
                    className={`min-h-12 rounded-xl border-2 px-3 text-base ${produit === f.produit.id ? CHOIX_ACTIF : CHOIX}`}
                  >
                    {libelleProduitFiche(f)}
                  </button>
                ))}
              </div>
              {candidats.length > PRODUITS_MAX ? (
                <p className="mt-1 text-sm text-ink-2">
                  {candidats.length - PRODUITS_MAX} autres produits : précisez la recherche.
                </p>
              ) : candidats.length === 0 ? (
                <p className="mt-1 text-sm text-ink-2">Aucun produit ne correspond : changez la recherche.</p>
              ) : null}
            </div>

            {sucrePossible && ficheSucre ? (
              <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-line-fort px-3">
                <input
                  type="checkbox"
                  className="h-7 w-7 accent-accent"
                  checked={supplements.includes(SUPPLEMENT_PATE_A_SUCRE)}
                  onChange={(e) =>
                    setSupplements((s) =>
                      e.target.checked ? [...s.filter((x) => x !== SUPPLEMENT_PATE_A_SUCRE), SUPPLEMENT_PATE_A_SUCRE] : s.filter((x) => x !== SUPPLEMENT_PATE_A_SUCRE),
                    )
                  }
                />
                <span className="text-lg text-ink">
                  Modèle en {libelleProduitFiche(ficheSucre)}
                  <span className="block text-sm text-ink-2">Cochée d’office quand la vendeuse touche la photo.</span>
                </span>
              </label>
            ) : null}
            {autresSupplements.length > 0 ? (
              <p className="text-sm text-ink-2">
                Aussi sur ce modèle :{' '}
                {autresSupplements.map((s) => {
                  const f = parCle.get(s);
                  return f ? libelleProduitFiche(f) : s;
                }).join(', ')}{' '}
                (jamais ajouté d’office à la commande).
              </p>
            ) : null}

            <div>
              <h3 className="mb-1.5 text-base font-semibold text-ink">
                Note pour la vendeuse <span className="font-normal text-ink-2">(facultative, sans prix)</span>
              </h3>
              <input
                value={note}
                maxLength={LONGUEUR_MAX_NOTE}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex. : 2 étages, fleurs en sucre"
                aria-label="Note pour la vendeuse"
                className={CHAMP}
              />
            </div>

            {avant ? null : (
              <div>
                <h3 className="mb-1.5 text-base font-semibold text-ink">Photo ajoutée par</h3>
                <div className="flex flex-wrap items-center gap-2">
                  {equipe.map((nom) => (
                    <button
                      key={nom}
                      type="button"
                      aria-pressed={prenom === nom}
                      onClick={() => definirVendeur(nom)}
                      className={`min-h-12 rounded-xl border-2 px-4 text-base font-semibold ${prenom === nom ? CHOIX_ACTIF : CHOIX}`}
                    >
                      {nom}
                    </button>
                  ))}
                  {prenom && !equipe.includes(prenom) ? (
                    <span className={`inline-flex min-h-12 items-center rounded-xl border-2 px-4 text-base font-semibold ${CHOIX_ACTIF}`}>{prenom}</span>
                  ) : null}
                </div>
                {!prenom ? (
                  <form
                    className="mt-2 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const nom = autrePrenom.trim();
                      if (!nom) return;
                      ajouter(nom);
                      definirVendeur(nom);
                      setAutrePrenom('');
                    }}
                  >
                    <input
                      value={autrePrenom}
                      onChange={(e) => setAutrePrenom(e.target.value)}
                      placeholder="Votre prénom"
                      aria-label="Votre prénom"
                      className={CHAMP}
                    />
                    <button type="submit" className={`${GROS} ${CHOIX} shrink-0`}>
                      OK
                    </button>
                  </form>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
