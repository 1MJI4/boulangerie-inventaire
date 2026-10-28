// src/lib/suiviImpression.ts
//
// Les impressions envoyées depuis cette tablette et pas encore toutes sorties.
//
// Une fois les tickets déposés dans la file, le vendeur n'a plus rien à faire :
// l'imprimante vient les chercher toute seule et la commande passe « imprimée »
// côté serveur au dernier exemplaire. Il peut donc quitter l'écran
// d'impression tout de suite ; ce petit registre permet au voyant en bas
// d'écran (SuiviImpression) de continuer à suivre le travail ailleurs.

export type ImpressionSuivie = { commandeId: number; numero: string; envoyeLe: number };

const CLE = 'impressions-en-cours';
const EVENEMENT = 'impressions-en-cours';

/** Au-delà, on arrête de suivre : la commande est imprimée ou abandonnée depuis longtemps. */
export const OUBLI_APRES_MS = 15 * 60_000;

export function lireImpressionsSuivies(): ImpressionSuivie[] {
  try {
    const brut = JSON.parse(window.localStorage.getItem(CLE) ?? '[]');
    if (!Array.isArray(brut)) return [];
    const maintenant = Date.now();
    return brut.filter(
      (s): s is ImpressionSuivie =>
        typeof s?.commandeId === 'number' && typeof s?.numero === 'string' && maintenant - s.envoyeLe < OUBLI_APRES_MS,
    );
  } catch {
    return [];
  }
}

function ecrire(liste: ImpressionSuivie[]) {
  try {
    window.localStorage.setItem(CLE, JSON.stringify(liste));
  } catch {
    // Stockage plein ou interdit : le voyant ne suivra pas, l'impression sort quand même.
  }
  window.dispatchEvent(new Event(EVENEMENT));
}

export function suivreImpression(commandeId: number, numero: string) {
  const autres = lireImpressionsSuivies().filter((s) => s.commandeId !== commandeId);
  ecrire([...autres, { commandeId, numero, envoyeLe: Date.now() }]);
}

export function oublierImpression(commandeId: number) {
  ecrire(lireImpressionsSuivies().filter((s) => s.commandeId !== commandeId));
}

/** Prévient quand la liste change (sur cette page ou dans un autre onglet). */
export function ecouterImpressionsSuivies(rappel: () => void): () => void {
  const surStockage = (e: StorageEvent) => {
    if (e.key === CLE) rappel();
  };
  window.addEventListener(EVENEMENT, rappel);
  window.addEventListener('storage', surStockage);
  return () => {
    window.removeEventListener(EVENEMENT, rappel);
    window.removeEventListener('storage', surStockage);
  };
}
