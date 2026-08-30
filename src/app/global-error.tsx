'use client';

/**
 * Dernier filet : une erreur survenue dans le layout racine lui-même.
 * Ce composant remplace tout le document, il embarque donc son propre style.
 */
export default function ErreurGlobale({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#f5f4f2',
          color: '#1a1917',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
            L&apos;application n&apos;a pas pu démarrer
          </h1>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#5c5852' }}>
            Les données enregistrées ne sont pas affectées.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              minHeight: '2.75rem',
              padding: '0 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#a04f22',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Recharger
          </button>
          {error.digest ? (
            <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#8b857d' }}>
              Référence : {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
