import Link from 'next/link';

export default function Introuvable() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-xl font-semibold text-ink">Cette page n&apos;existe pas</h1>
      <p className="mt-2 text-sm text-ink-2 text-pretty">
        Les écrans de saisie en doublon ont été retirés. Tout part maintenant de l&apos;accueil.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-fort"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
