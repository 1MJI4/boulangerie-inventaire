// netlify/functions/imprimante-reveil.mts
//
// Tâche planifiée : chaque minute pendant les heures d'ouverture, appelle la
// fonction de l'imprimante sur son adresse de réveil (aucune donnée, aucun
// travail) pour qu'elle ne s'endorme pas. Ainsi, quand l'imprimante revient
// après un silence, la réponse part en ~0,2 s au lieu de devoir réveiller un
// serveur, et elle n'abandonne pas le téléchargement du ticket.
//
// Plage : 4 h à 19 h 59 UTC, soit 6 h à 21 h 59 en été et 5 h à 20 h 59 en
// hiver à Bruxelles — l'ouverture 6 h – 20 h est couverte toute l'année.
// HYPOTHÈSE À VALIDER : plage figée ici (la planification Netlify est lue au
// déploiement) ; si le gérant élargit ses horaires au-delà, l'élargir aussi.
// Coût : ~960 appels par jour, contre ~17 000 pour le sondage de l'imprimante.

type Config = { schedule: string };

export default async function reveil(): Promise<Response> {
  const site = process.env.URL;
  if (site) {
    try {
      await fetch(`${site}/api/cloudprnt/reveil`, { method: 'POST', signal: AbortSignal.timeout(8000) });
    } catch {
      // Un réveil manqué n'est pas grave : le suivant arrive dans une minute.
    }
  }
  return new Response(null, { status: 204 });
}

export const config: Config = { schedule: '* 4-19 * * *' };
