// Démarrage du serveur : rappels horaires du manager, chaque minute
// (retrait dans 1 h, à l'heure, 2 h après). Un seul processus sur le VPS ;
// la clé d'envoi en base évite tout doublon même si le serveur redémarre.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production') return;
  const { verifierRappels } = await import('@/lib/serveur/notifications');
  setInterval(() => {
    void verifierRappels();
  }, 60_000).unref();
}
