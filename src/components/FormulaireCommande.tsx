'use client';

// src/components/FormulaireCommande.tsx
//
// Un seul formulaire pour prendre une commande et pour la corriger : les
// règles de prix, les suppléments et les contrôles ne doivent exister qu'à un
// seul endroit, sinon les deux écrans divergent au premier changement de tarif.
//
// Objectif chiffré : une commande simple saisie en moins de 45 secondes,
// client en face. Au-delà, les vendeurs noteront sur un bout de papier « à
// saisir plus tard » et le problème d'aujourd'hui reviendra, en pire.
//
// D'où les partis pris : pas de champ inutile, autocomplétion dès la deuxième
// lettre, prix repris du tarif mais toujours modifiable, et un produit inconnu
// se saisit à la volée sans demander la permission à personne.

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alerte, Bouton, Carte, Entete } from '@/components/ui';
import { useEquipe } from '@/lib/vendeurs';
import {
  controlerCommande,
  formaterEuros,
  lireMontant,
  estUnSupplement,
  supplementsDe,
  totalCentimes,
  SUPPLEMENT_ECRITURE_CENTIMES,
  SUPPLEMENT_PHOTO_CENTIMES,
  type Avertissement,
  type Commande,
  type LigneCommande,
  type ModePaiement,
  type Origine,
} from '@/lib/commandes';
import {
  calculerPrixGateau,
  coupeAcceptable,
  coupesProches,
  COUPES_PAR_DEFAUT,
  libelleGateau,
  PARFUMS_MAXIMUM,
  type CompositionGateau,
  type GenreFamille,
  type OptionGateau,
} from '@/lib/gateaux';
import { dateDuJour } from '@/lib/dateProduction';

type Tarif = {
  id: number;
  nom: string;
  categorie: string;
  prixCentimes: number;
  poste: string | null;
};

const CHAMP_BASE =
  'min-h-11 rounded-lg border border-line-fort bg-surface px-3 text-base text-ink placeholder:text-ink-3';
const CHAMP = `${CHAMP_BASE} w-full`;
const ETIQUETTE = 'mb-1 block text-xs font-medium uppercase tracking-wide text-ink-3';

/**
 * « Crème fraîche » se cherche en tapant « creme » : personne ne va poser
 * les accents au comptoir avec un client en face.
 */
function normaliser(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function FormulaireCommande({ commande }: { commande?: Commande }) {
  const router = useRouter();
  const { vendeur, prete } = useEquipe();
  const modification = commande !== undefined;

  // En correction, les suppléments sont reconstruits depuis les cases à cocher :
  // les garder en ligne les dupliquerait à l'enregistrement.
  const lignesInitiales = (commande?.lignes ?? []).filter((l) => !estUnSupplement(l.libelle));

  const [tarifs, setTarifs] = useState<Tarif[] | null>(null);
  const [composition, setComposition] = useState<CompositionGateau | null>(null);
  const [client, setClient] = useState(commande?.client ?? '');
  const [telephone, setTelephone] = useState(commande?.telephone ?? '');
  const [retraitLe, setRetraitLe] = useState(commande?.retraitLe ?? dateDuJour());
  const [retraitHeure, setRetraitHeure] = useState(commande?.retraitHeure ?? '11:00');
  const [origine, setOrigine] = useState<Origine>(commande?.origine ?? 'comptoir');
  const [modePaiement, setModePaiement] = useState<ModePaiement>(commande?.modePaiement ?? 'especes');
  const [acompte, setAcompte] = useState(
    commande ? (commande.acompteCentimes / 100).toFixed(2).replace('.', ',') : ''
  );
  const [texteGateau, setTexteGateau] = useState(commande?.texteGateau ?? '');
  const [sansEcriture, setSansEcriture] = useState(commande?.sansEcriture ?? false);
  const [photoModele, setPhotoModele] = useState(commande?.photoWhatsapp ?? false);
  const [photoImprimee, setPhotoImprimee] = useState(commande?.photoImprimee ?? false);
  const [gateauComplexe, setGateauComplexe] = useState(commande?.gateauComplexe ?? false);
  const [assistant, setAssistant] = useState<GenreFamille | null>(null);
  const [remarques, setRemarques] = useState(commande?.remarques ?? '');
  const [lignes, setLignes] = useState<LigneCommande[]>(lignesInitiales);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const champAcompte = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/tarifs')
      .then((r) => (r.ok ? r.json() : []))
      .then((liste: Tarif[]) => setTarifs(Array.isArray(liste) ? liste : []))
      .catch(() => setTarifs([]));

    fetch('/api/gateaux')
      .then((r) => (r.ok ? r.json() : null))
      .then((donnees: CompositionGateau | null) =>
        setComposition(donnees && Array.isArray(donnees.familles) ? donnees : null)
      )
      .catch(() => setComposition(null));
  }, []);

  useEffect(() => {
    if (prete && !vendeur) router.replace('/commandes');
  }, [prete, vendeur, router]);

  // Au téléphone il n'y a pas d'argent au comptoir : l'acompte se paie par
  // virement, après confirmation sur WhatsApp.
  useEffect(() => {
    setModePaiement(origine === 'telephone' ? 'virement' : 'especes');
  }, [origine]);

  // Les suppléments ne se saisissent pas : ils découlent de l'écriture et de
  // la photo, s'ajoutent au bon en clair, et le client voit ce qu'il paie.
  const supplements = useMemo(
    () => supplementsDe({ photoImprimee, texteGateau }),
    [photoImprimee, texteGateau]
  );
  const lignesFinales = useMemo(() => [...lignes, ...supplements], [lignes, supplements]);

  // Le total suit les lignes, sauf si le vendeur l'a fixé à la main : sur un
  // gâteau au prix par personne, c'est souvent un prix rond convenu au comptoir.
  const totalCalcule = totalCentimes(lignesFinales);
  const [totalManuel, setTotalManuel] = useState<string | null>(() => {
    if (!commande) return null;
    // Un total qui ne correspond pas à la somme des lignes est un prix convenu :
    // le rouvrir en « recalculé » l'écraserait silencieusement.
    const somme = totalCentimes(commande.lignes);
    return commande.totalCentimes === somme
      ? null
      : (commande.totalCentimes / 100).toFixed(2).replace('.', ',');
  });
  const total = totalManuel === null ? totalCalcule : lireMontant(totalManuel) ?? totalCalcule;
  const acompteCentimes = lireMontant(acompte) ?? 0;

  const avertissements = useMemo<Avertissement[]>(
    () =>
      controlerCommande({ lignes: lignesFinales, retraitLe, texteGateau, sansEcriture, gateauComplexe }),
    [lignesFinales, retraitLe, texteGateau, sansEcriture, gateauComplexe]
  );

  const valider = async () => {
    setErreur(null);

    if (!client.trim()) return setErreur('Le nom du client est obligatoire.');
    if (!telephone.trim()) return setErreur('Le téléphone est obligatoire.');
    if (lignes.length === 0) return setErreur('Ajoutez au moins un produit.');
    if (acompteCentimes <= 0) {
      setErreur(
        'Une commande doit avoir un acompte pour être validée — au téléphone, il se paie par virement.'
      );
      champAcompte.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      champAcompte.current?.focus();
      return;
    }

    setEnvoi(true);
    try {
      const reponse = await fetch('/api/commandes', {
        method: modification ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(modification ? { id: commande.id, action: 'modification', auteur: vendeur } : {}),
          client,
          telephone,
          vendeur,
          origine,
          retraitLe,
          retraitHeure,
          modePaiement,
          acompteCentimes,
          totalCentimes: total,
          texteGateau: texteGateau || null,
          sansEcriture,
          photoWhatsapp: photoModele,
          photoImprimee,
          gateauComplexe,
          remarques: remarques || null,
          // Un avertissement affiché puis ignoré est enregistré : le jour où
          // une commande pose problème, on sait si la règle avait été signalée.
          avertissements: avertissements.map((a) => ({ ...a, passeOutre: true })),
          lignes: lignesFinales.map((l) => ({
            libelle: l.libelle,
            quantite: l.quantite,
            prixCentimes: l.prixCentimes,
            poste: l.poste,
            precision: l.precision,
            tarifId: l.tarifId,
          })),
        }),
      });

      const donnees = await reponse.json();
      if (!reponse.ok) throw new Error(donnees.error ?? 'Enregistrement impossible.');
      // Une commande corrigée doit ressortir de l'imprimante : le feuillet
      // accroché à l'atelier ne dit plus la vérité.
      router.push(`/commandes/${donnees.id}/imprimer`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Enregistrement impossible.');
      setEnvoi(false);
    }
  };

  if (!prete || !vendeur) return null;

  return (
    <>
      <Entete
        titre={modification ? `Modifier la commande ${commande.numero}` : 'Nouvelle commande'}
        sousTitre={
          modification ? (
            <>
              Chaque changement est enregistré et daté. La commande repassera par
              l’imprimante : le feuillet accroché ne dit plus la vérité.
            </>
          ) : (
            <>Prise par <span className="font-medium text-ink">{vendeur}</span></>
          )
        }
        actions={<Bouton onClick={() => router.push('/commandes')}>Annuler</Bouton>}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 pb-28 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:pb-0">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          {/* ------------------------------------------------ Le client */}
          <Carte className="p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={ETIQUETTE} htmlFor="client">Nom</label>
                <input id="client" className={CHAMP} value={client} onChange={(e) => setClient(e.target.value)} autoComplete="off" />
              </div>
              <div>
                <label className={ETIQUETTE} htmlFor="telephone">Téléphone</label>
                <input
                  id="telephone"
                  className={`${CHAMP} chiffres`}
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  inputMode="tel"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className={ETIQUETTE} htmlFor="retrait">Retrait le</label>
                <input id="retrait" type="date" className={CHAMP} value={retraitLe} onChange={(e) => setRetraitLe(e.target.value)} />
              </div>
              <div>
                <label className={ETIQUETTE} htmlFor="heure">À</label>
                <input id="heure" type="time" className={`${CHAMP} chiffres`} value={retraitHeure} onChange={(e) => setRetraitHeure(e.target.value)} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Choix actif={origine === 'comptoir'} onClick={() => setOrigine('comptoir')}>Au comptoir</Choix>
              <Choix actif={origine === 'telephone'} onClick={() => setOrigine('telephone')}>Par téléphone</Choix>
            </div>
          </Carte>

          {/* ---------------------------------------------- Les produits */}
          <Carte className="p-4">
            <h2 className={ETIQUETTE}>Produits commandés</h2>
            <AjoutProduit
              tarifs={tarifs ?? []}
              grilleChargee={tarifs !== null}
              onAjout={(ligne) => setLignes((l) => [...l, ligne])}
              onTarifCree={(t) => setTarifs((liste) => [...(liste ?? []), t])}
            />

            {/* Deux vrais boutons : c'est le geste le plus fréquent après la
                recherche, il ne doit pas ressembler à une note de bas de page. */}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Bouton
                variante={assistant === 'gateau' ? 'principal' : 'secondaire'}
                onClick={() => setAssistant(assistant === 'gateau' ? null : 'gateau')}
              >
                Gâteau sur mesure
              </Bouton>
              <Bouton
                variante={assistant === 'sale' ? 'principal' : 'secondaire'}
                onClick={() => setAssistant(assistant === 'sale' ? null : 'sale')}
              >
                Salé sur mesure
              </Bouton>
            </div>

            {assistant ? (
              <AssistantSurMesure
                key={assistant}
                genre={assistant}
                composition={composition}
                onAjout={(ligne) => setLignes((l) => [...l, ligne])}
                onFermer={() => setAssistant(null)}
              />
            ) : null}

            {lignes.length > 0 ? (
              <ul className="mt-4 divide-y divide-line border-t border-line">
                {lignes.map((ligne, index) => (
                  <li key={index}>
                    <LigneEditable
                      ligne={ligne}
                      onChange={(suivante) =>
                        setLignes((l) => l.map((autre, i) => (i === index ? suivante : autre)))
                      }
                      onRetirer={() => setLignes((l) => l.filter((_, i) => i !== index))}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-ink-3">Aucun produit pour l’instant.</p>
            )}

            {supplements.length > 0 ? (
              <ul className="mt-1 border-t border-line">
                {supplements.map((ligne) => (
                  <li
                    key={ligne.libelle}
                    className="flex items-baseline gap-3 py-2 text-sm text-ink-2"
                  >
                    <span className="chiffres w-12 shrink-0 text-accent">1 ×</span>
                    <span className="min-w-0 flex-1">
                      {ligne.libelle}
                      <span className="block text-xs text-ink-3">Ajouté automatiquement</span>
                    </span>
                    <span className="chiffres shrink-0 font-medium text-ink">
                      {formaterEuros(ligne.prixCentimes)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Carte>

          {/* ------------------------------------------------ Précisions */}
          <Carte className="p-4">
            <div className="grid gap-4">
              <div>
                <label className={ETIQUETTE} htmlFor="gateau">Écriture sur le gâteau</label>
                <input
                  id="gateau"
                  className={CHAMP}
                  value={texteGateau}
                  disabled={sansEcriture}
                  onChange={(e) => setTexteGateau(e.target.value)}
                  placeholder="JOYEUX ANNIVERSAIRE MARIAM"
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-ink-3">
                  Relisez-le au client à voix haute : c’est imprimé tel quel sur le feuillet du
                  pâtissier. Dès qu’un texte est saisi,{' '}
                  {formaterEuros(SUPPLEMENT_ECRITURE_CENTIMES)} s’ajoutent au bon.
                </p>
                <label className="mt-2 flex items-center gap-2.5 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={sansEcriture}
                    onChange={(e) => {
                      setSansEcriture(e.target.checked);
                      if (e.target.checked) setTexteGateau('');
                    }}
                    className="h-5 w-5 accent-[var(--accent)]"
                  />
                  Pas d’écriture sur le gâteau
                </label>
              </div>

              <div className="border-t border-line pt-3">
                <span className={ETIQUETTE}>Photo</span>
                <label className="flex items-start gap-2.5 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={photoModele}
                    onChange={(e) => setPhotoModele(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
                  />
                  <span>
                    Photo d’exemple envoyée sur WhatsApp
                    <span className="block text-xs text-ink-3">
                      Le client veut un gâteau ressemblant à sa photo. Aucun supplément.
                    </span>
                  </span>
                </label>
                <label className="mt-2.5 flex items-start gap-2.5 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={photoImprimee}
                    onChange={(e) => setPhotoImprimee(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
                  />
                  <span>
                    Photo à imprimer sur le gâteau
                    <span className="block text-xs text-ink-3">
                      {formaterEuros(SUPPLEMENT_PHOTO_CENTIMES)} ajoutés automatiquement au bon.
                    </span>
                  </span>
                </label>
              </div>

              <div className="border-t border-line pt-3">
                <label className="flex items-start gap-2.5 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={gateauComplexe}
                    onChange={(e) => setGateauComplexe(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
                  />
                  <span>
                    Gâteau complexe
                    <span className="block text-xs text-ink-3">
                      Forme, décor ou parfum inhabituel. Le prix affiché n’est qu’un prix d’appel :
                      à confirmer avec le manager avant de s’engager auprès du client.
                    </span>
                  </span>
                </label>
              </div>

              <div className="border-t border-line pt-3">
                <label className={ETIQUETTE} htmlFor="remarques">Remarques</label>
                <textarea
                  id="remarques"
                  className={`${CHAMP} min-h-20 py-2`}
                  value={remarques}
                  onChange={(e) => setRemarques(e.target.value)}
                />
              </div>
            </div>
          </Carte>
        </div>

        {/* ---------------------------------------------------- Le total */}
        <Carte className="p-4 lg:sticky lg:top-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-ink-2">Total</span>
            {totalManuel === null ? (
              <button
                type="button"
                onClick={() => setTotalManuel((total / 100).toFixed(2).replace('.', ','))}
                className="chiffres text-xl font-semibold text-ink underline decoration-line-fort decoration-1 underline-offset-4"
                title="Fixer un prix convenu"
              >
                {formaterEuros(total)}
              </button>
            ) : (
              <span className="flex items-baseline gap-1">
                <input
                  value={totalManuel}
                  onChange={(e) => setTotalManuel(e.target.value)}
                  inputMode="decimal"
                  aria-label="Total convenu"
                  className={`${CHAMP_BASE} chiffres w-24 px-2 text-right text-lg font-semibold`}
                />
                <span className="text-ink-2">€</span>
              </span>
            )}
          </div>
          {totalManuel === null ? (
            <p className="mt-1 text-right text-xs text-ink-3">
              Touchez le total pour fixer un prix convenu.
            </p>
          ) : (
            <p className="mt-1 flex items-center justify-end gap-2 text-xs text-ink-3">
              <span>Somme des lignes : {formaterEuros(totalCalcule)}</span>
              <button
                type="button"
                onClick={() => setTotalManuel(null)}
                className="underline underline-offset-2 hover:text-ink-2"
              >
                Recalculer
              </button>
            </p>
          )}

          <div className="mt-4">
            <label className={ETIQUETTE} htmlFor="acompte">Acompte reçu</label>
            <input
              id="acompte"
              ref={champAcompte}
              className={`${CHAMP} chiffres`}
              value={acompte}
              onChange={(e) => setAcompte(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Choix actif={modePaiement === 'especes'} onClick={() => setModePaiement('especes')}>Espèces</Choix>
              <Choix actif={modePaiement === 'virement'} onClick={() => setModePaiement('virement')}>Virement</Choix>
            </div>
          </div>

          <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3 text-sm">
            <span className="text-ink-2">Restant dû</span>
            <span className="chiffres font-medium text-ink">
              {formaterEuros(Math.max(0, total - acompteCentimes))}
            </span>
          </div>

          {avertissements.length > 0 ? (
            <ul className="mt-4 grid gap-2">
              {avertissements.map((a) => (
                <li
                  key={a.code + a.message}
                  className="rounded-lg border border-attention/30 bg-attention-doux px-3 py-2 text-xs text-attention"
                >
                  {a.message}
                </li>
              ))}
            </ul>
          ) : null}

          {erreur ? <div className="mt-4"><Alerte>{erreur}</Alerte></div> : null}

          <Bouton
            variante="principal"
            className="mt-4 w-full"
            disabled={envoi}
            onClick={() => void valider()}
          >
            {envoi ? 'Enregistrement…' : modification ? 'Enregistrer et réimprimer' : 'Valider et imprimer'}
          </Bouton>
          <p className="mt-2 text-xs text-ink-3">
            Aucun avertissement ne bloque : c’est vous qui avez le client en face.
          </p>
        </Carte>
      </div>

      {/* Sur téléphone, le récapitulatif est tout en bas de la page : sans
          cette barre, il faudrait remonter toute la commande pour valider. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="chiffres text-lg font-semibold leading-tight text-ink">
              {formaterEuros(total)}
            </div>
            <div className="truncate text-xs text-ink-2">
              {lignesFinales.length === 0
                ? 'Aucun produit'
                : `${lignesFinales.length} ligne${lignesFinales.length > 1 ? 's' : ''} · reste ${formaterEuros(
                    Math.max(0, total - acompteCentimes)
                  )}`}
              {avertissements.length > 0 ? (
                <span className="text-attention">
                  {' '}
                  · {avertissements.length} avertissement{avertissements.length > 1 ? 's' : ''}
                </span>
              ) : null}
            </div>
          </div>
          <Bouton
            variante="principal"
            className="shrink-0"
            disabled={envoi}
            onClick={() => void valider()}
          >
            {envoi ? 'Envoi…' : modification ? 'Enregistrer' : 'Valider'}
          </Bouton>
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------- Une ligne éditable */

/**
 * Une commande est par nature sur mesure : un bavarois de 12 parts, un goût qui
 * n'existe pas dans la grille, un prix négocié. La grille sert à aller vite sur
 * les cas courants — elle ne doit jamais enfermer le vendeur. Tout est donc
 * modifiable après l'ajout : le libellé, la quantité, le prix, et une ligne de
 * précision pour ce que le tarif ne dit pas.
 */
function LigneEditable({
  ligne,
  onChange,
  onRetirer,
}: {
  ligne: LigneCommande;
  onChange: (ligne: LigneCommande) => void;
  onRetirer: () => void;
}) {
  const [prix, setPrix] = useState(() => (ligne.prixCentimes / 100).toFixed(2).replace('.', ','));

  const changerPrix = (saisie: string) => {
    setPrix(saisie);
    const centimes = lireMontant(saisie);
    // Le prix modifié à la main quitte la grille : la ligne devient libre,
    // sinon le tarif d'origine réapparaîtrait dans les statistiques.
    if (centimes !== null) onChange({ ...ligne, prixCentimes: centimes, tarifId: null });
  };

  return (
    <div className="py-2.5">
      <div className="flex items-center gap-2">
        <input
          value={String(ligne.quantite)}
          onChange={(e) => onChange({ ...ligne, quantite: Math.max(1, Number(e.target.value) || 1) })}
          inputMode="numeric"
          aria-label={`Quantité pour ${ligne.libelle}`}
          className={`${CHAMP_BASE} chiffres w-12 shrink-0 px-1 text-center text-sm`}
        />
        <input
          value={ligne.libelle}
          onChange={(e) => onChange({ ...ligne, libelle: e.target.value })}
          aria-label="Libellé"
          className={`${CHAMP_BASE} min-w-0 flex-1 text-sm`}
        />
        <button
          type="button"
          onClick={onRetirer}
          className="shrink-0 px-2 text-lg leading-none text-ink-3 hover:text-alerte"
          aria-label={`Retirer ${ligne.libelle}`}
        >
          ×
        </button>
      </div>

      {/* Sur un téléphone, la précision prend toute la largeur et le prix passe
          en dessous : à trois champs sur une ligne, on ne lit plus rien. */}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <input
          value={ligne.precision ?? ''}
          onChange={(e) => onChange({ ...ligne, precision: e.target.value || null })}
          placeholder="Goût, forme, précision…"
          aria-label={`Précision pour ${ligne.libelle}`}
          className={`${CHAMP_BASE} min-h-9 w-full min-w-0 text-sm sm:w-auto sm:flex-1`}
        />
        <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
          <span className="flex items-center gap-1">
            <input
              value={prix}
              onChange={(e) => changerPrix(e.target.value)}
              inputMode="decimal"
              aria-label={`Prix unitaire de ${ligne.libelle}`}
              className={`${CHAMP_BASE} chiffres min-h-9 w-20 px-2 text-right text-sm`}
            />
            <span className="text-xs text-ink-3">€</span>
          </span>
          <span className="chiffres w-20 shrink-0 text-right text-sm font-medium text-ink">
            {formaterEuros(ligne.quantite * ligne.prixCentimes)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------- Assistant sur mesure */

/**
 * Un gâteau de 16 parts, un plateau de 60 mini-briwates : rien de tout cela
 * n'est dans une liste, et le calculer de tête au comptoir est la première
 * source d'erreur de prix. Ici le vendeur compose — une famille, un ou deux
 * parfums ou garnitures, une décoration, un nombre de parts ou de pièces — et
 * l'application applique le prix du format quand il existe, sinon le palier de
 * tarif qui correspond à la taille.
 *
 * Le sucré et le salé suivent exactement la même logique : seules changent
 * l'unité comptée et la liste proposée.
 */
function AssistantSurMesure({
  genre,
  composition,
  onAjout,
  onFermer,
}: {
  genre: GenreFamille;
  composition: CompositionGateau | null;
  onAjout: (ligne: LigneCommande) => void;
  onFermer: () => void;
}) {
  const [familleId, setFamilleId] = useState<number | null>(null);
  const [gouts, setGouts] = useState<string[]>([]);
  const [goutLibre, setGoutLibre] = useState('');
  const [decoration, setDecoration] = useState<OptionGateau | null>(null);
  const [parts, setParts] = useState('6');

  const estSale = genre === 'sale';
  const familles = (composition?.familles ?? []).filter((f) => f.genre === genre);
  const famille = familles.find((f) => f.id === familleId) ?? familles[0] ?? null;

  const nombreParts = Math.max(1, Math.round(Number(parts) || 0));
  const calcul = famille ? calculerPrixGateau(famille, nombreParts) : null;

  const propositions = estSale ? (composition?.garnitures ?? []) : (composition?.parfums ?? []);

  // Une coupe ne se pose que pour un gâteau à parts : un plateau de soixante
  // minis se compte, il ne se découpe pas.
  const coupes = composition?.coupes ?? COUPES_PAR_DEFAUT;
  const soumisALaCoupe = !estSale && famille?.unite === 'personne';
  const coupeOk = !soumisALaCoupe || coupeAcceptable(coupes, nombreParts);
  const propositionsCoupe = coupeOk ? [] : coupesProches(coupes, nombreParts);
  const coupeInterdite = !coupeOk && coupes.mode === 'interdire';
  const goutsRetenus = [...gouts, goutLibre.trim()].filter(Boolean).slice(0, PARFUMS_MAXIMUM);
  const libelle = famille ? libelleGateau(famille, goutsRetenus, nombreParts) : '';
  const uniteLibelle = famille?.unite === 'piece' ? 'Pièces' : 'Personnes';

  const basculerGout = (nom: string) => {
    setGouts((actuels) => {
      if (actuels.includes(nom)) return actuels.filter((p) => p !== nom);
      // Deux couches arrivent souvent — chocolat et framboise. Au-delà, le
      // libellé ne tient plus sur un A6.
      if (actuels.length >= PARFUMS_MAXIMUM) return [actuels[1], nom];
      return [...actuels, nom];
    });
  };

  const ajouter = () => {
    if (!famille || !calcul) return;

    const precisions: string[] = [];
    if (decoration) precisions.push(`Déco : ${decoration.nom}`);

    // Ce qui se compte à la pièce entre comme « 20 × 1,50 € » : le bon imprimé
    // le lit mieux, et corriger la quantité sur la ligne recalcule le total au
    // lieu de multiplier un forfait.
    const aLaPiece = famille.unite === 'piece';

    onAjout({
      libelle,
      quantite: aLaPiece ? nombreParts : 1,
      prixCentimes: aLaPiece ? calcul.unitaireCentimes : calcul.centimes,
      poste: estSale ? 'traiteur' : 'patissier',
      precision: precisions.join(' · ') || null,
      tarifId: null,
      categorie: estSale ? 'Salés' : 'Gâteaux et tartes',
    });

    // La décoration payante devient sa propre ligne : le client doit voir sur
    // le bon ce qu'il paie, comme pour la photo et l'écriture.
    if (decoration && decoration.supplementCentimes > 0) {
      onAjout({
        libelle: `Supplément décoration — ${decoration.nom}`,
        quantite: 1,
        prixCentimes: decoration.supplementCentimes,
        poste: 'patissier',
        precision: null,
        tarifId: null,
        categorie: 'Gâteaux et tartes',
      });
    }

    onFermer();
  };

  if (!composition || !famille || !calcul) {
    return (
      <div className="mt-3 rounded-lg border border-attention/30 bg-attention-doux p-3 text-xs text-attention">
        La composition n’est pas encore en base. Lancez{' '}
        <span className="chiffres">npm run db:seed-gateaux</span>.
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-accent/40 bg-accent-doux/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={ETIQUETTE}>{estSale ? 'Salé sur mesure' : 'Gâteau sur mesure'}</span>
        <button
          type="button"
          onClick={onFermer}
          className="text-xs text-ink-2 underline underline-offset-2 hover:text-ink"
        >
          Fermer
        </button>
      </div>

      <span className="mb-1 block text-xs text-ink-3">Type</span>
      <div className="flex flex-wrap gap-1.5">
        {familles.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setFamilleId(f.id);
              const minimum = f.minimumParts ?? (f.unite === 'piece' ? 10 : 6);
              if (nombreParts < minimum) setParts(String(minimum));
            }}
            className={`min-h-9 rounded-full border px-3 text-xs transition-colors ${
              famille.id === f.id
                ? 'border-accent bg-accent text-white'
                : 'border-line-fort bg-surface text-ink-2 hover:text-ink'
            }`}
          >
            {f.libelle}
            <span className="ml-1.5 opacity-70">
              {(f.parPersonneCentimes / 100).toFixed(2).replace('.', ',')} €
              {f.unite === 'piece' ? '/pièce' : '/pers'}
            </span>
          </button>
        ))}
      </div>

      {propositions.length > 0 ? (
        <>
          <span className="mb-1 mt-3 block text-xs text-ink-3">
            {estSale ? 'Garniture — jusqu’à deux' : 'Parfum — jusqu’à deux, pour un gâteau à deux couches'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {propositions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => basculerGout(p.nom)}
                className={`min-h-8 rounded-full border px-2.5 text-xs transition-colors ${
                  gouts.includes(p.nom)
                    ? 'border-accent bg-surface font-medium text-accent'
                    : 'border-line bg-surface text-ink-3 hover:text-ink-2'
                }`}
              >
                {p.nom}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {!estSale && famille.unite === 'personne' ? (
        <>
          <span className="mb-1 mt-3 block text-xs text-ink-3">Décoration extérieure</span>
          <div className="flex flex-wrap gap-1.5">
            {(composition.decorations ?? []).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDecoration(decoration?.id === d.id ? null : d)}
                className={`min-h-8 rounded-full border px-2.5 text-xs transition-colors ${
                  decoration?.id === d.id
                    ? 'border-accent bg-surface font-medium text-accent'
                    : 'border-line bg-surface text-ink-3 hover:text-ink-2'
                }`}
              >
                {d.nom}
                {d.supplementCentimes > 0 ? (
                  <span className="ml-1.5 opacity-70">+{formaterEuros(d.supplementCentimes)}</span>
                ) : (
                  <span className="ml-1.5 opacity-60">compris</span>
                )}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className={ETIQUETTE} htmlFor="gout-sur-mesure">
            {estSale ? 'Autre garniture' : 'Autre parfum'}
          </label>
          <input
            id="gout-sur-mesure"
            value={goutLibre}
            onChange={(e) => setGoutLibre(e.target.value)}
            placeholder="s’il n’est pas dans la liste"
            className={`${CHAMP_BASE} w-full text-sm`}
          />
        </div>
        <div className="w-28">
          <label className={ETIQUETTE} htmlFor="parts-sur-mesure">{uniteLibelle}</label>
          <input
            id="parts-sur-mesure"
            value={parts}
            onChange={(e) => setParts(e.target.value)}
            inputMode="numeric"
            className={`${CHAMP_BASE} chiffres w-full text-center text-sm ${
              coupeOk ? '' : 'border-attention'
            }`}
          />
        </div>
      </div>

      {soumisALaCoupe && coupes.mode !== 'libre' ? (
        <div className="mt-2">
          <span className="mb-1 block text-xs text-ink-3">Tailles qui se coupent proprement</span>
          <div className="flex flex-wrap gap-1.5">
            {coupes.conseillees.map((taille) => (
              <button
                key={taille}
                type="button"
                onClick={() => setParts(String(taille))}
                className={`chiffres min-h-8 min-w-10 rounded-full border px-2.5 text-xs transition-colors ${
                  nombreParts === taille
                    ? 'border-accent bg-accent text-white'
                    : 'border-line bg-surface text-ink-2 hover:text-ink'
                }`}
              >
                {taille}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!coupeOk ? (
        <p
          className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
            coupeInterdite
              ? 'border-alerte/30 bg-alerte-doux text-alerte'
              : 'border-attention/30 bg-attention-doux text-attention'
          }`}
        >
          {nombreParts} parts se coupent mal.{' '}
          {propositionsCoupe.length > 0
            ? `Proposez ${propositionsCoupe.join(' ou ')} parts au client.`
            : 'Choisissez un nombre pair ou un multiple de cinq.'}
          {coupeInterdite ? ' Cette taille n’est pas acceptée par le magasin.' : ''}
        </p>
      ) : null}

      <div className="mt-3 rounded-lg border border-line bg-surface p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-ink">{libelle}</span>
          <span className="chiffres text-lg font-semibold text-ink">
            {calcul.aPartirDe ? 'à partir de ' : ''}
            {formaterEuros(calcul.centimes + (decoration?.supplementCentimes ?? 0))}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-ink-3">
          {calcul.explication}
          {decoration && decoration.supplementCentimes > 0
            ? ` + ${formaterEuros(decoration.supplementCentimes)} de décoration`
            : ''}
        </p>
        {decoration ? (
          <p className="mt-0.5 text-xs text-ink-2">Déco : {decoration.nom}</p>
        ) : null}
        {calcul.aPartirDe ? (
          <p className="mt-1 text-xs text-ink-3">
            Prix plancher : {estSale ? 'une garniture' : 'un parfum'} ou une demande
            particulière le fait monter.
          </p>
        ) : null}

        {calcul.alertes.length > 0 ? (
          <ul className="mt-2 grid gap-1">
            {calcul.alertes.map((alerte) => (
              <li key={alerte} className="text-xs text-attention">
                {alerte}
              </li>
            ))}
          </ul>
        ) : null}

        <Bouton
          variante="principal"
          className="mt-3 w-full"
          disabled={coupeInterdite}
          onClick={ajouter}
        >
          {coupeInterdite ? 'Taille non acceptée' : 'Ajouter au bon'}
        </Bouton>
        <p className="mt-1.5 text-center text-xs text-ink-3">
          Le prix reste modifiable ligne par ligne.
        </p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Choix */

function Choix({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-lg border px-3.5 text-sm transition-colors ${
        actif
          ? 'border-accent bg-accent-doux font-medium text-accent'
          : 'border-line-fort bg-surface text-ink-2 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------- Ajout de produit */

function AjoutProduit({
  tarifs,
  grilleChargee,
  onAjout,
  onTarifCree,
}: {
  tarifs: Tarif[];
  grilleChargee: boolean;
  onAjout: (ligne: LigneCommande) => void;
  onTarifCree: (tarif: Tarif) => void;
}) {
  const [saisie, setSaisie] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [prixLibre, setPrixLibre] = useState('');
  const [occupe, setOccupe] = useState(false);

  const suggestions = useMemo(() => {
    const mots = normaliser(saisie).split(' ').filter(Boolean);
    if (mots.length === 0 || saisie.trim().length < 2) return [];

    const trouves = tarifs
      .map((tarif) => ({ tarif, cle: normaliser(tarif.nom) }))
      // Tous les mots doivent apparaître : « bav fram » trouve
      // « Bavarois framboise 6P » sans qu'on tape le nom entier.
      .filter(({ cle }) => mots.every((mot) => cle.includes(mot)));

    // Ce qui commence par ce qu'on tape passe devant : « bav » propose
    // « Bavarois » avant « Mini Bavarois ».
    trouves.sort((a, b) => {
      const debutA = a.cle.startsWith(mots[0]) ? 0 : 1;
      const debutB = b.cle.startsWith(mots[0]) ? 0 : 1;
      return debutA - debutB || a.cle.length - b.cle.length;
    });

    return trouves.slice(0, 12).map(({ tarif }) => tarif);
  }, [saisie, tarifs]);

  const ajouterTarif = (tarif: Tarif) => {
    onAjout({
      libelle: tarif.nom,
      quantite: Math.max(1, Number(quantite) || 1),
      prixCentimes: tarif.prixCentimes,
      poste: tarif.poste,
      precision: null,
      tarifId: tarif.id,
      categorie: tarif.categorie,
    });
    setSaisie('');
    setQuantite('1');
    setPrixLibre('');
  };

  /**
   * Deux gestes différents, qu'il ne faut pas confondre.
   *
   *   retenir = false — une commande sur mesure : « Bavarois 12 parts, framboise
   *   et fruits rouges ». Elle ne doit surtout pas entrer dans la grille, sinon
   *   celle-ci se remplirait de gâteaux uniques commandés une fois.
   *
   *   retenir = true — un vrai produit du magasin qui manquait à la liste. Le
   *   prix est retenu pour la prochaine fois, et la ligne arrive marquée
   *   « à ranger » chez le manager.
   */
  const ajouterLibre = async (retenir: boolean) => {
    const libelle = saisie.trim();
    const prixCentimes = lireMontant(prixLibre);
    if (!libelle || prixCentimes === null) return;

    setOccupe(true);
    try {
      let tarifId: number | null = null;

      if (retenir) {
        const reponse = await fetch('/api/tarifs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nom: libelle, prixCentimes }),
        });
        if (reponse.ok) {
          const tarif: Tarif = await reponse.json();
          tarifId = tarif.id ?? null;
          if (tarif.id) onTarifCree(tarif);
        }
      }

      onAjout({
        libelle,
        quantite: Math.max(1, Number(quantite) || 1),
        prixCentimes,
        poste: null,
        precision: null,
        tarifId,
        categorie: retenir ? 'À ranger' : null,
      });
      setSaisie('');
      setQuantite('1');
      setPrixLibre('');
    } finally {
      setOccupe(false);
    }
  };

  /** Une ligne vide, à écrire entièrement à la main. */
  const ajouterLigneVide = () => {
    onAjout({
      libelle: saisie.trim(),
      quantite: Math.max(1, Number(quantite) || 1),
      prixCentimes: 0,
      poste: null,
      precision: null,
      tarifId: null,
      categorie: null,
    });
    setSaisie('');
    setQuantite('1');
    setPrixLibre('');
  };

  const aucuneSuggestion = saisie.trim().length >= 2 && suggestions.length === 0;

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={quantite}
          onChange={(e) => setQuantite(e.target.value)}
          inputMode="numeric"
          aria-label="Quantité"
          className={`${CHAMP_BASE} chiffres w-14 shrink-0 px-1 text-center sm:w-16 sm:px-3`}
        />
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Croissant, bavarois, baguette…"
          aria-label="Produit"
          autoComplete="off"
          className={`${CHAMP_BASE} min-w-0 flex-1`}
        />
      </div>

      {grilleChargee && tarifs.length === 0 ? (
        <p className="mt-2 rounded-lg border border-attention/30 bg-attention-doux px-3 py-2 text-xs text-attention">
          La grille tarifaire est vide : aucune suggestion ne peut s’afficher. Lancez{' '}
          <span className="chiffres">npm run db:seed-tarifs</span> pour la remplir. En attendant,
          tapez le libellé et son prix — la commande passera quand même.
        </p>
      ) : null}

      {suggestions.length > 0 ? (
        <ul className="mt-2 max-h-72 overflow-y-auto overscroll-contain rounded-lg border border-line">
          {suggestions.map((tarif) => (
            <li key={tarif.id}>
              <button
                type="button"
                onClick={() => ajouterTarif(tarif)}
                className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-line bg-surface px-3 py-2 text-left text-sm text-ink last:border-b-0 hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{tarif.nom}</span>
                  <span className="block text-xs text-ink-3">{tarif.categorie}</span>
                </span>
                <span className="chiffres shrink-0 text-ink-2">{formaterEuros(tarif.prixCentimes)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {aucuneSuggestion ? (
        <div className="mt-2 rounded-lg border border-dashed border-line-fort p-3">
          <p className="text-sm text-ink-2">
            « {saisie.trim()} » n’est pas dans la grille. Indiquez son prix unitaire.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={prixLibre}
              onChange={(e) => setPrixLibre(e.target.value)}
              inputMode="decimal"
              placeholder="Prix unitaire"
              aria-label="Prix unitaire"
              className={CHAMP}
            />
            <Bouton
              variante="principal"
              className="shrink-0"
              disabled={occupe || lireMontant(prixLibre) === null}
              onClick={() => void ajouterLibre(false)}
            >
              Ajouter
            </Bouton>
          </div>
          <button
            type="button"
            disabled={occupe || lireMontant(prixLibre) === null}
            onClick={() => void ajouterLibre(true)}
            className="mt-2 text-xs text-ink-2 underline underline-offset-2 hover:text-ink disabled:opacity-50"
          >
            Ajouter et retenir ce prix pour la prochaine fois
          </button>
          <p className="mt-1 text-xs text-ink-3">
            À ne faire que pour un vrai produit du magasin : une commande sur mesure n’a pas sa
            place dans la grille.
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={ajouterLigneVide}
        className="mt-2 text-xs text-ink-2 underline underline-offset-2 hover:text-ink"
      >
        Ajouter une ligne à écrire à la main
      </button>
    </div>
  );
}
