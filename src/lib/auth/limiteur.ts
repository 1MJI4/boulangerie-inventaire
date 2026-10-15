// src/lib/auth/limiteur.ts
//
// Limite de tentatives sur le code de tablette et le code gérant.
// Propriétaire : agent `securite`. Pur (l'heure est passée en paramètre).
//
// HYPOTHÈSE À VALIDER : la mémoire est propre à chaque instance serveur. Sur
// Netlify (fonctions serverless), plusieurs instances peuvent coexister : la
// limite est donc un frein, pas un mur. La vraie protection est la longueur
// des codes (8 caractères minimum, imposée par config.ts).

/** Échecs tolérés par adresse (et par tablette pour le code gérant) sur la fenêtre. */
export const MAX_ECHECS_PAR_SOURCE = 5;
/** Échecs tolérés toutes sources confondues : freine une attaque répartie. */
export const MAX_ECHECS_GLOBAL = 50;
export const FENETRE_MS = 15 * 60 * 1000;

type Compteur = { echecs: number; depuis: number };

export class LimiteurTentatives {
  private readonly compteurs = new Map<string, Compteur>();
  private readonly max: number;
  private readonly fenetreMs: number;

  // Pas de « propriétés de paramètre » : Node exécute ce fichier tel quel
  // (suppression des types), et cette syntaxe-là n'est pas effaçable.
  constructor(max: number, fenetreMs: number) {
    this.max = max;
    this.fenetreMs = fenetreMs;
  }

  private lire(cle: string, maintenant: number): Compteur | null {
    const c = this.compteurs.get(cle);
    if (!c) return null;
    if (maintenant - c.depuis >= this.fenetreMs) {
      this.compteurs.delete(cle);
      return null;
    }
    return c;
  }

  estBloque(cle: string, maintenant: number): boolean {
    const c = this.lire(cle, maintenant);
    return c !== null && c.echecs >= this.max;
  }

  /** Millisecondes avant de pouvoir réessayer (0 si non bloqué). */
  attenteRestante(cle: string, maintenant: number): number {
    const c = this.lire(cle, maintenant);
    if (!c || c.echecs < this.max) return 0;
    return c.depuis + this.fenetreMs - maintenant;
  }

  noterEchec(cle: string, maintenant: number): void {
    const c = this.lire(cle, maintenant);
    if (c) c.echecs += 1;
    else this.compteurs.set(cle, { echecs: 1, depuis: maintenant });
    // Garde-fou mémoire : on ne laisse pas la table grossir sans fin.
    if (this.compteurs.size > 10_000) {
      for (const [k, v] of this.compteurs) {
        if (maintenant - v.depuis >= this.fenetreMs) this.compteurs.delete(k);
      }
    }
  }

  oublier(cle: string): void {
    this.compteurs.delete(cle);
  }
}
